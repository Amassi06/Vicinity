import mongoose, { Schema, type Document as MongoDocument } from 'mongoose';

export interface EventEntity extends MongoDocument {
  title: string;
  description: string;
  organizerId: string;
  neighbourhoodId: string;
  startsAt: Date;
  endsAt: Date;
  location?: {
    type: 'Point';
    coordinates: [number, number];
    address?: string;
  };
  capacity?: number | null;
  attendees: string[];
  interested: string[];
  declined: string[];
  status: 'draft' | 'published' | 'cancelled' | 'archived';
  archivedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const EventSchema = new Schema<EventEntity>(
  {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    organizerId: { type: String, required: true, index: true },
    neighbourhoodId: { type: String, required: true, index: true },
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date, required: true },
    location: {
      type: { type: String, enum: ['Point'] },
      coordinates: { type: [Number] },
      address: { type: String },
    },
    capacity: { type: Number, default: null, min: 1 },
    attendees: { type: [String], default: [] },
    interested: { type: [String], default: [] },
    declined: { type: [String], default: [] },
    status: {
      type: String,
      enum: ['draft', 'published', 'cancelled', 'archived'],
      default: 'draft',
      index: true,
    },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'events' },
);

EventSchema.index({ location: '2dsphere' });
EventSchema.index({ neighbourhoodId: 1, startsAt: 1 });

export const EventModel = mongoose.model<EventEntity>('Event', EventSchema);
