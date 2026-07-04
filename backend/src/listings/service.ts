import { ContractModel, ListingModel, type ContractEntity, type ListingEntity } from '../db/mongo/models/index.js';
import { prisma } from '../db/prisma.js';
import { escrowDeposit, escrowRefund, escrowRelease, getBalance } from '../wallet/service.js';
import type { CategoryCreateInput, ListingCreateInput, ListingListQuery } from './schemas.js';

export interface AcceptResult {
  listing: ListingEntity;
  contract: ContractEntity;
}

// ----------------------------------------------------------------------------
// Catégories (référentiel Postgres, géré par les admins)
// ----------------------------------------------------------------------------

export async function listCategories() {
  return prisma.listingCategory.findMany({ orderBy: { label: 'asc' } });
}

export async function createCategory(input: CategoryCreateInput) {
  const slug =
    input.slug ??
    input.label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  if (!slug) throw new Error('invalid_slug');
  try {
    return await prisma.listingCategory.create({ data: { slug, label: input.label } });
  } catch (err) {
    if (err instanceof Error && err.message.includes('Unique constraint')) {
      throw new Error('slug_already_used');
    }
    throw err;
  }
}

export async function deleteCategory(id: string): Promise<boolean> {
  const res = await prisma.listingCategory.deleteMany({ where: { id } });
  return res.count > 0;
}

// ----------------------------------------------------------------------------
// Annonces
// ----------------------------------------------------------------------------

export async function createListing(
  authorId: string,
  input: ListingCreateInput,
): Promise<ListingEntity> {
  const category = await prisma.listingCategory.findUnique({
    where: { slug: input.category },
    select: { slug: true },
  });
  if (!category) throw new Error('invalid_category');

  // Une demande payante engage l'auteur comme payeur : refuser d'emblée si son
  // solde ne couvre pas le prix annoncé.
  if (input.kind === 'request' && input.pricePoints > 0) {
    const balance = await getBalance(authorId);
    if (balance < input.pricePoints) throw new Error('insufficient_funds');
  }

  const isFree = input.pricePoints === 0;
  return ListingModel.create({
    authorId,
    neighbourhoodId: input.neighbourhoodId,
    title: input.title,
    description: input.description,
    kind: input.kind,
    category: input.category,
    location: input.location,
    serviceDate: input.serviceDate ?? null,
    pricePoints: input.pricePoints,
    isFree,
  });
}

export async function listListings(query: ListingListQuery): Promise<ListingEntity[]> {
  return ListingModel.find(query).sort({ createdAt: -1 }).limit(50).exec();
}

export async function getListing(id: string): Promise<ListingEntity | null> {
  return ListingModel.findById(id).exec();
}

export async function cancelListing(id: string, userId: string): Promise<ListingEntity | null> {
  const listing = await ListingModel.findById(id);
  if (!listing) return null;
  if (listing.authorId !== userId) throw new Error('forbidden');
  if (listing.status !== 'open') throw new Error('invalid_state');
  listing.status = 'cancelled';
  await listing.save();
  return listing;
}

/**
 * Suppression administrateur : disponible quel que soit l'état. Si un contrat
 * est sous séquestre, les points sont d'abord rendus au payeur.
 */
export async function adminDeleteListing(id: string): Promise<boolean> {
  const listing = await ListingModel.findById(id);
  if (!listing) return false;

  if (listing.contractId) {
    const contract = await ContractModel.findById(listing.contractId);
    if (contract && !['completed', 'cancelled'].includes(contract.status)) {
      if (contract.status === 'escrowed' && contract.pricePoints > 0) {
        await escrowRefund({
          payerId: contract.payerId,
          payeeId: contract.payeeId,
          amount: contract.pricePoints,
          listingId: String(listing._id),
          contractId: String(contract._id),
        });
      }
      contract.status = 'cancelled';
      contract.cancelledAt = new Date();
      await contract.save();
    }
  }

  await ListingModel.deleteOne({ _id: listing._id });
  return true;
}

/**
 * Accepte une annonce : crée le contrat en attente de signatures. Aucun point
 * ne bouge à cette étape — le paiement part au séquestre quand les DEUX
 * parties ont signé (voir `signContract`).
 *  - offer  : l'acceptant paiera l'auteur  (acceptor = payer, author = payee)
 *  - request: l'auteur paiera l'acceptant (author = payer, acceptor = payee)
 * Le solde du payeur est contrôlé dès maintenant pour échouer tôt.
 */
