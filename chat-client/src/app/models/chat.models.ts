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
  content: string; // Nếu type=IMAGE/FILE thì đây là URL
  timestamp?: Date;
  
  // Dấu ? để tương thích với các tin nhắn cũ chưa có type
  type?: MessageType; 

  // --- [MỚI] Thêm trường fileName để sửa lỗi TypeScript ---
  fileName?: string; 
}

export interface ChatRoom {
  id: string;
  chatId: string;
  senderId: string;
  recipientId: string;
  
  // Tên hiển thị (Username hoặc Tên nhóm)
  chatName?: string; 

  // Các trường hỗ trợ Chat Nhóm
  isGroup?: boolean;        // Đánh dấu là nhóm
  groupName?: string;       // Tên nhóm (nếu có)
  adminId?: string;         // ID trưởng nhóm
  memberIds?: string[];     // Danh sách thành viên
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