/**
 * Friend Model - Represents a friendship relationship
 */
export interface Friend {
  id: string;
  userId: string;
  friendId: string;
  friendUsername: string;
  friendFullName: string;
  friendAvatarUrl: string | null;
  status: string;
  createdAt: string;
}

/**
 * Friend Request Model - Represents a friend request
 */
export interface FriendRequest {
  id: string;
  senderId: string;
  senderUsername: string;
  senderFullName: string;
  senderAvatarUrl: string | null;
  receiverId: string;
  receiverUsername: string;
  receiverFullName: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  message?: string;
  createdAt: string;
}

/**
 * Friend Status Model - Represents friendship status with a user
 */
export interface FriendStatus {
  userId: string;
  status: 'NOT_FRIENDS' | 'PENDING_REQUEST' | 'ARE_FRIENDS' | 'BLOCKED';
  canSendRequest: boolean;
}

/**
 * Blocked User Model - Represents a blocked user
 */
export interface BlockedUser {
  id: string;
  userId: string;
  blockedUserId: string;
  blockedUsername: string;
  blockedFullName: string;
  blockedAvatarUrl: string | null;
  reason?: string;
  createdAt: string;
}

/**
 * Recommendation Model - Represents a recommended user
 */
export interface Recommendation {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  mutualFriends?: number;
  reason?: string;
}

/**
 * User Model - Represents a user in the system
 */
export interface User {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  email?: string;
  status?: FriendStatus;
  mutualFriends?: number;
}

