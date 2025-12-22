import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { 
  ChatMessage, 
  MessageReaction,
  ChatRoom, 
  TypingMessage, 
  UserStatus, 
  MessageType,
  MessageStatus 
} from '../models/chat.models'; 
import { Observable, Subject } from 'rxjs';
import { AuthService } from './auth.service'; 

import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private apiUrl = environment.apiUrl;
  private stompClient: any;
  
  private messageSubject = new Subject<ChatMessage>();
  private messageUpdateSubject = new Subject<ChatMessage>(); // reactions / edits
  private typingSubject = new Subject<TypingMessage>(); 
  private statusSubject = new Subject<UserStatus>();
  private callMessageSubject = new Subject<any>();
  private messageStatusSubject = new Subject<any>();

  private activeChatId: string | null = null;
  private activeChatSubscription: any = null;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) { }

  // --- API HELPER ---
  uploadImage(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(`${this.apiUrl}/api/v1/media/upload`, formData);
  }

  /**
   * Upload file for chat attachments (alias of uploadImage).
   * NOTE: Kept to match UI expectation: chatService.uploadFile(file)
   */
  uploadFile(file: File): Observable<any> {
    return this.uploadImage(file);
  }

  createGroup(groupName: string, adminId: string, memberIds: string[]): Observable<ChatRoom> {
      const payload = { groupName, adminId, memberIds };
      return this.http.post<ChatRoom>(`${this.apiUrl}/rooms/group`, payload);
  }

  // --- WEBSOCKET CONNECTION ---
  connect(currentUser: any): void {
    if (this.stompClient && this.stompClient.connected) {
      return;
    }
    
    // 👇 [FIX QUAN TRỌNG NHẤT] Gắn Token vào URL Query Param
    const token = this.authService.getToken();
    let socketUrl = `${this.apiUrl}/ws`;
    
    if (token) {
        socketUrl += `?token=${token}`; // Gateway sẽ đọc token từ đây
        console.log('🔐 [ChatService] Appending token to WebSocket URL');
    }

    // Tạo SockJS với URL đã có token
    this.stompClient = Stomp.over(() => new SockJS(socketUrl));
    
    // Tùy chọn: Vẫn giữ Header trong gói STOMP để dự phòng (nhưng Gateway dùng URL là chính)
    const connectHeaders: any = token ? { 'Authorization': `Bearer ${token}` } : {};
    
    const _this = this;
    this.stompClient.connect(connectHeaders, function (frame: any) {
      console.log('✅ Connected to STOMP: ' + frame);

      // Subscribe logic
      _this.stompClient.subscribe(`/topic/${currentUser.id}`, function (msg: any) {
        if (msg.body) {
          const payload = JSON.parse(msg.body);
          
          if (payload.type === 'STATUS_UPDATE') {
              _this.messageStatusSubject.next(payload);
              return; 
          }

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
          
          const chatMessage: ChatMessage = {
              id: payload.id,
              chatId: payload.chatId,  // [CRITICAL] Explicit chatId from backend
              senderId: payload.senderId,
              recipientId: payload.recipientId, 
              content: payload.content,
              fileName: payload.fileName, // Include original filename for file attachments
              timestamp: new Date(),
              type: payload.type || MessageType.TEXT,
              status: payload.status || MessageStatus.SENT,
              reactions: (payload.reactions || []) as MessageReaction[]
          };

          // [CRITICAL FIX] Only mark as DELIVERED if message is not already SEEN
          // Check the incoming message status to prevent backward transitions
          if (payload.senderId !== currentUser.id) {
              const incomingStatus = payload.status || MessageStatus.SENT;
              
              // Only call markAsDelivered if the message is still SENT
              // This prevents SEEN messages from being reverted to DELIVERED on reload
              if (incomingStatus === MessageStatus.SENT) {
                  console.log('📬 [ChatService] Marking message as DELIVERED (was SENT)');
                  _this.markAsDelivered(payload.senderId, currentUser.id);
              } else {
                  console.log('✅ [ChatService] Message already at status:', incomingStatus, '- NOT marking as DELIVERED');
              }
          }
          _this.messageSubject.next(chatMessage);
        }
      });

      _this.stompClient.subscribe(`/topic/call/${currentUser.id}`, function (msg: any) {
          if (msg.body) {
              _this.callMessageSubject.next(JSON.parse(msg.body));
          }
      });

      _this.stompClient.send("/app/user.addUser", {}, currentUser.id);

      // If UI already selected a chat before websocket finished connecting, subscribe now
      if (_this.activeChatId) {
        _this.setActiveChat(_this.activeChatId);
      }
      
    }, function(error: any) {
       console.error('STOMP Connection Error:', error);
       setTimeout(() => _this.connect(currentUser), 5000); 
    });
  }

  // --- HELPER: Auth Headers ---
  private getAuthHeaders(): any {
      const token = this.authService.getToken();
      return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  // --- ACTIONS ---
  markAsRead(senderId: string, recipientId: string) {
    if (this.stompClient && this.stompClient.connected) {
        const payload = { senderId, recipientId, status: 'SEEN' };
        this.stompClient.send('/app/status', this.getAuthHeaders(), JSON.stringify(payload));
    }
  }

  markAsDelivered(senderId: string, recipientId: string) {
    if (this.stompClient && this.stompClient.connected) {
        const payload = { senderId, recipientId, status: 'DELIVERED' };
        this.stompClient.send('/app/status', this.getAuthHeaders(), JSON.stringify(payload));
    }
  }

  sendMessage(msg: ChatMessage): boolean {
    if (this.stompClient && this.stompClient.connected) {
        try {
            this.stompClient.send("/app/chat", this.getAuthHeaders(), JSON.stringify(msg));
            return true;
        } catch (e) {
            console.error("Error sending message:", e);
            return false;
        }
    }
    return false;
  }

  sendCallSignal(payload: any) {
    if (this.stompClient && this.stompClient.connected) {
        this.stompClient.send("/app/call", this.getAuthHeaders(), JSON.stringify(payload));
    }
  }

  sendTyping(typingMsg: TypingMessage) {
    if (this.stompClient && this.stompClient.connected) {
        this.stompClient.send("/app/typing", this.getAuthHeaders(), JSON.stringify(typingMsg));
    }
  }

  /**
   * Subscribe to room-wide updates (e.g., message reactions) for an active chatId.
   * Backend broadcasts to: /topic/chat/{chatId}
   */
  setActiveChat(chatId: string | null) {
    if (!chatId) {
      this.activeChatId = null;
      if (this.activeChatSubscription) {
        try { this.activeChatSubscription.unsubscribe(); } catch {}
      }
      this.activeChatSubscription = null;
      return;
    }

    // No-op if already subscribed
    if (this.activeChatId === chatId && this.activeChatSubscription) return;

    // Unsubscribe previous
    if (this.activeChatSubscription) {
      try { this.activeChatSubscription.unsubscribe(); } catch {}
      this.activeChatSubscription = null;
    }

    this.activeChatId = chatId;
    console.log('📡 [ChatService] Subscribing to room updates:', `/topic/chat/${chatId}`);

    if (this.stompClient && this.stompClient.connected) {
      this.activeChatSubscription = this.stompClient.subscribe(`/topic/chat/${chatId}`, (msg: any) => {
        if (!msg.body) return;
        const payload = JSON.parse(msg.body);
        console.log('📥 [ChatService] Received room update:', payload);

        // Payload is expected to be a ChatMessage object from backend
        const updated: ChatMessage = {
          id: payload.id,
          chatId: payload.chatId,
          senderId: payload.senderId,
          recipientId: payload.recipientId,
          content: payload.content,
          fileName: payload.fileName,
          timestamp: payload.timestamp ? new Date(payload.timestamp) : new Date(),
          type: payload.type || MessageType.TEXT,
          status: payload.status || MessageStatus.SENT,
          senderName: payload.senderName,
          reactions: (payload.reactions || []) as MessageReaction[]
        };

        this.messageUpdateSubject.next(updated);
      });
    }
  }

  /**
   * Send reaction toggle to backend via WebSocket.
   * Destination: /app/chat.react
   */
  sendReaction(reactionPayload: any): boolean {
    if (this.stompClient && this.stompClient.connected) {
      try {
        this.stompClient.send('/app/chat.react', this.getAuthHeaders(), JSON.stringify(reactionPayload));
        return true;
      } catch (e) {
        console.error('Error sending reaction:', e);
        return false;
      }
    }
    return false;
  }

  subscribeToStatus(partnerId: string) {
    if (this.stompClient && this.stompClient.connected) {
        return this.stompClient.subscribe(`/topic/status/${partnerId}`, (msg: any) => {
            if (msg.body) {
                this.statusSubject.next(JSON.parse(msg.body) as UserStatus);
            }
        });
    }
    return null;
  }

  getUserStatus(userId: string): Observable<UserStatus> {
      return this.http.get<UserStatus>(`${this.apiUrl}/rooms/status/${userId}`);
  }

  getChatMessages(senderId: string, recipientId: string): Observable<ChatMessage[]> {
    return this.http.get<ChatMessage[]>(`${this.apiUrl}/messages/${senderId}/${recipientId}`);
  }

  getChatRooms(userId: string): Observable<ChatRoom[]> {
    return this.http.get<ChatRoom[]>(`${this.apiUrl}/rooms/${userId}`);
  }

  // [NEW] HTTP endpoint for marking messages as read (more reliable than WebSocket only)
  markAsReadHTTP(senderId: string, recipientId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/messages/mark-read/${senderId}/${recipientId}`, {});
  }

  onMessage(): Observable<ChatMessage> { return this.messageSubject.asObservable(); }
  onMessageUpdate(): Observable<ChatMessage> { return this.messageUpdateSubject.asObservable(); }
  onTyping(): Observable<TypingMessage> { return this.typingSubject.asObservable(); }
  onCallMessage(): Observable<any> { return this.callMessageSubject.asObservable(); }
  onStatusUpdate(): Observable<UserStatus> { return this.statusSubject.asObservable(); }
  onMessageStatusChange(): Observable<any> { return this.messageStatusSubject.asObservable(); }
}