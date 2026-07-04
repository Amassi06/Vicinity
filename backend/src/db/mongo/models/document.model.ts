import mongoose, { Schema, type Document as MongoDocument } from 'mongoose';

export interface SignatureZone {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  signedBy?: string | null;
  signedAt?: Date | null;
  signatureHash?: string | null;
}

export interface DocumentEntity extends MongoDocument {
  ownerId: string;
  title: string;
  storageKey: string;
  contentType: string;
  sha256: string;
  status: 'draft' | 'pending_signatures' | 'signed' | 'archived';
  zones: SignatureZone[];
  participants: string[];
  createdAt: Date;
  updatedAt: Date;
  archivedAt?: Date | null;
}

const SignatureZoneSchema = new Schema<SignatureZone>(
  {
    page: { type: Number, required: true, min: 1 },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    width: { type: Number, required: true, min: 0 },
    height: { type: Number, required: true, min: 0 },
    required: { type: Boolean, default: true },
    signedBy: { type: String, default: null },
    signedAt: { type: Date, default: null },
    signatureHash: { type: String, default: null },
  },
  { _id: false },
);

const DocumentSchema = new Schema<DocumentEntity>(
  {
    ownerId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    storageKey: { type: String, required: true, index: true },
    contentType: { type: String, required: true },
    sha256: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['draft', 'pending_signatures', 'signed', 'archived'],
      default: 'draft',
      index: true,
    },
    zones: { type: [SignatureZoneSchema], default: [] },
    participants: { type: [String], default: [], index: true },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'documents' },
);

export const DocumentModel = mongoose.model<DocumentEntity>('Document', DocumentSchema);
