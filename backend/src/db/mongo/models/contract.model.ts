import mongoose, { Schema, type Document as MongoDocument } from 'mongoose';

export interface ContractEntity extends MongoDocument {
  listingId: string;
  authorId: string;
  acceptorId: string;
  payerId: string;
  payeeId: string;
  pricePoints: number;
  status: 'pending' | 'completed' | 'cancelled';
  pointTxId?: string | null;
  acceptedAt: Date;
  completedAt?: Date | null;
  cancelledAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ContractSchema = new Schema<ContractEntity>(
  {
    listingId: { type: String, required: true },
    authorId: { type: String, required: true, index: true },
    acceptorId: { type: String, required: true, index: true },
    payerId: { type: String, required: true, index: true },
    payeeId: { type: String, required: true, index: true },
    pricePoints: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['pending', 'completed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    pointTxId: { type: String, default: null },
    acceptedAt: { type: Date, default: () => new Date() },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'contracts' },
);

ContractSchema.index({ listingId: 1 }, { unique: true });

export const ContractModel = mongoose.model<ContractEntity>('Contract', ContractSchema);
