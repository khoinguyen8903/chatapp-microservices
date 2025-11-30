export interface ChatMessage {
  id?: string;
  chatId?: string;
  senderId: string;
  recipientId: string;
  content: string;
  timestamp?: Date;
}

export interface ChatRoom {
  id: string;
  chatId: string;
  senderId: string;
  recipientId: string;
}