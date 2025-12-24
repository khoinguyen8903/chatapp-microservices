// src/app/models/chat.models.ts

// 1. Enum Loại tin nhắn
export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  FILE = 'FILE',
  AUDIO = 'AUDIO'
}
export enum MessageStatus {
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  SEEN = 'SEEN'
}

export interface MessageReaction {
  userId: string;
  type: string; // emoji char, e.g. "❤️"
}

// 2. Interface Tin nhắn (Khớp với Java Backend)
export interface ChatMessage {
  id?: string;
  chatId?: string;      // ID phòng chat (Quan trọng với Group)
  senderId: string;
  recipientId: string;  // Với Group, cái này là ID nhóm
  content: string;
  timestamp?: Date;
  type?: MessageType;
  fileName?: string;    // Tên file (nếu có)
  status?: MessageStatus;
  senderName?: string;  
  reactions?: MessageReaction[];
  // UI-only helper (hover state for reactions)
  showReactionBar?: boolean;
  // UI-only helper (custom audio player state)
  isPlaying?: boolean;
  // UI-only helper (mobile: toggle status info on tap)
  showStatus?: boolean;
  
  // [NEW] Reply feature
  replyToId?: string;   // ID of the message being replied to
  replyToMessage?: ChatMessage; // UI-only: The full message object being replied to (for display)
  
  // [NEW] Message revoke status
  messageStatus?: 'SENT' | 'REVOKED'; // null or 'SENT' means normal, 'REVOKED' means unsent
  
  // [NEW] Delete for me feature (UI doesn't need this, backend filters it out)
  deletedForUsers?: string[];
}

// 3. Interface Chat Room (Mapping trực tiếp từ JSON API Backend)
export interface ChatRoom {
  id: string;
  chatId: string;
  senderId: string;
  recipientId: string;
  
  // Các trường Group từ Java Backend
  isGroup: boolean;     // [QUAN TRỌNG] Khớp với @JsonProperty("isGroup")
  groupName?: string;
  adminId?: string;
  memberIds?: string[]; // Backend trả về List<String>
  
  // [UNREAD MESSAGE FIELDS] Must match Java ChatRoom
  lastMessage?: string;           // Preview of the last message
  lastMessageTimestamp?: Date;    // Timestamp of the last message
  unreadCount?: number;           // Calculated by backend
}

export interface ChatSession {
  // ID định danh:
  // - Nếu là User: id = userId đối phương
  // - Nếu là Group: id = groupId (chatId)
  id: string;
  
  // Tên hiển thị:
  // - Nếu là User: Tên người đó
  // - Nếu là Group: Tên nhóm
  name: string;
  
  avatar?: string;       // URL Avatar
  
  type: 'PRIVATE' | 'GROUP'; // Cờ để phân biệt loại chat
  
  // Dành riêng cho User
  status?: 'ONLINE' | 'OFFLINE';
  lastSeen?: Date;
  
  // Dành riêng cho Group
  memberCount?: number;  // Số lượng thành viên
  
  // Unread message indicators and preview
  lastMessage?: string;  // Preview of the last message
  lastMessageTimestamp?: Date;  // Timestamp of the last message
  // UI-only: used to sync sidebar preview on message updates (revoke/edit) without relying on timestamps
  lastMessageId?: string;
  unreadCount: number;   // Number of unread messages
}

// 5. Các interface phụ trợ khác
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