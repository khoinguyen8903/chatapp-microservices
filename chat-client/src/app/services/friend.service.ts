import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import {
  Friend,
  FriendRequest,
  FriendStatus,
  BlockedUser,
  Recommendation,
  User
} from '../models/friend.models';

@Injectable({
  providedIn: 'root'
})
export class FriendService {
  private baseUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) { }

  // === AUTH HELPERS ===

  /**
   * Get auth headers for API requests
   */
  private getHeaders() {
    const token = this.authService.getToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  // === FRIEND MANAGEMENT ===

  /**
   * Get list of friends
   */
  getFriends(): Observable<Friend[]> {
    return this.http.get<Friend[]>(`${this.baseUrl}/api/friends`, {
      headers: this.getHeaders()
    });
  }

  /**
   * Get friendship status with a user
   */
  getFriendStatus(userId: string): Observable<FriendStatus> {
    return this.http.get<FriendStatus>(`${this.baseUrl}/api/friends/${userId}/status`, {
      headers: this.getHeaders()
    });
  }

  /**
   * Unfriend a user
   */
  unfriend(friendId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/api/friends/${friendId}`, {
      headers: this.getHeaders()
    });
  }

  // === FRIEND REQUEST MANAGEMENT ===

  /**
   * Send friend request
   */
  sendFriendRequest(receiverId: string, message?: string): Observable<FriendRequest> {
    return this.http.post<FriendRequest>(
      `${this.baseUrl}/api/friends/requests/send`,
      { receiverId, message },
      { headers: this.getHeaders() }
    );
  }

  /**
   * Get received friend requests
   */
  getReceivedRequests(): Observable<FriendRequest[]> {
    return this.http.get<FriendRequest[]>(
      `${this.baseUrl}/api/friends/requests/received`,
      { headers: this.getHeaders() }
    );
  }

  /**
   * Get sent friend requests
   */
  getSentRequests(): Observable<FriendRequest[]> {
    return this.http.get<FriendRequest[]>(
      `${this.baseUrl}/api/friends/requests/sent`,
      { headers: this.getHeaders() }
    );
  }

  /**
   * Accept friend request
   */
  acceptRequest(requestId: string): Observable<void> {
    return this.http.put<void>(
      `${this.baseUrl}/api/friends/requests/${requestId}/accept`,
      {},
      { headers: this.getHeaders() }
    );
  }

  /**
   * Reject friend request
   */
  rejectRequest(requestId: string): Observable<void> {
    return this.http.put<void>(
      `${this.baseUrl}/api/friends/requests/${requestId}/reject`,
      {},
      { headers: this.getHeaders() }
    );
  }

  /**
   * Cancel friend request
   */
  cancelRequest(requestId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/api/friends/requests/${requestId}`,
      { headers: this.getHeaders() }
    );
  }

  // === BLOCK MANAGEMENT ===

  /**
   * Block a user
   */
  blockUser(userId: string, reason?: string): Observable<void> {
    const url = reason
      ? `${this.baseUrl}/api/friends/${userId}/block?reason=${encodeURIComponent(reason)}`
      : `${this.baseUrl}/api/friends/${userId}/block`;

    return this.http.post<void>(url, {}, { headers: this.getHeaders() });
  }

  /**
   * Unblock a user
   */
  unblockUser(userId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/api/friends/${userId}/block`,
      { headers: this.getHeaders() }
    );
  }

  /**
   * Get blocked users
   */
  getBlockedUsers(): Observable<BlockedUser[]> {
    return this.http.get<BlockedUser[]>(
      `${this.baseUrl}/api/friends/blocked`,
      { headers: this.getHeaders() }
    );
  }

  // === RECOMMENDATIONS & SEARCH ===

  /**
   * Get friend recommendations
   */
  getRecommendations(): Observable<Recommendation[]> {
    return this.http.get<Recommendation[]>(
      `${this.baseUrl}/api/friends/recommendations`,
      { headers: this.getHeaders() }
    );
  }

  /**
   * Search users by keyword
   * Note: Search is handled by auth-service, not friend-service
   */
  searchUsers(keyword: string): Observable<User[]> {
    return this.http.get<User[]>(
      `${this.baseUrl}/users/search?keyword=${encodeURIComponent(keyword)}`,
      { headers: this.getHeaders() }
    );
  }
}