export async function acceptListing(
  listingId: string,
  acceptorId: string,
): Promise<AcceptResult> {
  const listing = await ListingModel.findById(listingId);
  if (!listing) throw new Error('not_found');
  if (listing.status !== 'open') throw new Error('invalid_state');
  if (listing.authorId === acceptorId) throw new Error('cannot_accept_own_listing');

  const payerId = listing.kind === 'offer' ? acceptorId : listing.authorId;
  const payeeId = listing.kind === 'offer' ? listing.authorId : acceptorId;

  if (listing.pricePoints > 0) {
    const balance = await getBalance(payerId);
    if (balance < listing.pricePoints) throw new Error('insufficient_funds');
  }

  let contract: ContractEntity;
  try {
    contract = await ContractModel.create({
      listingId: String(listing._id),
      authorId: listing.authorId,
      acceptorId,
      payerId,
      payeeId,
      pricePoints: listing.pricePoints,
      status: 'pending_signatures',
    });
  } catch (err) {
    if (err instanceof Error && /E11000/.test(err.message)) {
      throw new Error('already_accepted');
    }
    throw err;
  }

  listing.status = 'in_progress';
  listing.contractId = String(contract._id);
  await listing.save();

  return { listing, contract };
}

export async function getContract(
  contractId: string,
  userId: string,
  isAdmin: boolean,
): Promise<ContractEntity | null> {
  const contract = await ContractModel.findById(contractId);
  if (!contract) return null;
  if (!isAdmin && ![contract.payerId, contract.payeeId].includes(userId)) {
    throw new Error('forbidden');
  }
  return contract;
}

/**
 * Signature d'une partie. Quand les deux signatures sont posées, les points du
 * payeur partent au séquestre et le contrat passe à `escrowed`. Si le solde du
 * payeur est devenu insuffisant entre-temps, la seconde signature est refusée
 * (402) et rien n'est enregistré.
 */
export async function signContract(
  contractId: string,
  userId: string,
): Promise<ContractEntity | null> {
  const contract = await ContractModel.findById(contractId);
  if (!contract) return null;
  if (![contract.payerId, contract.payeeId].includes(userId)) throw new Error('forbidden');
  if (contract.status !== 'pending_signatures') throw new Error('invalid_state');

  const isPayer = contract.payerId === userId;
  if ((isPayer && contract.payerSignedAt) || (!isPayer && contract.payeeSignedAt)) {
    throw new Error('already_signed');
  }

  const otherAlreadySigned = isPayer ? !!contract.payeeSignedAt : !!contract.payerSignedAt;
  if (otherAlreadySigned) {
    if (contract.pricePoints > 0) {
      await escrowDeposit({
        payerId: contract.payerId,
        payeeId: contract.payeeId,
        amount: contract.pricePoints,
        listingId: contract.listingId,
        contractId: String(contract._id),
      });
    }
    contract.status = 'escrowed';
    contract.escrowedAt = new Date();
  }

  if (isPayer) contract.payerSignedAt = new Date();
  else contract.payeeSignedAt = new Date();
  await contract.save();

  return contract;
}

/** Fin de contrat réussie : le séquestre est versé au prestataire. */
export async function completeContract(
  contractId: string,
  userId: string,
): Promise<ContractEntity | null> {
  const contract = await ContractModel.findById(contractId);
  if (!contract) return null;
  if (![contract.payerId, contract.payeeId].includes(userId)) throw new Error('forbidden');
  if (contract.status !== 'escrowed') throw new Error('invalid_state');

  if (contract.pricePoints > 0) {
    await escrowRelease({
      payerId: contract.payerId,
      payeeId: contract.payeeId,
      amount: contract.pricePoints,
      listingId: contract.listingId,
      contractId: String(contract._id),
    });
  }

  contract.status = 'completed';
  contract.completedAt = new Date();
  await contract.save();
  await ListingModel.updateOne({ _id: contract.listingId }, { $set: { status: 'closed' } });
  return contract;
}

/**
 * Annulation : le séquestre éventuel revient au payeur et l'annonce est
 * rouverte pour un autre voisin.
 */
export async function cancelContract(
  contractId: string,
  userId: string,
): Promise<ContractEntity | null> {
  const contract = await ContractModel.findById(contractId);
  if (!contract) return null;
  if (![contract.payerId, contract.payeeId].includes(userId)) throw new Error('forbidden');
  if (!['pending_signatures', 'escrowed'].includes(contract.status)) {
    throw new Error('invalid_state');
  }

  if (contract.status === 'escrowed' && contract.pricePoints > 0) {
    await escrowRefund({
      payerId: contract.payerId,
      payeeId: contract.payeeId,
      amount: contract.pricePoints,
      listingId: contract.listingId,
      contractId: String(contract._id),
    });
  }

  contract.status = 'cancelled';
  contract.cancelledAt = new Date();
  await contract.save();
  await ListingModel.updateOne(
    { _id: contract.listingId },
    { $set: { status: 'open', contractId: null } },
  );
  return contract;
}
