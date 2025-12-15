import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { Router } from '@angular/router';
import { ChatService } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';
import { WebRTCService } from '../../services/webrtc.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { 
  ChatMessage, 
  ChatRoom, 
  TypingMessage, 
  MessageType, 
  ChatSession,
  MessageStatus 
} from '../../models/chat.models';

@Injectable({ providedIn: 'root' })
export class ChatFacade {
  private chatService = inject(ChatService);
  private authService = inject(AuthService);
  private webRTCService = inject(WebRTCService);
  private router = inject(Router);

  // --- STATE (SIGNALS) ---
  currentUser = signal<any>(null);

  // [UPDATE] Đổi tên selectedUser -> selectedSession để đại diện cho cả User & Group
  selectedSession = signal<ChatSession | null>(null);

  // [UPDATE] Danh sách hiển thị bên Sidebar (đã được map thành ChatSession)
  sessions = signal<ChatSession[]>([]);
  
  // Dữ liệu thô từ API (để tham chiếu nếu cần)
  private rawRooms = signal<ChatRoom[]>([]);

  messages = signal<ChatMessage[]>([]);
  partnerStatus = signal<string>('OFFLINE');
  lastSeen = signal<Date | null>(null);
  isRecipientTyping = signal(false);
  
  // --- WEBRTC STATE (MỚI) ---
  callState = this.webRTCService.callState; // Signal gốc từ Service
  localStream = toSignal(this.webRTCService.localStream$); // Convert Subject -> Signal
  remoteStream = toSignal(this.webRTCService.remoteStream$);
  isVideoCall = toSignal(this.webRTCService.isVideoCall$, { initialValue: true }); // [UPDATE] Lấy từ Service

  // Cache user để đỡ phải gọi API nhiều lần
  private userCache = new Map<string, string>();
  
  // Quản lý tất cả subscription để cleanup gọn gàng
  private subscriptions = new Subscription();
  // Subscription riêng cho status để switch qua lại giữa các user
  private statusSubscription: Subscription | null = null;

  constructor() {
    // Constructor nên giữ đơn giản. Logic khởi tạo chuyển sang init()
    // để Component gọi khi khởi tạo view.
  }

  // Hàm này được gọi từ ChatComponent (ngOnInit)
  init() {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      this.router.navigate(['/login']);
      return;
    }

