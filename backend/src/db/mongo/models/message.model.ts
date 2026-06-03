import mongoose, { Schema, type Document as MongoDocument } from 'mongoose';

export interface MessageAttachment {
  storageKey: string;
  contentType: string;
  size: number;
  kind: 'image' | 'audio' | 'video' | 'file';
}

export interface MessageEntity extends MongoDocument {
  conversationId: string;
  senderId: string;
  body: string;
  attachments: MessageAttachment[];
  readBy: string[];
  deliveredTo: string[];
  editedAt?: Date | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const MessageAttachmentSchema = new Schema<MessageAttachment>(
  {
    storageKey: { type: String, required: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true, min: 0 },
    kind: { type: String, enum: ['image', 'audio', 'video', 'file'], required: true },
  },
  { _id: false },
);

const MessageSchema = new Schema<MessageEntity>(
  {
    conversationId: { type: String, required: true, index: true },
    senderId: { type: String, required: true, index: true },
    body: { type: String, default: '' },
    attachments: { type: [MessageAttachmentSchema], default: [] },
    readBy: { type: [String], default: [] },
    deliveredTo: { type: [String], default: [] },
    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'messages' },
);

MessageSchema.index({ conversationId: 1, createdAt: -1 });

export const MessageModel = mongoose.model<MessageEntity>('Message', MessageSchema);
