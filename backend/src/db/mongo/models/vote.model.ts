import mongoose, { Schema, type Document as MongoDocument } from 'mongoose';

/** Un bulletin anonymisé uniquement par userId (compte Vicinity). */
export interface VoteEntity extends MongoDocument {
  pollId: string;
  userId: string;
  choiceIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

const VoteSchema = new Schema<VoteEntity>(
  {
    pollId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    choiceIndex: { type: Number, required: true, min: 0 },
  },
  { timestamps: true, collection: 'votes' },
);

VoteSchema.index({ pollId: 1, userId: 1 }, { unique: true });

export const VoteModel = mongoose.model<VoteEntity>('Vote', VoteSchema);
