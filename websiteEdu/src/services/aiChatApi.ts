import api from './axiosInstance';

export interface ChatMessage {
  text: string;
  type: 'text' | 'data';
  action?: 'navigate';
  data?: any;
}

export interface ChatRequest {
  message: string;
  conversationHistory?: Array<{
    role?: 'user' | 'assistant';
    text?: string;
    content?: string;
    message?: string;
    isUser?: boolean;
  }>;
}

export const aiChatApi = {
  /**
   * Gửi câu hỏi đến AI chat
   */
  async sendMessage(message: string, conversationHistory?: ChatRequest['conversationHistory']): Promise<ChatMessage> {
    const res = await api.post('/ai-chat/chat', { 
      message,
      conversationHistory: conversationHistory || []
    });
    return res.data;
  },
};















