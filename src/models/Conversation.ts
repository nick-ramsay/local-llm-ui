import mongoose, { Schema, Document } from 'mongoose';
import { IMessage, MessageSchema } from './Message';

export interface IConversation extends Document {
  title: string;
  messages: IMessage[];
  model: string;
  temperature: number;
  stream: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    title: {
      type: String,
      required: true,
      default: 'New Conversation',
    },
    messages: {
      type: [MessageSchema],
      default: [],
    },
    model: {
      type: String,
      required: true,
      default: 'gemma3:12b',
    },
    temperature: {
      type: Number,
      required: true,
      default: 0.7,
      min: 0,
      max: 2,
    },
    stream: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.Conversation || mongoose.model<IConversation>('Conversation', ConversationSchema);

