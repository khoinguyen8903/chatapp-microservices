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
  
  // Tên hiển thị (Username) thay vì UUID
  chatName?: string; 
}

// Dùng cho tính năng "Đang nhập..."
export interface TypingMessage {
  senderId: string;
  recipientId: string;
  isTyping: boolean; 
}

// --- MỚI THÊM: Dùng cho tính năng Online/Offline ---
export interface UserStatus {
  userId: string;
  status: string; // 'ONLINE' hoặc 'OFFLINE'
  lastSeen?: Date; // Có thể null nếu đang online hoặc chưa từng online
}