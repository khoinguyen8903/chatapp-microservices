import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { FriendService } from '../../services/friend.service';
import { Friend, FriendRequest, BlockedUser } from '../../models/friend.models';
import { AuthService } from '../../services/auth.service';

import { FindFriendsComponent } from './find-friends/find-friends.component';

@Component({
  selector: 'app-friends',
  standalone: true,
  imports: [CommonModule, FormsModule, FindFriendsComponent],
  templateUrl: './friends.component.html',
  styleUrls: ['./friends.component.scss']
})
export class FriendsComponent implements OnInit, OnDestroy {
  // Tab management
  activeTab: 'friends' | 'requests' | 'find' | 'blocked' = 'friends';

  // Data
  friends: Friend[] = [];
  receivedRequests: FriendRequest[] = [];
  sentRequests: FriendRequest[] = [];
  blockedUsers: BlockedUser[] = [];

  // UI State
  loading = false;
  error: string | null = null;

  // Counts
  pendingRequestsCount = 0;
  totalFriends = 0;

  // Search
  searchKeyword = '';

  private subscriptions: Subscription[] = [];

  constructor(
    private friendService: FriendService,
    private authService: AuthService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // === DATA LOADING ===

  loadData(): void {
    this.loadFriends();
    this.loadReceivedRequests();
    this.loadSentRequests();
    this.loadBlockedUsers();
  }

  loadFriends(): void {
    this.loading = true;
    this.error = null;

    const sub = this.friendService.getFriends().subscribe({
      next: (friends) => {
        this.friends = friends;
        this.totalFriends = friends.length;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading friends:', err);
        this.error = 'Không thể tải danh sách bạn bè';
        this.loading = false;
      }
    });

    this.subscriptions.push(sub);
  }

  loadReceivedRequests(): void {
    const sub = this.friendService.getReceivedRequests().subscribe({
      next: (requests) => {
        this.receivedRequests = requests.filter(r => r.status === 'PENDING');
        this.pendingRequestsCount = this.receivedRequests.length;
      },
      error: (err) => {
        console.error('Error loading received requests:', err);
      }
    });

    this.subscriptions.push(sub);
  }

  loadSentRequests(): void {
    const sub = this.friendService.getSentRequests().subscribe({
      next: (requests) => {
        this.sentRequests = requests.filter(r => r.status === 'PENDING');
      },
      error: (err) => {
        console.error('Error loading sent requests:', err);
      }
    });

    this.subscriptions.push(sub);
  }

  loadBlockedUsers(): void {
    const sub = this.friendService.getBlockedUsers().subscribe({
      next: (users) => {
        this.blockedUsers = users;
      },
      error: (err) => {
        console.error('Error loading blocked users:', err);
      }
    });

    this.subscriptions.push(sub);
  }

  // === TAB NAVIGATION ===

  setActiveTab(tab: 'friends' | 'requests' | 'find' | 'blocked'): void {
    this.activeTab = tab;
    this.error = null;
  }

  // === FRIEND ACTIONS ===

  unfriend(friendId: string): void {
    if (!confirm('Bạn có chắc chắn muốn hủy kết bạn?')) {
      return;
    }

    const sub = this.friendService.unfriend(friendId).subscribe({
      next: () => {
        this.friends = this.friends.filter(f => f.friendId !== friendId);
        this.totalFriends = this.friends.length;
        this.loadFriends(); // Refresh list
      },
      error: (err) => {
        console.error('Error unfriending:', err);
        alert('Không thể hủy kết bạn. Vui lòng thử lại.');
      }
    });

    this.subscriptions.push(sub);
  }

  blockUser(userId: string, username: string): void {
    const reason = prompt(`Tại sao bạn muốn chặn ${username}?`, 'Spam/Quấy rối');
    if (reason === null) return; // User cancelled

    const sub = this.friendService.blockUser(userId, reason || undefined).subscribe({
      next: () => {
        this.friends = this.friends.filter(f => f.friendId !== userId);
        this.totalFriends = this.friends.length;
        this.loadBlockedUsers(); // Refresh blocked list
        alert(`Đã chặn ${username}`);
      },
      error: (err) => {
        console.error('Error blocking user:', err);
        alert('Không thể chặn người dùng. Vui lòng thử lại.');
      }
    });

    this.subscriptions.push(sub);
  }

  // === FRIEND REQUEST ACTIONS ===

  acceptRequest(requestId: string): void {
    const sub = this.friendService.acceptRequest(requestId).subscribe({
      next: () => {
        this.receivedRequests = this.receivedRequests.filter(r => r.id !== requestId);
        this.pendingRequestsCount = this.receivedRequests.length;
        this.loadFriends(); // Refresh friends list
      },
      error: (err) => {
        console.error('Error accepting request:', err);
        alert('Không thể chấp nhận lời mời. Vui lòng thử lại.');
      }
    });

    this.subscriptions.push(sub);
  }

  rejectRequest(requestId: string): void {
    if (!confirm('Bạn có chắc chắn muốn từ chối lời mời này?')) {
      return;
    }

    const sub = this.friendService.rejectRequest(requestId).subscribe({
      next: () => {
        this.receivedRequests = this.receivedRequests.filter(r => r.id !== requestId);
        this.pendingRequestsCount = this.receivedRequests.length;
      },
      error: (err) => {
        console.error('Error rejecting request:', err);
        alert('Không thể từ chối lời mời. Vui lòng thử lại.');
      }
    });

    this.subscriptions.push(sub);
  }

  cancelRequest(requestId: string): void {
    if (!confirm('Bạn có chắc chắn muốn hủy lời mời này?')) {
      return;
    }

    const sub = this.friendService.cancelRequest(requestId).subscribe({
      next: () => {
        this.sentRequests = this.sentRequests.filter(r => r.id !== requestId);
      },
      error: (err) => {
        console.error('Error cancelling request:', err);
        alert('Không thể hủy lời mời. Vui lòng thử lại.');
      }
    });

    this.subscriptions.push(sub);
  }

  // === BLOCK ACTIONS ===

  unblockUser(userId: string): void {
    if (!confirm('Bạn có chắc chắn muốn bỏ chặn người dùng này?')) {
      return;
    }

    const sub = this.friendService.unblockUser(userId).subscribe({
      next: () => {
        this.blockedUsers = this.blockedUsers.filter(u => u.blockedUserId !== userId);
      },
      error: (err) => {
        console.error('Error unblocking user:', err);
        alert('Không thể bỏ chặn. Vui lòng thử lại.');
      }
    });

    this.subscriptions.push(sub);
  }

  // === NAVIGATION ===

  viewProfile(userId: string): void {
    this.router.navigate(['/profile', userId]);
  }

  openChat(friendId: string): void {
    this.router.navigate(['/chat'], { queryParams: { userId: friendId } });
  }

  // === HELPERS ===

  getAvatarUrl(url: string | null): string {
    return url || '/assets/default-avatar.svg';
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return date.toLocaleDateString('vi-VN');
  }

  getStatusText(status: string): string {
    const statusMap: Record<string, string> = {
      'ACTIVE': 'Hoạt động',
      'OFFLINE': 'Offline',
      'AWAY': 'Vắng mặt'
    };
    return statusMap[status] || status;
  }

  // Refresh data when switching tabs
  onTabChange(tab: 'friends' | 'requests' | 'find' | 'blocked'): void {
    this.setActiveTab(tab);

    switch (tab) {
      case 'friends':
        this.loadFriends();
        break;
      case 'requests':
        this.loadReceivedRequests();
        this.loadSentRequests();
        break;
      case 'blocked':
        this.loadBlockedUsers();
        break;
    }
  }
}

