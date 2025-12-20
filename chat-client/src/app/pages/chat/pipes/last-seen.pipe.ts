import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'lastSeen',
  standalone: true,
  pure: true  // ✅ Changed to pure pipe for better performance
})
export class LastSeenPipe implements PipeTransform {
  transform(lastSeen: Date | null, status: string): string {
    if (status === 'ONLINE') return 'Active now';
    if (!lastSeen) return 'Active long time ago';

    const now = new Date();
    // Đảm bảo lastSeen là đối tượng Date
    const dateSent = new Date(lastSeen);
    const diff = Math.floor((now.getTime() - dateSent.getTime()) / 1000);

    if (diff < 60) return 'Active just now';
    if (diff < 3600) return `Active ${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `Active ${Math.floor(diff / 3600)} hours ago`;
    if (diff < 2592000) return `Active ${Math.floor(diff / 86400)} days ago`;
    return 'Active a long time ago';
  }
}
