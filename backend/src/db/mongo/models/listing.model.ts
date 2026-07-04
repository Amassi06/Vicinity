import mongoose, { Schema, type Document as MongoDocument } from 'mongoose';

export interface ListingEntity extends MongoDocument {
  authorId: string;
  neighbourhoodId: string;
  title: string;
  description: string;
  kind: 'offer' | 'request';
  category: string;
  location: string;
  serviceDate?: Date | null;
  pricePoints: number;
  isFree: boolean;
  contractId?: string | null;
  status: 'open' | 'in_progress' | 'closed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

const ListingSchema = new Schema<ListingEntity>(
  {
    authorId: { type: String, required: true, index: true },
    neighbourhoodId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    kind: { type: String, enum: ['offer', 'request'], required: true, index: true },
    category: { type: String, required: true, index: true },
    location: { type: String, default: '' },
    serviceDate: { type: Date, default: null },
    pricePoints: { type: Number, default: 0, min: 0 },
    isFree: { type: Boolean, default: true },
    contractId: { type: String, default: null },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'closed', 'cancelled'],
      default: 'open',
      index: true,
    },
  },
  { timestamps: true, collection: 'listings' },
);

ListingSchema.index({ neighbourhoodId: 1, status: 1, createdAt: -1 });

export const ListingModel = mongoose.model<ListingEntity>('Listing', ListingSchema);
