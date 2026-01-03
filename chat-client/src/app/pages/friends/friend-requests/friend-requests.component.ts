import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';

import { FriendService } from '../../../services/friend.service';
import { FriendRequest } from '../../../models/friend.models';

@Component({
  selector: 'app-friend-requests',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './friend-requests.component.html',
  styleUrls: ['./friend-requests.component.scss']
})
export class FriendRequestsComponent implements OnInit {
  // Data
  receivedRequests: FriendRequest[] = [];
  sentRequests: FriendRequest[] = [];

  // UI State
  loading = false;
  error: string | null = null;

  private subscriptions: Subscription[] = [];

  constructor(
    private friendService: FriendService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadRequests();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // === DATA LOADING ===

  loadRequests(): void {
    this.loadReceivedRequests();
    this.loadSentRequests();
  }

  loadReceivedRequests(): void {
    this.loading = true;
    this.error = null;

    const sub = this.friendService.getReceivedRequests().subscribe({
      next: (requests) => {
        this.receivedRequests = requests.filter(r => r.status === 'PENDING');
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading received requests:', err);
        this.error = 'Không thể tải lời mời đã nhận';
        this.loading = false;
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

  // === REQUEST ACTIONS ===

  acceptRequest(requestId: string): void {
    const sub = this.friendService.acceptRequest(requestId).subscribe({
      next: () => {
        this.receivedRequests = this.receivedRequests.filter(r => r.id !== requestId);
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

  // === NAVIGATION ===

  viewProfile(userId: string): void {
    this.router.navigate(['/profile', userId]);
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

