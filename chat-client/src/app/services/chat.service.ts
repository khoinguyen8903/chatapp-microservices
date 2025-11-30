import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ChatMessage, ChatRoom } from '../models/chat.models';
import { Observable, Subject } from 'rxjs';

// --- SỬA Ở ĐÂY: Import thư viện thay vì declare var ---
import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';
// -----------------------------------------------------

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private apiUrl = 'http://localhost:8080'; 
  private stompClient: any;
  private messageSubject = new Subject<ChatMessage>();

  constructor(private http: HttpClient) { }

  connect(currentUser: any): void {
    if (this.stompClient && this.stompClient.connected) {
      return;
    }
    
    // 1. Khởi tạo Socket
    const socket = new SockJS(`${this.apiUrl}/ws`); 
    
    // 2. Sử dụng Stomp.over đúng cách với thư viện mới
    this.stompClient = Stomp.over(socket);
    
    // Tắt debug log nếu muốn
    // this.stompClient.debug = () => {}; 

    const _this = this;
    this.stompClient.connect({}, function (frame: any) {
      console.log('Connected to STOMP: ' + frame);

      _this.stompClient.subscribe(`/user/${currentUser.id}/queue/messages`, function (msg: any) {
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
    }, function(error: any) {
       console.error('STOMP Connection Error:', error);
       // Thử kết nối lại sau 5 giây
       setTimeout(() => _this.connect(currentUser), 5000); 
    });
  }

  sendMessage(msg: ChatMessage) {
    if (this.stompClient && this.stompClient.connected) {
        this.stompClient.send("/app/chat", {}, JSON.stringify(msg));
    } else {
        console.error("STOMP client not connected. Message not sent.");
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