    this.currentUser.set(JSON.parse(userStr));
    this.chatService.connect(this.currentUser());
    this.loadRooms();
    this.setupSocketListeners();
  }

  // --- SOCKET LISTENERS ---
  private setupSocketListeners() {
    // Hủy các listener cũ nếu có để tránh duplicate khi init lại
    this.subscriptions.unsubscribe();
    this.subscriptions = new Subscription();

    // 1. Nhận tin nhắn mới
    const msgSub = this.chatService.onMessage().subscribe((msg) => {
      if (!msg) return;
      const currentSession = this.selectedSession();
      
      // [LOGIC MỚI] Kiểm tra xem tin nhắn có thuộc session đang mở không
      let isBelongToCurrentSession = false;

      if (currentSession) {
        if (currentSession.type === 'GROUP') {
            // Với Group: Check xem recipientId của tin nhắn có khớp với ID nhóm không
            isBelongToCurrentSession = msg.recipientId === currentSession.id;
        } else {
            // Với Private: Check xem người gửi có phải là partner đang chat không
            // Hoặc mình gửi (để hiện tin nhắn của chính mình vừa gửi socket)
            isBelongToCurrentSession = msg.senderId === currentSession.id || msg.senderId === this.currentUser().id;
        }
      }

      // Nếu đúng session đang mở -> thêm vào list messages
      if (isBelongToCurrentSession) {
        this.messages.update(old => [...old, msg]);
        this.isRecipientTyping.set(false);

        // [MỚI] Nếu là tin nhắn đến (không phải mình gửi) và đang mở chat 1-1 -> Đánh dấu đã xem ngay
        if (msg.senderId !== this.currentUser().id && currentSession?.type === 'PRIVATE') {
            this.chatService.markAsRead(msg.senderId, this.currentUser().id);
        }
      }
      
      // Nếu là liên hệ mới hoặc nhóm mới chưa có trong list -> reload sidebar
      this.checkAndReloadSessions(msg);
    });
    this.subscriptions.add(msgSub);

    // 2. Nhận trạng thái Typing
    const typingSub = this.chatService.onTyping().subscribe((typingMsg) => {
      const currentSession = this.selectedSession();
      if (!currentSession) return;

      if (currentSession.type === 'GROUP') {
         // Nếu đang ở trong nhóm đó và người gõ không phải là mình
         if (typingMsg.recipientId === currentSession.id && typingMsg.senderId !== this.currentUser().id) {
            this.isRecipientTyping.set(typingMsg.isTyping);
         }
      } else {
         // Logic cũ cho Private
         if (typingMsg.senderId === currentSession.id) {
            this.isRecipientTyping.set(typingMsg.isTyping);
         }
      }
    });
    this.subscriptions.add(typingSub);

    // 3. Nhận trạng thái Online/Offline (Chỉ áp dụng cho Chat 1-1)
    const statusSub = this.chatService.onStatusUpdate().subscribe((update: any) => {
        const currentSession = this.selectedSession();
        // Chỉ update nếu đang chat 1-1 và đúng người
        if (currentSession && currentSession.type === 'PRIVATE' && update.userId === currentSession.id) {
            this.partnerStatus.set(update.status);
            if (update.status === 'OFFLINE') {
                const time = update.lastSeen ? new Date(update.lastSeen) : new Date();
                this.lastSeen.set(time);
            }
        }
    });
    this.subscriptions.add(statusSub);

    // 4. [MỚI] Nhận cập nhật trạng thái tin nhắn (Sent -> Seen)
    const messageStatusSub = this.chatService.onMessageStatusChange().subscribe((payload: any) => {
        // Payload: { contactId: "...", status: "SEEN" }
        const currentSession = this.selectedSession();
        
        // Nếu người vừa xem tin nhắn (contactId) chính là người mình đang chat
        if (currentSession && currentSession.id === payload.contactId) {
            this.messages.update(msgs => msgs.map(msg => {
                // Cập nhật status cho các tin nhắn do MÌNH gửi đi
                if (msg.senderId === this.currentUser().id) {
                    // [FIX] Nếu tin nhắn đã SEEN thì giữ nguyên, không revert về DELIVERED
                    if (msg.status === MessageStatus.SEEN) return msg;
                    
                    return { ...msg, status: payload.status };
                }
                return msg;
            }));
        }
    });
    this.subscriptions.add(messageStatusSub);
  }

  // --- API CALLS & LOGIC ---

  loadRooms() {
    this.chatService.getChatRooms(this.currentUser().id).subscribe({
      next: (rooms) => {
        this.rawRooms.set(rooms); // Lưu lại bản gốc
        this.mapRoomsToSessions(rooms);
      },
      error: (err) => console.error('Error loading rooms', err)
    });
  }

  // [MỚI] Hàm chuyển đổi từ ChatRoom (Backend) -> ChatSession (Frontend UI)
  private mapRoomsToSessions(rooms: ChatRoom[]) {
    const sessions: ChatSession[] = rooms.map(room => {
        // TRƯỜNG HỢP 1: LÀ GROUP
        if (room.isGroup) {
            return {
                id: room.chatId,
                name: room.groupName || 'Nhóm không tên',
                avatar: 'assets/group-icon.png', 
                type: 'GROUP',
                memberCount: room.memberIds ? room.memberIds.length : 0
            } as ChatSession;
        } 
        
        // TRƯỜNG HỢP 2: LÀ PRIVATE (Chat 1-1)
        else {
            const partnerId = this.getPartnerId(room);
            let displayName = 'Loading...';
            
            // Check cache xem có tên chưa
            if (this.userCache.has(partnerId)) {
                displayName = this.userCache.get(partnerId)!;
            } else {
                // Nếu chưa có, gọi API lấy tên (Lazy Load)
                this.fetchUserName(partnerId);
            }

            return {
                id: partnerId,
                name: displayName,
                avatar: undefined, 
                type: 'PRIVATE',
                status: 'OFFLINE'
            } as ChatSession;
        }
    });

    this.sessions.set(sessions);
  }

  // Helper để fetch tên user 1-1
  private fetchUserName(userId: string) {
      this.authService.getUserById(userId).subscribe({
          next: (user: any) => {
              this.userCache.set(userId, user.username);
              // Update lại signal sessions để UI hiển thị tên mới
              this.sessions.update(current => {
                  return current.map(s => {
                      if (s.id === userId && s.type === 'PRIVATE') {
                          return { ...s, name: user.username };
                      }
                      return s;
                  });
              });
          }
      });
  }

  // [UPDATE] Logic chọn hội thoại (Hỗ trợ cả Group và Private)
  selectSession(session: ChatSession) {
    this.selectedSession.set(session);
    this.isRecipientTyping.set(false);

    // Xử lý riêng cho từng loại
    if (session.type === 'PRIVATE') {
        // --- LOGIC CŨ: Load Online Status ---
        this.loadUserStatus(session.id);
        
        // [MỚI] Khi bấm vào chat 1-1, báo cho server biết mình đã đọc tin nhắn của họ
        this.chatService.markAsRead(session.id, this.currentUser().id);
    } else {
        // --- LOGIC MỚI: Group không cần check online ---
        this.partnerStatus.set('ONLINE');
        this.lastSeen.set(null);
        if (this.statusSubscription) this.statusSubscription.unsubscribe();
    }

    // Load Messages
    this.chatService.getChatMessages(this.currentUser().id, session.id).subscribe(msgs => {
      this.messages.set(msgs);
    });
  }

  // Tách logic load status ra cho gọn
  private loadUserStatus(userId: string) {
    this.chatService.getUserStatus(userId).subscribe({
        next: (statusData: any) => {
            this.partnerStatus.set(statusData.status);
            this.lastSeen.set(statusData.lastSeen ? new Date(statusData.lastSeen) : null);
        },
        error: () => {
            this.partnerStatus.set('OFFLINE');
            this.lastSeen.set(null);
        }
    });

    if (this.statusSubscription) this.statusSubscription.unsubscribe();
    this.statusSubscription = this.chatService.subscribeToStatus(userId);
  }

  // [UPDATE] Gửi tin nhắn
  sendMessage(content: string, type: MessageType = MessageType.TEXT, file?: File, preSanitizedUrl?: string) {
    const currentSession = this.selectedSession();
    if (!currentSession) return false;

    const finalContent = type === MessageType.TEXT ? content : (preSanitizedUrl || content);

    const msg: ChatMessage = {
        senderId: this.currentUser().id,
        recipientId: currentSession.id, 
        content: finalContent,
        fileName: file ? file.name : undefined,
        id: `temp_${Date.now()}`,
        timestamp: new Date(),
        type: type,
        senderName: this.currentUser().username 
    };

    const isSent = this.chatService.sendMessage(msg);
    return isSent;
  }

  // --- WEBRTC ACTIONS (MỚI) ---
  
  startVideoCall() {
    const session = this.selectedSession();
    if (!session) return;

    const isGroup = session.type === 'GROUP';
    // [FIX] Gọi hàm chuẩn, không cần ép kiểu any nữa
    this.webRTCService.startCall(session.id, isGroup, true);
  }

  startVoiceCall() {
    const session = this.selectedSession();
    if (!session) return;

    const isGroup = session.type === 'GROUP';
    // [FIX] Gọi hàm chuẩn
    this.webRTCService.startCall(session.id, isGroup, false);
  }

  answerCall() {
    this.webRTCService.acceptCall();
  }

  endCall() {
    // Nếu đang gọi mà tắt -> Hủy
    // Nếu đang nghe mà tắt -> Từ chối/Kết thúc
    this.webRTCService.endCall();
  }

  // --- CÁC HÀM CŨ GIỮ NGUYÊN ---
  uploadFile(file: File) {
     return this.chatService.uploadImage(file);
  }

  sendTyping(isTyping: boolean) {
    const currentSession = this.selectedSession();
    if (!currentSession) return;
    
    const msg: TypingMessage = { 
        senderId: this.currentUser().id, 
        recipientId: currentSession.id, 
        isTyping 
    };
    this.chatService.sendTyping(msg);
  }

  // --- API tạo nhóm ---
  createGroup(groupName: string, memberIds: string[]) {
      return this.chatService.createGroup(groupName, this.currentUser().id, memberIds);
  }

  // --- HELPER NỘI BỘ ---
  private getPartnerId(room: ChatRoom): string {
    const currentId = this.currentUser()?.id;
    if (!currentId) return room.recipientId;
    return room.senderId === currentId ? room.recipientId : room.senderId;
  }

  private checkAndReloadSessions(msg: ChatMessage) {
      const currentSessionIds = this.sessions().map(s => s.id);
      
      if (currentSessionIds.includes(msg.recipientId)) return;
      if (currentSessionIds.includes(msg.senderId)) return;
      
      this.loadRooms();
  }
  
  findAndChatUser(username: string) {
    return this.authService.checkUserExists(username);
  }

  createTempSession(partnerId: string, partnerName: string) {
      const tempSession: ChatSession = {
          id: partnerId,
          name: partnerName,
          type: 'PRIVATE',
          status: 'OFFLINE',
          avatar: undefined
      };
      
      this.sessions.update(s => [tempSession, ...s]);
      this.selectSession(tempSession);
  }

  isGroup() {
      return this.selectedSession()?.type === 'GROUP';
  }

  cleanup() {
      // Hủy subscription riêng lẻ
      if (this.statusSubscription) this.statusSubscription.unsubscribe();
      
      // Hủy toàn bộ listener socket khi component bị hủy
      this.subscriptions.unsubscribe();
  }
}