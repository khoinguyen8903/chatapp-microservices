import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ChatMessage, ChatRoom, TypingMessage, UserStatus } from '../models/chat.models'; 
import { Observable, Subject } from 'rxjs';

import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  // Đảm bảo URL này trỏ đúng vào API Gateway (vd: http://localhost:8080)
  private apiUrl = 'http://localhost:8080'; 
  private stompClient: any;
  
  private messageSubject = new Subject<ChatMessage>();
  private typingSubject = new Subject<TypingMessage>(); 
  private statusSubject = new Subject<UserStatus>();

  constructor(private http: HttpClient) { }

  connect(currentUser: any): void {
    if (this.stompClient && this.stompClient.connected) {
      return;
    }
    
    // Sử dụng Factory function để hỗ trợ reconnect
    this.stompClient = Stomp.over(() => new SockJS(`${this.apiUrl}/ws`));
    // this.stompClient.debug = () => {}; 

    const _this = this;
    this.stompClient.connect({}, function (frame: any) {
      console.log('Connected to STOMP: ' + frame);

      // 1. Subscribe nhận tin nhắn
      _this.stompClient.subscribe(`/topic/${currentUser.id}`, function (msg: any) {
        if (msg.body) {
          const payload = JSON.parse(msg.body);
          
          if (payload.hasOwnProperty('isTyping') || payload.hasOwnProperty('typing')) {
             const isTypingValue = payload.hasOwnProperty('isTyping') ? payload.isTyping : payload.typing;
             const typingMsg: TypingMessage = {
                 senderId: payload.senderId,
                 recipientId: payload.recipientId,
                 isTyping: isTypingValue
             };
             _this.typingSubject.next(typingMsg);
          } else {
             const chatMessage: ChatMessage = {
                 senderId: payload.senderId,
                 recipientId: payload.recipientId,
                 content: payload.content,
                 timestamp: new Date()
             };
             _this.messageSubject.next(chatMessage);
          }
        }
      });

      // 2. Báo danh Online ngay khi kết nối
      _this.stompClient.send("/app/user.addUser", {}, currentUser.id);
      
    }, function(error: any) {
       console.error('STOMP Connection Error:', error);
       setTimeout(() => _this.connect(currentUser), 5000); 
    });
  }

  // Lắng nghe trạng thái Real-time
  subscribeToStatus(partnerId: string) {
    if (this.stompClient && this.stompClient.connected) {
        return this.stompClient.subscribe(`/topic/status/${partnerId}`, (msg: any) => {
            if (msg.body) {
                const statusUpdate = JSON.parse(msg.body);
                this.statusSubject.next(statusUpdate as UserStatus);
            }
        });
    }
    return null;
  }

  // --- SỬA ĐƯỜNG DẪN API TẠI ĐÂY ---
  // Đổi thành /rooms/status/{userId} để khớp với ChatController
  getUserStatus(userId: string): Observable<UserStatus> {
      return this.http.get<UserStatus>(`${this.apiUrl}/rooms/status/${userId}`);
  }

  sendMessage(msg: ChatMessage): boolean {
    if (this.stompClient && this.stompClient.connected) {
        try {
            this.stompClient.send("/app/chat", {}, JSON.stringify(msg));
            return true;
        } catch (e) {
            console.error("Error sending message:", e);
            return false;
        }
    } else {
        return false;
    }
  }

  sendTyping(typingMsg: TypingMessage) {
    if (this.stompClient && this.stompClient.connected) {
        this.stompClient.send("/app/typing", {}, JSON.stringify(typingMsg));
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

  onTyping(): Observable<TypingMessage> {
    return this.typingSubject.asObservable();
  }

  onStatusUpdate(): Observable<UserStatus> {
      return this.statusSubject.asObservable();
  }
}