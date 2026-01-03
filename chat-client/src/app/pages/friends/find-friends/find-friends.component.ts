import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, Subject, Subscription, switchMap } from 'rxjs';

import { FriendService } from '../../../services/friend.service';
import { User, Recommendation, FriendStatus } from '../../../models/friend.models';

@Component({
  selector: 'app-find-friends',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './find-friends.component.html',
  styleUrls: ['./find-friends.component.scss']
})
export class FindFriendsComponent implements OnInit {
  // Search
  searchKeyword = '';
  private searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;

  // Data
  searchResults: User[] = [];
  recommendations: Recommendation[] = [];

  // UI State
  loading = false;
  searchLoading = false;
  error: string | null = null;

  // Pagination
  searchPage = 1;
  hasMoreResults = false;

  constructor(
    private friendService: FriendService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadRecommendations();

    // Setup debounced search
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(500),
      distinctUntilChanged(),
      switchMap((keyword) => {
        if (keyword.length < 3) {
          return [];
        }
        this.searchLoading = true;
        return this.friendService.searchUsers(keyword);
      })
    ).subscribe({
      next: (users) => {
        this.searchResults = users;
        this.searchLoading = false;
        this.error = null;
      },
      error: (err) => {
        console.error('Error searching users:', err);
        this.error = 'Không thể tìm kiếm. Vui lòng thử lại.';
        this.searchLoading = false;
      }
    });
  }

  ngOnDestroy(): void {
    if (this.searchSubscription) {
      this.searchSubscription.unsubscribe();
    }
    this.searchSubject.complete();
  }

  // === DATA LOADING ===

  loadRecommendations(): void {
    this.loading = true;
    this.error = null;

    this.friendService.getRecommendations().subscribe({
      next: (recommendations) => {
        this.recommendations = recommendations;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading recommendations:', err);
        this.error = 'Không thể tải gợi ý. Vui lòng thử lại.';
        this.loading = false;
      }
    });
  }

  // === SEARCH ===

  onSearchInput(keyword: string): void {
    this.searchKeyword = keyword;
    this.searchSubject.next(keyword);
  }

  clearSearch(): void {
    this.searchKeyword = '';
    this.searchResults = [];
    this.searchSubject.next('');
  }

  // === FRIEND REQUEST ACTIONS ===

  sendFriendRequest(userId: string, username: string): void {
    const message = prompt(`Gửi lời mời kết bạn đến ${username}:`, 'Xin chào! Hãy kết bạn nhé!');

    if (message === null) return; // User cancelled

    this.searchLoading = true;

    this.friendService.sendFriendRequest(userId, message || undefined).subscribe({
      next: (request) => {
        this.searchLoading = false;
        alert(`Đã gửi lời mời kết bạn đến ${username}!`);

        // Update user status to prevent duplicate requests
        const userIndex = this.searchResults.findIndex(u => u.id === userId);
        if (userIndex !== -1) {
          this.searchResults[userIndex].status = {
            userId,
            status: 'PENDING_REQUEST',
            canSendRequest: false
          } as FriendStatus;
        }
      },
      error: (err) => {
        console.error('Error sending friend request:', err);
        this.searchLoading = false;

        const errorMessage = err.error?.message || err.message || 'Không thể gửi lời mời. Vui lòng thử lại.';
        alert(`Lỗi: ${errorMessage}`);
      }
    });
  }

  // === NAVIGATION ===

  viewProfile(userId: string): void {
    this.router.navigate(['/profile', userId]);
  }

  // === HELPERS ===

  getAvatarUrl(url: string | null): string {
    return url || '/assets/default-avatar.svg';
  }

  // Check if user is already a friend or has pending request
  canSendRequest(user: User): boolean {
    return user.status?.canSendRequest !== false && user.status?.status !== 'ARE_FRIENDS';
  }

  getButtonText(user: User): string {
    if (user.status?.status === 'ARE_FRIENDS') {
      return 'Đã là bạn';
    }
    if (user.status?.status === 'PENDING_REQUEST') {
      return 'Đã gửi lời mời';
    }
    if (user.status?.status === 'BLOCKED') {
      return 'Đã chặn';
    }
    return '📤 Gửi lời mời';
  }

  isButtonDisabled(user: User): boolean {
    return !this.canSendRequest(user);
  }

  // Get status badge class
  getStatusBadgeClass(user: User): string {
    switch (user.status?.status) {
      case 'ARE_FRIENDS':
        return 'badge-friend';
      case 'PENDING_REQUEST':
        return 'badge-pending';
      case 'BLOCKED':
        return 'badge-blocked';
      default:
        return '';
    }
  }

  // Get status text
  getStatusText(user: User): string {
    switch (user.status?.status) {
      case 'ARE_FRIENDS':
        return 'Bạn bè';
      case 'PENDING_REQUEST':
        return 'Đã gửi lời mời';
      case 'BLOCKED':
        return 'Đã chặn';
      default:
        return '';
    }
  }
}

