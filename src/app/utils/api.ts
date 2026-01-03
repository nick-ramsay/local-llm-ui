import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface Conversation {
  _id: string;
  title: string;
  model: string;
  temperature: number;
  stream: boolean;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface Model {
  name: string;
  modified_at: string;
}

export const apiClient = {
  // Get all conversations
  getConversations: async (): Promise<Conversation[]> => {
    const response = await api.get('/conversations');
    return response.data.conversations;
  },

  // Get a single conversation
  getConversation: async (id: string): Promise<Conversation> => {
    const response = await api.get(`/conversations/${id}`);
    return response.data.conversation;
  },

  // Create a new conversation
  createConversation: async (data: {
    title?: string;
    model?: string;
    temperature?: number;
  }): Promise<Conversation> => {
    const response = await api.post('/conversations', data);
    return response.data.conversation;
  },

  // Update a conversation
  updateConversation: async (
    id: string,
    data: { title?: string; model?: string; temperature?: number; stream?: boolean }
  ): Promise<Conversation> => {
    const response = await api.put(`/conversations/${id}`, data);
    return response.data.conversation;
  },

  // Delete a conversation
  deleteConversation: async (id: string): Promise<void> => {
    await api.delete(`/conversations/${id}`);
  },

  // Send a chat message
  sendMessage: async (data: {
    conversationId?: string;
    message: string;
    model?: string;
    temperature?: number;
    stream?: boolean;
  }): Promise<{ conversation: Conversation; response: string }> => {
    const response = await api.post('/chat', data);
    return response.data;
  },

  // Get available models
  getModels: async (): Promise<Model[]> => {
    const response = await api.get('/models');
    return response.data.models;
  },
};

