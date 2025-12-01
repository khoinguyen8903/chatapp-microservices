import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ChatMessage, ChatRoom } from '../models/chat.models';
import { Observable, Subject } from 'rxjs';

import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private apiUrl = 'http://localhost:8080'; 
  private stompClient: any;
  private messageSubject = new Subject<ChatMessage>();

  constructor(private http: HttpClient) { }

  connect(currentUser: any): void {
    // Nếu đã kết nối rồi thì không kết nối lại
    if (this.stompClient && this.stompClient.connected) {
      return;
    }
    
    // Sử dụng Factory function cho SockJS để hỗ trợ reconnect khi mất mạng
    this.stompClient = Stomp.over(() => new SockJS(`${this.apiUrl}/ws`));
    
    // Tắt debug log nếu muốn console gọn gàng
    // this.stompClient.debug = () => {}; 

    const _this = this;
    this.stompClient.connect({}, function (frame: any) {
      console.log('Connected to STOMP: ' + frame);

      // --- CẬP NHẬT QUAN TRỌNG: Subscribe vào Topic riêng của User ---
      // Lắng nghe: /topic/{ID_CỦA_TÔI}
      _this.stompClient.subscribe(`/topic/${currentUser.id}`, function (msg: any) {
        if (msg.body) {
          const notification = JSON.parse(msg.body);
          const chatMessage: ChatMessage = {
             senderId: notification.senderId,
             recipientId: notification.recipientId,
             content: notification.content,
             timestamp: new Date()
          };
          _this.messageSubject.next(chatMessage);
        }
      });
      // ---------------------------------------------------------
      
    }, function(error: any) {
       console.error('STOMP Connection Error:', error);
       // Thử kết nối lại sau 5 giây nếu bị ngắt kết nối
       setTimeout(() => _this.connect(currentUser), 5000); 
    });
  }

  // --- CẬP NHẬT: Trả về boolean để Component biết kết quả gửi ---
  sendMessage(msg: ChatMessage): boolean {
    if (this.stompClient && this.stompClient.connected) {
        try {
            this.stompClient.send("/app/chat", {}, JSON.stringify(msg));
            return true; // Gửi thành công
        } catch (e) {
            console.error("Error sending message:", e);
            return false; // Lỗi khi gửi
        }
    } else {
        console.error("STOMP client not connected.");
        return false; // Mất kết nối
    }
  }

  getChatMessages(senderId: string, recipientId: string): Observable<ChatMessage[]> {
    return this.http.get<ChatMessage[]>(`${this.apiUrl}/messages/${senderId}/${recipientId}`);
  }

  getChatRooms(userId: string): Observable<ChatRoom[]> {
    return this.http.get<ChatRoom[]>(`${this.apiUrl}/rooms/${userId}`);
  }

  onMessage(): Observable<ChatMessage> {
    return this.messageSubject.asObservable();
  }
}