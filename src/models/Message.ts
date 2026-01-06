import mongoose, { Schema } from 'mongoose';

export interface IMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  model?: string;
  temperature?: number;
}

export const MessageSchema = new Schema<IMessage>({
  role: {
    type: String,
    enum: ['user', 'assistant'],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  model: {
    type: String,
    required: false,
  },
  temperature: {
    type: Number,
    required: false,
  },
});

export default mongoose.models.Message || mongoose.model<IMessage>('Message', MessageSchema);

