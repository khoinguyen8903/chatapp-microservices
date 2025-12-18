import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { 
  ChatMessage, 
  ChatRoom, 
  TypingMessage, 
  UserStatus, 
  MessageType,
  MessageStatus // [MỚI] Nhớ import Enum này
} from '../models/chat.models'; 
import { Observable, Subject } from 'rxjs';

import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private apiUrl = environment.apiUrl;
  private stompClient: any;
  
  private messageSubject = new Subject<ChatMessage>();
  private typingSubject = new Subject<TypingMessage>(); 
  private statusSubject = new Subject<UserStatus>();
  private callMessageSubject = new Subject<any>();

  // [MỚI] Subject riêng để xử lý việc cập nhật icon trạng thái (Sent -> Seen)
  private messageStatusSubject = new Subject<any>();

  constructor(private http: HttpClient) { }

  // --- API HELPER ---
  uploadImage(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(`${this.apiUrl}/api/v1/media/upload`, formData);
  }

  createGroup(groupName: string, adminId: string, memberIds: string[]): Observable<ChatRoom> {
      const payload = {
          groupName: groupName,
          adminId: adminId,
          memberIds: memberIds
      };
      return this.http.post<ChatRoom>(`${this.apiUrl}/rooms/group`, payload);
  }

  // --- WEBSOCKET CONNECTION ---
  connect(currentUser: any): void {
    if (this.stompClient && this.stompClient.connected) {
      return;
    }
    
    this.stompClient = Stomp.over(() => new SockJS(`${this.apiUrl}/ws`));
    // this.stompClient.debug = () => {}; 

    const _this = this;
    this.stompClient.connect({}, function (frame: any) {
      console.log('Connected to STOMP: ' + frame);

      // 1. Subscribe nhận tin nhắn & sự kiện Chat
      _this.stompClient.subscribe(`/topic/${currentUser.id}`, function (msg: any) {
        if (msg.body) {
          const payload = JSON.parse(msg.body);
          
          // --- [LOGIC MỚI QUAN TRỌNG] Phân loại payload ---

          // CASE 1: Thông báo cập nhật trạng thái (Người kia đã xem tin của mình)
          // Payload: { type: "STATUS_UPDATE", contactId: "...", status: "SEEN" }
          if (payload.type === 'STATUS_UPDATE') {
              _this.messageStatusSubject.next(payload);
              return; // Dừng xử lý, không map thành tin nhắn
          }

          // CASE 2: Sự kiện đang nhập (Typing)
          if (payload.hasOwnProperty('isTyping') || payload.hasOwnProperty('typing')) {
             const isTypingValue = payload.hasOwnProperty('isTyping') ? payload.isTyping : payload.typing;
             const typingMsg: TypingMessage = {
                 senderId: payload.senderId,
                 recipientId: payload.recipientId,
                 isTyping: isTypingValue
             };
             _this.typingSubject.next(typingMsg);
             return;
          } 
          
          // CASE 3: Tin nhắn chat thông thường
          // Mapping tin nhắn nhận được
          const chatMessage: ChatMessage = {
              id: payload.id,
              senderId: payload.senderId,
              recipientId: payload.recipientId, 
              content: payload.content,
              timestamp: new Date(),
              type: payload.type || MessageType.TEXT,
              
              // [MỚI] Map thêm status từ backend gửi về
              status: payload.status || MessageStatus.SENT 
          };

          // [MỚI] Tự động báo đã nhận (DELIVERED) nếu tin nhắn đến từ người khác
          if (payload.senderId !== currentUser.id) {
              _this.markAsDelivered(payload.senderId, currentUser.id);
          }

          _this.messageSubject.next(chatMessage);
        }
      });

      // 2. Subscribe tín hiệu cuộc gọi
      _this.stompClient.subscribe(`/topic/call/${currentUser.id}`, function (msg: any) {
          if (msg.body) {
              const payload = JSON.parse(msg.body);
              _this.callMessageSubject.next(payload);
          }
      });

      // 3. Báo danh Online
      _this.stompClient.send("/app/user.addUser", {}, currentUser.id);
      
    }, function(error: any) {
       console.error('STOMP Connection Error:', error);
       setTimeout(() => _this.connect(currentUser), 5000); 
    });
  }

  // --- [MỚI] HÀM BÁO ĐÃ XEM ---
  // Gọi hàm này khi người dùng click vào đoạn chat
  markAsRead(senderId: string, recipientId: string) {
    if (this.stompClient && this.stompClient.connected) {
        const payload = {
            senderId: senderId,    // Người gửi tin nhắn gốc (Người kia)
            recipientId: recipientId, // Người đang đọc (Là mình)
            status: 'SEEN'
        };
        // Gửi lên endpoint @MessageMapping("/status") ở Backend
        this.stompClient.send('/app/status', {}, JSON.stringify(payload));
    }
  }

  // [MỚI] Hàm báo đã nhận (Delivered) - Gọi tự động khi Socket nhận tin
  markAsDelivered(senderId: string, recipientId: string) {
    if (this.stompClient && this.stompClient.connected) {
        const payload = {
            senderId: senderId,
            recipientId: recipientId,
            status: 'DELIVERED'
        };
        this.stompClient.send('/app/status', {}, JSON.stringify(payload));
    }
  }

  // --- CÁC HÀM CŨ GIỮ NGUYÊN ---

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

  sendCallSignal(payload: any) {
    if (this.stompClient && this.stompClient.connected) {
        this.stompClient.send("/app/call", {}, JSON.stringify(payload));
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

  // --- OBSERVABLES ---

  onMessage(): Observable<ChatMessage> {
    return this.messageSubject.asObservable();
  }

  onTyping(): Observable<TypingMessage> {
    return this.typingSubject.asObservable();
  }

  onCallMessage(): Observable<any> {
    return this.callMessageSubject.asObservable();
  }

  onStatusUpdate(): Observable<UserStatus> {
      return this.statusSubject.asObservable();
  }

  // [MỚI] Observable để Component lắng nghe sự kiện đổi icon status
  onMessageStatusChange(): Observable<any> {
      return this.messageStatusSubject.asObservable();
  }
}