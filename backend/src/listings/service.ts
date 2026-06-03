import { ContractModel, ListingModel, type ContractEntity, type ListingEntity } from '../db/mongo/models/index.js';
import { transferPoints } from '../wallet/service.js';
import type { ListingCreateInput, ListingListQuery } from './schemas.js';

export interface AcceptResult {
  listing: ListingEntity;
  contract: ContractEntity;
}

export async function createListing(
  authorId: string,
  input: ListingCreateInput,
): Promise<ListingEntity> {
  const isFree = input.pricePoints === 0;
  const listing = await ListingModel.create({
    authorId,
    neighbourhoodId: input.neighbourhoodId,
    title: input.title,
    description: input.description,
    kind: input.kind,
    category: input.category,
    pricePoints: input.pricePoints,
    isFree,
  });
  return listing;
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
 * Accepte une annonce :
 *  - offer  : l'acceptor PAIE l'author (acceptor = payer, author = payee)
 *  - request: l'acceptor PRESTATAIRE est payé par l'author (author = payer, acceptor = payee)
 *
 * Effets :
 *  - création d'un Contract (statut "pending", unique par listing grâce à l'index unique)
 *  - listing.status -> "in_progress", contractId attaché
 *  - si pricePoints > 0 : transfert atomique des points (PointTransaction loggé)
 *
 * Réversion en cas d'échec de transfert : le contrat est supprimé et le listing rouvert.
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

  let contract: ContractEntity;
  try {
    contract = await ContractModel.create({
      listingId: String(listing._id),
      authorId: listing.authorId,
      acceptorId,
      payerId,
      payeeId,
      pricePoints: listing.pricePoints,
      status: 'pending',
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

  if (listing.pricePoints > 0) {
    try {
      await transferPoints({
        fromUserId: payerId,
        toUserId: payeeId,
        amount: listing.pricePoints,
        reason: 'SERVICE_PAYMENT',
        listingId: String(listing._id),
        contractId: String(contract._id),
      });
    } catch (err) {
      await ContractModel.deleteOne({ _id: contract._id });
      listing.status = 'open';
      listing.contractId = null;
      await listing.save();
      throw err;
    }
  }

  return { listing, contract };
}

export async function completeContract(
  contractId: string,
  userId: string,
): Promise<ContractEntity | null> {
  const contract = await ContractModel.findById(contractId);
  if (!contract) return null;
  if (![contract.payerId, contract.payeeId].includes(userId)) throw new Error('forbidden');
  if (contract.status !== 'pending') throw new Error('invalid_state');
  contract.status = 'completed';
  contract.completedAt = new Date();
  await contract.save();
  await ListingModel.updateOne(
    { _id: contract.listingId },
    { $set: { status: 'closed' } },
  );
  return contract;
}
