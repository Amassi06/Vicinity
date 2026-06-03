import mongoose, { Schema, type Document as MongoDocument } from 'mongoose';

export interface PollEntity extends MongoDocument {
  neighbourhoodId: string;
  createdBy: string;
  title: string;
  options: string[];
  pluginId: string;
  status: 'open' | 'closed';
  closesAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const PollSchema = new Schema<PollEntity>(
  {
    neighbourhoodId: { type: String, required: true, index: true },
    createdBy: { type: String, required: true, index: true },
    title: { type: String, required: true },
    options: [{ type: String, required: true }],
    pluginId: { type: String, default: 'standard', index: true },
    status: {
      type: String,
      enum: ['open', 'closed'],
      default: 'open',
      index: true,
    },
    closesAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'polls' },
);

PollSchema.index({ neighbourhoodId: 1, createdAt: -1 });

export const PollModel = mongoose.model<PollEntity>('Poll', PollSchema);
