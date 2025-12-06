// 1. Định nghĩa các loại tin nhắn (Khớp với Enum Java)
export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  FILE = 'FILE'
}

export interface ChatMessage {
  id?: string;
  chatId?: string;
  senderId: string;
  recipientId: string;
  content: string; // Nếu type=IMAGE thì đây là URL ảnh
  timestamp?: Date;
  
  // [MỚI] Thêm trường này để phân loại
  // Dấu ? để tương thích với các tin nhắn cũ chưa có type
  type?: MessageType; 
}

export interface ChatRoom {
  id: string;
  chatId: string;
  senderId: string;
  recipientId: string;
  chatName?: string; 
}

export interface TypingMessage {
  senderId: string;
  recipientId: string;
  isTyping: boolean; 
}

export interface UserStatus {
  userId: string;
  status: string;
  lastSeen?: Date;
}