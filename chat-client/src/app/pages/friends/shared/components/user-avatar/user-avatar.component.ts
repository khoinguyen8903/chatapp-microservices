import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-user-avatar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-avatar.component.html',
  styleUrls: ['./user-avatar.component.scss']
})
export class UserAvatarComponent {
  @Input() avatarUrl: string | null = null;
  @Input() username: string = '';
  @Input() fullName: string = '';
  @Input() size: 'sm' | 'md' | 'lg' | 'xl' = 'md';
  @Input() showStatus: boolean = false;
  @Input() status: 'online' | 'offline' | 'away' = 'offline';

  constructor(private sanitizer: DomSanitizer) { }

  getAvatarUrl(): SafeUrl | string {
    if (this.avatarUrl && this.avatarUrl.startsWith('data:')) {
      return this.sanitizer.bypassSecurityTrustUrl(this.avatarUrl);
    }
    return this.avatarUrl || '/assets/default-avatar.svg';
  }

  getInitials(): string {
    const name = this.fullName || this.username;
    if (!name) return '?';

    const parts = name.trim().split(' ');
    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase();
    }
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  getSizeClass(): string {
    const sizeMap: Record<string, string> = {
      sm: 'w-8 h-8 text-sm',
      md: 'w-12 h-12 text-base',
      lg: 'w-16 h-16 text-xl',
      xl: 'w-24 h-24 text-3xl'
    };
    return sizeMap[this.size] || sizeMap['md'];
  }

  getStatusClass(): string {
    const statusMap: Record<string, string> = {
      online: 'bg-green-500',
      offline: 'bg-gray-400',
      away: 'bg-yellow-500'
    };
    return statusMap[this.status] || statusMap['offline'];
  }
}

