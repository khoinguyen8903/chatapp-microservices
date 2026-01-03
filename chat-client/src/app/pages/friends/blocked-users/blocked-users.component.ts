import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

import { FriendService } from '../../../services/friend.service';
import { BlockedUser } from '../../../models/friend.models';

@Component({
  selector: 'app-blocked-users',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './blocked-users.component.html',
  styleUrls: ['./blocked-users.component.scss']
})
export class BlockedUsersComponent implements OnInit {
  // Data
  blockedUsers: BlockedUser[] = [];

  // UI State
  loading = false;
  error: string | null = null;

  private subscriptions: Subscription[] = [];

  constructor(private friendService: FriendService) { }

  ngOnInit(): void {
    this.loadBlockedUsers();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // === DATA LOADING ===

  loadBlockedUsers(): void {
    this.loading = true;
    this.error = null;

    const sub = this.friendService.getBlockedUsers().subscribe({
      next: (users) => {
        this.blockedUsers = users;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading blocked users:', err);
        this.error = 'Không thể tải danh sách chặn';
        this.loading = false;
      }
    });

    this.subscriptions.push(sub);
  }

  // === BLOCK ACTIONS ===

  unblockUser(userId: string, username: string): void {
    if (!confirm(`Bạn có chắc chắn muốn bỏ chặn ${username}?`)) {
      return;
    }

    const sub = this.friendService.unblockUser(userId).subscribe({
      next: () => {
        this.blockedUsers = this.blockedUsers.filter(u => u.blockedUserId !== userId);
        alert(`Đã bỏ chặn ${username}`);
      },
      error: (err) => {
        console.error('Error unblocking user:', err);
        alert('Không thể bỏ chặn. Vui lòng thử lại.');
      }
    });

    this.subscriptions.push(sub);
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
}

