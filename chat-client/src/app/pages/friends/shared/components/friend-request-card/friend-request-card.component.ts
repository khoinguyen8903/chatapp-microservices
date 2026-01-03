import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

import { FriendRequest } from '../../../../../models/friend.models';

@Component({
  selector: 'app-friend-request-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './friend-request-card.component.html',
  styleUrls: ['./friend-request-card.component.scss']
})
export class FriendRequestCardComponent {
  @Input() request!: FriendRequest;
  @Input() isSent: boolean = false;

  @Output() accept = new EventEmitter<string>();
  @Output() reject = new EventEmitter<string>();
  @Output() cancel = new EventEmitter<string>();
  @Output() viewProfile = new EventEmitter<string>();

  getAvatarUrl(): string {
    if (this.isSent) {
      return '/assets/default-avatar.svg';
    }
    return this.request.senderAvatarUrl || '/assets/default-avatar.svg';
  }

  getUsername(): string {
    return this.isSent ? this.request.receiverUsername : this.request.senderUsername;
  }

  getFullName(): string {
    return this.isSent
      ? this.request.receiverFullName
      : this.request.senderFullName;
  }

  getUserId(): string {
    return this.isSent ? this.request.receiverId : this.request.senderId;
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

  onAccept(): void {
    this.accept.emit(this.request.id);
  }

  onReject(): void {
    if (confirm('Bạn có chắc chắn muốn từ chối lời mời này?')) {
      this.reject.emit(this.request.id);
    }
  }

  onCancel(): void {
    if (confirm('Bạn có chắc chắn muốn hủy lời mời này?')) {
      this.cancel.emit(this.request.id);
    }
  }

  onViewProfile(): void {
    this.viewProfile.emit(this.getUserId());
  }
}

