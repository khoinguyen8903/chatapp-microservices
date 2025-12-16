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
  
  // [FIX 1] Biến lưu ID phòng chat đang mở
  activeRoomId: string | null = null;

  setActiveRoom(roomId: string | null) {
    this.activeRoomId = roomId;
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
      console.log('Message received. ', payload);
      
      // [FIX 1] Nếu đang mở đúng phòng chat của tin nhắn này thì KHÔNG hiện thông báo
      const msgRoomId = payload.data?.['roomId']; // Backend cần gửi roomId trong data
      if (this.activeRoomId && msgRoomId === this.activeRoomId) {
        console.log('🚫 Đang ở trong phòng chat này, chặn thông báo.');
        return; 
      }

      this.currentMessage.next(payload);
      
      // [FIX 3] Backend Java gửi: putData("title", senderName) -> Đây chính là tên người gửi
      // Backend Java gửi: putData("body", messageContent)
      const title = payload.data?.['title'] || 'Tin nhắn mới';
      const body = payload.data?.['body'] || 'Bạn có tin nhắn mới';
      
      alert(`🔔 ${title}: ${body}`);
    });
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