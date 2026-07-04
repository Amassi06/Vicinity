import mongoose, { Schema, type Document as MongoDocument } from 'mongoose';

export interface IncidentEntity extends MongoDocument {
  reporterId: string;
  neighbourhoodId: string;
  title: string;
  description: string;
  category: string;
  status: 'open' | 'in_progress' | 'resolved';
  createdAt: Date;
  updatedAt: Date;
}

const IncidentSchema = new Schema<IncidentEntity>(
  {
    reporterId: { type: String, required: true, index: true },
    neighbourhoodId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    category: { type: String, required: true },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'resolved'],
      default: 'open',
      index: true,
    },
  },
  { timestamps: true, collection: 'incidents' },
);

IncidentSchema.index({ neighbourhoodId: 1, status: 1, createdAt: -1 });

export const IncidentModel = mongoose.model<IncidentEntity>('Incident', IncidentSchema);
