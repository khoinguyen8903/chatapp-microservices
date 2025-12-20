import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private http = inject(HttpClient);
  
  // Biến lưu tin nhắn hiện tại để hiển thị Toast/Popup (nếu cần)
  currentMessage = new BehaviorSubject<any>(null);
  
  // [FIX 1] Biến lưu chatId của phòng chat đang mở (updated from roomId to chatId for clarity)
  activeChatId: string | null = null;

  setActiveRoom(chatId: string | null) {
    this.activeChatId = chatId;
    console.log('🔔 [NotificationService] Active chat ID set to:', chatId);
  }

  constructor() {
    this.initFirebase();
  }

  initFirebase() {
    // 1. Khởi tạo Firebase App
    const app = initializeApp(environment.firebase);
    
    // 2. Khởi tạo Messaging
    const messaging = getMessaging(app);

    // 3. Lắng nghe tin nhắn khi đang mở App (Foreground)
    onMessage(messaging, (payload) => {
      console.log('📬 [NotificationService] Message received:', payload);
      
      // Extract chatId and senderId from payload
      const msgChatId = payload.data?.['chatId'] || payload.data?.['roomId'];
      const msgSenderId = payload.data?.['senderId'];
      
      console.log('🔍 [NotificationService] Message chatId:', msgChatId, 
                  'senderId:', msgSenderId, 'Active chatId:', this.activeChatId);
      
      // Skip suppression check if no active chat
      if (!this.activeChatId) {
        console.log('🔔 [NotificationService] No active chat - showing notification');
        this.currentMessage.next(payload);
        this.showNotificationIfNeeded(payload);
        return;
      }
      
      // SMART SUPPRESSION LOGIC - Suppress if ANY condition matches:
      
      // [CHECK 1] Strict Match: For Group Chats where IDs match exactly
      if (msgChatId && msgChatId === this.activeChatId) {
        console.log('✅ [NotificationService] SUPPRESSED - Exact match (Group Chat)');
        return;
      }
      
      // [CHECK 2] Partial Match: For Private Chats with Composite Room IDs (e.g., "UserA_UserB")
      // Backend sends composite ID, frontend stores partner ID
      if (msgChatId && msgChatId.includes(this.activeChatId)) {
        console.log('✅ [NotificationService] SUPPRESSED - Composite room ID contains active partner ID');
        return;
      }
      
      // [CHECK 3] Sender Match: Fallback check for backward compatibility
      if (msgSenderId && msgSenderId === this.activeChatId) {
        console.log('✅ [NotificationService] SUPPRESSED - Message from active chat partner (senderId match)');
        return;
      }

      // If we reach here, none of the suppression conditions matched - show the notification
      console.log('🔔 [NotificationService] Showing notification for inactive chat');
      
      this.currentMessage.next(payload);
      
      this.showNotificationIfNeeded(payload);
    });
  }

  // [NEW] Separate method for showing notifications (easier to customize)
  private showNotificationIfNeeded(payload: any) {
    // Backend Java sends: putData("title", senderName) -> This is the sender's name
    // Backend Java sends: putData("body", messageContent)
    // Priority: senderName from data, fallback to title, finally "Người lạ"
    const senderName = payload.data?.['senderName'] || payload.data?.['title'] || 'Người lạ';
    const body = payload.data?.['body'] || 'Bạn có tin nhắn mới';
    
    this.showNotification(senderName, body);
  }

  // Show notification UI (can be customized with Toast/Snackbar)
  private showNotification(title: string, body: string) {
    // Option 1: Browser alert (simple but intrusive)
    alert(`🔔 ${title}: ${body}`);
    
    // Option 2: You can replace this with Angular Material Snackbar, ngx-toastr, etc.
    // Example with Snackbar:
    // this.snackBar.open(`${title}: ${body}`, 'Close', { duration: 5000 });
  }

  // Hàm xin quyền và lấy Token gửi về Backend
  async requestPermission(userId: string) {
    const messaging = getMessaging();
    
    try {
      // 1. Xin quyền trình duyệt
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        console.log('Notification permission granted.');

        // 2. Lấy Token từ Firebase
        const token = await getToken(messaging, {
          vapidKey: environment.vapidKey
        });

        if (token) {
          console.log('FCM Token:', token);
          // 3. Gửi Token về Backend để lưu vào Redis
          this.sendTokenToBackend(userId, token);
        } else {
          console.log('No registration token available.');
        }
      } else {
        console.log('Unable to get permission to notify.');
      }
    } catch (error) {
      console.log('Error retrieving token:', error);
    }
  }

  private sendTokenToBackend(userId: string, token: string) {
    // Gọi vào API Gateway (Port 8080) -> Gateway sẽ forward sang Notification Service
    const url = `${environment.apiUrl}/api/notifications/token`;
    
    this.http.post(url, { userId, token }, { responseType: 'text' }).subscribe({
      next: (response) => console.log('✅ Token sent to server successfully:', response),
      error: (err) => console.error('❌ Error sending token to server', err)
    });
  }
}