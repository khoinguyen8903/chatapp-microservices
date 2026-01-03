import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { Friend } from '../../../../../models/friend.models';

@Component({
  selector: 'app-friend-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './friend-card.component.html',
  styleUrls: ['./friend-card.component.scss']
})
export class FriendCardComponent {
  @Input() friend!: Friend;
  @Input() showActions: boolean = true;

  @Output() chat = new EventEmitter<string>();
  @Output() unfriend = new EventEmitter<string>();
  @Output() block = new EventEmitter<string>();
  @Output() viewProfile = new EventEmitter<string>();

  constructor(private router: Router) { }

  getAvatarUrl(): string {
    return this.friend.friendAvatarUrl || '/assets/default-avatar.svg';
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

  onChat(): void {
    this.chat.emit(this.friend.friendId);
  }

  onUnfriend(): void {
    if (confirm(`Bạn có chắc chắn muốn hủy kết bạn với ${this.friend.friendFullName}?`)) {
      this.unfriend.emit(this.friend.friendId);
    }
  }

  onBlock(): void {
    this.block.emit(this.friend.friendId);
  }

  onViewProfile(): void {
    this.viewProfile.emit(this.friend.friendId);
  }
}

