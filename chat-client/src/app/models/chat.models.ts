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
  // Dùng dấu ? vì dữ liệu từ DB có thể chưa có trường này ngay
  chatName?: string; 
}

// --- MỚI THÊM: Dùng cho tính năng "Đang nhập..." ---
export interface TypingMessage {
  senderId: string;
  recipientId: string;
  isTyping: boolean; // true = đang gõ, false = đã dừng
}