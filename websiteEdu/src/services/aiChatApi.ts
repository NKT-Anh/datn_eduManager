import api from './axiosInstance';

export interface ChatMessage {
  text: string;
  type: 'text' | 'data';
  action?: 'navigate';
  data?: any;
}

export interface ChatRequest {
  message: string;
}

export const aiChatApi = {
  /**
   * Gửi câu hỏi đến AI chat
   */
  async sendMessage(message: string): Promise<ChatMessage> {
    const res = await api.post('/ai-chat/chat', { message });
    return res.data;
  },
};















