import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { 
  ChatMessage, 
  ChatRoom, 
  TypingMessage, 
  UserStatus, 
  MessageType 
} from '../models/chat.models'; 
import { Observable, Subject } from 'rxjs';

import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  // Trỏ vào API Gateway (Port 8080)
  private apiUrl = 'http://192.168.1.9:8080'; 
  private stompClient: any;
  
  private messageSubject = new Subject<ChatMessage>();
  private typingSubject = new Subject<TypingMessage>(); 
  private statusSubject = new Subject<UserStatus>();
  // 1. Thêm Subject để bắn tín hiệu sang WebRTCService
  private callMessageSubject = new Subject<any>();

  constructor(private http: HttpClient) { }

  // --- HÀM UPLOAD ẢNH ---
  uploadImage(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(`${this.apiUrl}/api/v1/media/upload`, formData);
  }

  // --- [MỚI] API TẠO NHÓM ---
  // Gọi vào Controller: @PostMapping("/rooms/group")
  createGroup(groupName: string, adminId: string, memberIds: string[]): Observable<ChatRoom> {
      const payload = {
          groupName: groupName,
          adminId: adminId,
          memberIds: memberIds
      };
      return this.http.post<ChatRoom>(`${this.apiUrl}/rooms/group`, payload);
  }

  connect(currentUser: any): void {
    if (this.stompClient && this.stompClient.connected) {
      return;
    }
    
    this.stompClient = Stomp.over(() => new SockJS(`${this.apiUrl}/ws`));
    // this.stompClient.debug = () => {}; // Bỏ comment nếu muốn xem log STOMP

    const _this = this;
    this.stompClient.connect({}, function (frame: any) {
      console.log('Connected to STOMP: ' + frame);

      // 1. Subscribe nhận tin nhắn (Dùng chung cho cả Private và Group)
      // Backend đã tự động định tuyến tin nhắn nhóm vào queue riêng của user này
      _this.stompClient.subscribe(`/topic/${currentUser.id}`, function (msg: any) {
        if (msg.body) {
          const payload = JSON.parse(msg.body);
          
          if (payload.hasOwnProperty('isTyping') || payload.hasOwnProperty('typing')) {
             const isTypingValue = payload.hasOwnProperty('isTyping') ? payload.isTyping : payload.typing;
             const typingMsg: TypingMessage = {
                 senderId: payload.senderId,
                 recipientId: payload.recipientId, // Nếu là nhóm, đây là GroupID
                 isTyping: isTypingValue
             };
             _this.typingSubject.next(typingMsg);
          } else {
             // Mapping tin nhắn nhận được
             const chatMessage: ChatMessage = {
                 id: payload.id,
                 senderId: payload.senderId,
                 // [LƯU Ý]: Nếu là tin nhóm, Backend trả về recipientId = GroupID
                 // Frontend sẽ dùng ID này để biết tin nhắn thuộc về nhóm nào
                 recipientId: payload.recipientId, 
                 content: payload.content,
                 timestamp: new Date(),
                 type: payload.type || MessageType.TEXT 
             };
             _this.messageSubject.next(chatMessage);
          }
        }
      });

      // [MỚI] Subscribe tín hiệu cuộc gọi
      // Nghe tin riêng 1-1
      _this.stompClient.subscribe(`/topic/call/${currentUser.id}`, function (msg: any) {
          if (msg.body) {
              const payload = JSON.parse(msg.body);
              _this.callMessageSubject.next(payload);
          }
      });

      // 2. Báo danh Online
      _this.stompClient.send("/app/user.addUser", {}, currentUser.id);
      
    }, function(error: any) {
       console.error('STOMP Connection Error:', error);
       setTimeout(() => _this.connect(currentUser), 5000); 
    });
  }

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
            // Backend tự phân biệt User hay Group dựa vào recipientId
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

  // 3. Hàm gửi tín hiệu gọi (Signaling)
  sendCallSignal(payload: any) {
    if (this.stompClient && this.stompClient.connected) {
        // payload chính là CallMessage bên Backend
        this.stompClient.send("/app/call", {}, JSON.stringify(payload));
    }
  }

  sendTyping(typingMsg: TypingMessage) {
    if (this.stompClient && this.stompClient.connected) {
        this.stompClient.send("/app/typing", {}, JSON.stringify(typingMsg));
    }
  }

  getChatMessages(senderId: string, recipientId: string): Observable<ChatMessage[]> {
    // Nếu là Chat nhóm: recipientId chính là GroupID
    // Backend service đã handle việc tìm tin nhắn theo GroupID
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

  // 4. Hàm để WebRTCService đăng ký lắng nghe
  onCallMessage(): Observable<any> {
    return this.callMessageSubject.asObservable();
  }

  onStatusUpdate(): Observable<UserStatus> {
      return this.statusSubject.asObservable();
  }
}