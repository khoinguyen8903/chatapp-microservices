import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ChatMessage, ChatRoom, TypingMessage } from '../models/chat.models'; 
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
  private typingSubject = new Subject<TypingMessage>(); 

  constructor(private http: HttpClient) { }

  connect(currentUser: any): void {
    if (this.stompClient && this.stompClient.connected) {
      return;
    }
    
    // Sử dụng Factory function cho SockJS để hỗ trợ reconnect
    this.stompClient = Stomp.over(() => new SockJS(`${this.apiUrl}/ws`));
    // this.stompClient.debug = () => {}; 

    const _this = this;
    this.stompClient.connect({}, function (frame: any) {
      console.log('Connected to STOMP: ' + frame);

      _this.stompClient.subscribe(`/topic/${currentUser.id}`, function (msg: any) {
        if (msg.body) {
          const payload = JSON.parse(msg.body);
          
          // --- SỬA LOGIC KIỂM TRA CHO CHẮC CHẮN ---
          // Kiểm tra xem có trường 'isTyping' HOẶC 'typing' không
          // (Phòng trường hợp Backend Java tự động bỏ chữ "is" khi serialize)
          if (payload.hasOwnProperty('isTyping') || payload.hasOwnProperty('typing')) {
             
             // Lấy giá trị đúng
             const isTypingValue = payload.hasOwnProperty('isTyping') ? payload.isTyping : payload.typing;
             
             const typingMsg: TypingMessage = {
                 senderId: payload.senderId,
                 recipientId: payload.recipientId,
                 isTyping: isTypingValue
             };
             _this.typingSubject.next(typingMsg);

          } else {
             // Đây là tin nhắn Chat bình thường
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
      
    }, function(error: any) {
       console.error('STOMP Connection Error:', error);
       setTimeout(() => _this.connect(currentUser), 5000); 
    });
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
        console.error("STOMP client not connected.");
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
}