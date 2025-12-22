import { Injectable, signal, computed, inject, effect, Injector, runInInjectionContext } from '@angular/core';
import { Router } from '@angular/router';
import { ChatService } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';
import { WebRTCService } from '../../services/webrtc.service';
import { NotificationService } from '../../services/notification.service';
import { UserService } from '../../services/user.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { 
  ChatMessage, 
  ChatRoom, 
  TypingMessage, 
  MessageType, 
  ChatSession,
  MessageStatus 
} from '../../models/chat.models';

const DEFAULT_AVATAR = 'assets/default-avatar.svg';
const GROUP_AVATAR = 'assets/group-icon.svg';

@Injectable({ providedIn: 'root' })
export class ChatFacade {
  private chatService = inject(ChatService);
  private authService = inject(AuthService);
  private webRTCService = inject(WebRTCService);
  private notificationService = inject(NotificationService);
  private userService = inject(UserService);
  private router = inject(Router);
  private injector = inject(Injector);

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

  // --- WEBRTC PARTNER UI (Avatar/Name for incoming/outgoing overlays) ---
  callPartnerId = this.webRTCService.partnerId;
  callPartnerAvatar = computed(() => this.webRTCService.partnerAvatar());
  callPartnerName = computed(() => {
    const id = this.webRTCService.partnerId();
    if (!id) return '';
    const fromSessions = this.sessions().find(s => s.id === id)?.name;
    if (fromSessions) return fromSessions;
    const cached = this.userCache.get(id)?.username;
    return cached || 'Unknown';
  });

  // Cache user để đỡ phải gọi API nhiều lần
  private userCache = new Map<string, { username: string; avatarUrl?: string }>();
  
  // Quản lý tất cả subscription để cleanup gọn gàng
  private subscriptions = new Subscription();
  // Subscription riêng cho status để switch qua lại giữa các user
  private statusSubscription: Subscription | null = null;
  private userSubscription: Subscription | null = null;

  constructor() {
    // Constructor nên giữ đơn giản. Logic khởi tạo chuyển sang init()
    // để Component gọi khi khởi tạo view.

    // Keep WebRTC partner avatar in sync even for INCOMING calls (when selectedSession may not match).
    // NOTE: effect() must be created inside an injection context (NG0203 otherwise).
    runInInjectionContext(this.injector, () => {
      effect(() => {
        const partnerId = this.webRTCService.partnerId();
        if (!partnerId) return;

        // Prefer known sessions list (already mapped + cached)
        const existing = this.sessions().find(s => s.id === partnerId);
        if (existing?.avatar) {
          this.webRTCService.setPartnerAvatar(existing.avatar);
          return;
        }

        // Fallback: fetch user info for PRIVATE calls
        if (!this.userCache.has(partnerId)) {
          this.fetchUserInfo(partnerId);
        } else {
          const cached = this.userCache.get(partnerId);
          this.webRTCService.setPartnerAvatar(cached?.avatarUrl || DEFAULT_AVATAR);
        }
      });
    });
  }

  private normalizeAvatarUrl(url?: string | null): string {
    if (!url) return DEFAULT_AVATAR;
    const value = String(url).trim();
    if (!value) return DEFAULT_AVATAR;

    // Already an app asset
    if (value.startsWith('assets/')) return value;

    // Absolute http(s)
    if (/^https?:\/\//i.test(value)) return value;

    // Protocol-relative URL
    if (value.startsWith('//')) return `${window.location.protocol}${value}`;

    // Relative path from backend
    const base = String(environment.apiUrl || '').replace(/\/+$/, '');
    if (!base) return value;

    if (value.startsWith('/')) return `${base}${value}`;
    return `${base}/${value}`;
  }

  private formatLastMessagePreview(lastMessage?: string | null): string | undefined {
    if (!lastMessage) return undefined;
    const value = String(lastMessage).trim();
    if (!value) return undefined;

    // Try to show friendly labels for attachments (especially AUDIO voice messages)
    const lower = value.toLowerCase();

    // Our voice recordings are named: voice_message_<timestamp>.webm
    if (lower.includes('voice_message_')) return '🎤 Voice message';

    // Common audio extensions
    if (/\.(mp3|wav|ogg|m4a|aac|flac)(\?.*)?$/i.test(lower)) return '🎤 Voice message';

    // Images
    if (/\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(lower)) return '📷 Image';

    // Videos
    if (/\.(mp4|mov|mkv)(\?.*)?$/i.test(lower)) return '🎥 Video';

    // Generic file (avoid showing long URLs in sidebar)
    if (/^https?:\/\//i.test(value) && value.length > 60) return '📎 Attachment';

    return value;
  }

  // Hàm này được gọi từ ChatComponent (ngOnInit)
  init() {
    const current = this.authService.getCurrentUser();
    if (!current) {
      this.router.navigate(['/login']);
      return;
    }

    // Keep facade currentUser in sync with AuthService (profile updates, avatar changes, etc.)
    if (this.userSubscription) this.userSubscription.unsubscribe();
    this.userSubscription = this.authService.currentUser$.subscribe((u) => this.currentUser.set(u));

    this.currentUser.set(current);
    this.chatService.connect(this.currentUser());

    // Hydrate current user's avatar from profile API so Sidebar shows it even after fresh login
    // (login response typically doesn't include avatarUrl).
    const profileSub = this.userService.getCurrentUserProfile().subscribe({
      next: (profile) => {
        this.authService.updateCurrentUser({
          username: profile.username,
          name: profile.fullName,
          avatarUrl: this.normalizeAvatarUrl(profile.avatarUrl)
        });
      },
      error: () => {
        // Non-blocking: keep whatever we already have in localStorage
      }
    });
    this.subscriptions.add(profileSub);

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
      const currentUserId = this.currentUser().id;
      
      console.log('📬 [Facade] Received message - From:', msg.senderId, 'To:', msg.recipientId, 
                  'ChatId:', msg.chatId, 'Type:', msg.type, 'CurrentSession:', currentSession?.name);
      
      // [CRITICAL FIX] Use explicit chatId from backend for room-specific updates
      // This prevents unread count leakage across different conversations
      let chatId: string;
      
      if (msg.chatId) {
        // Backend provided explicit chatId - use it directly (most reliable)
        chatId = msg.chatId;
        console.log('✅ [Facade] Using explicit chatId from backend:', chatId);
      } else {
        // Fallback: Derive chatId from message (for backward compatibility)
        console.warn('⚠️ [Facade] No explicit chatId from backend, deriving from message...');
        
        // Check if this is a group message by looking up in rawRooms
        const possibleGroupRoom = this.rawRooms().find(room => 
          room.isGroup && room.chatId === msg.recipientId
        );
        
        if (possibleGroupRoom) {
          // GROUP MESSAGE: chatId is always the group's ID (recipientId)
          chatId = msg.recipientId;
          console.log('👥 [Facade] GROUP message detected - ChatId:', chatId);
        } else {
          // PRIVATE MESSAGE: chatId is the partner's ID (the other person, not me)
          if (msg.senderId === currentUserId) {
            // I sent this message → chatId is the recipient (my partner)
            chatId = msg.recipientId;
          } else {
            // Someone sent me this message → chatId is the sender (my partner)
            chatId = msg.senderId;
          }
          console.log('💬 [Facade] PRIVATE message detected - ChatId:', chatId, 
                      '(Partner ID, not mine)');
        }
      }
      
      // Determine the session ID to match against
      // For PRIVATE chats: session.id is the partner's ID
      // For GROUP chats: session.id is the group's chatId
      let sessionIdToMatch: string | null = null;
      if (currentSession) {
        if (currentSession.type === 'GROUP') {
          // For groups, session.id is the chatId
          sessionIdToMatch = currentSession.id;
        } else {
          // For private chats, compare using the real chatId for this conversation.
          // IMPORTANT: Do NOT rely on memberIds (backend may omit it for private rooms).
          const privateRoom = this.rawRooms().find(room =>
            !room.isGroup &&
            (
              (room.senderId === currentUserId && room.recipientId === currentSession.id) ||
              (room.senderId === currentSession.id && room.recipientId === currentUserId)
            )
          );
          sessionIdToMatch = privateRoom ? privateRoom.chatId : currentSession.id;
        }
      }
      
      // Check if this message belongs to the currently open session
      const isBelongToCurrentSession = sessionIdToMatch ? (chatId === sessionIdToMatch) : false;
      console.log('🔍 [Facade] Message belongs to current session?', isBelongToCurrentSession,
                  '- MessageChatId:', chatId, 'SessionChatId:', sessionIdToMatch);

      // Nếu đúng session đang mở -> thêm vào list messages
      if (isBelongToCurrentSession) {
        this.messages.update(old => {
          // [NEW] Populate replyToMessage if this message is a reply
          if (msg.replyToId) {
            const replyToMessage = old.find(m => m.id === msg.replyToId);
            msg.replyToMessage = replyToMessage;
          }
          return [...old, msg];
        });
        this.isRecipientTyping.set(false);

        // [CRITICAL FIX] Auto-mark as read when message arrives in currently open chat
        // This prevents unread count from incrementing for active chats
        if (msg.senderId !== currentUserId && currentSession) {
            console.log('✅ [Facade] Message arrived in ACTIVE chat - marking as read immediately');
            // Only mark as read if the message is from someone else
            if (currentSession.type === 'PRIVATE') {
                // For private chat: mark messages from partner as SEEN
                // Call with partnerId and myId to mark their messages as seen
                this.markMessagesAsRead(currentSession.id);
            } else if (currentSession.type === 'GROUP') {
                // For group chat: mark messages not sent by me as SEEN
                this.markMessagesAsRead(currentSession.id);
            }
        }
      } else {
        // [UNREAD LOGIC] Only update unread count if message is NOT in current session
        // This prevents double-counting for active chats
        console.log('📬 [Facade] Message arrived in INACTIVE chat - will increment unread count');
        this.updateSessionWithNewMessage(msg, chatId, isBelongToCurrentSession);
      }

      // [ALWAYS] Update session preview (last message, timestamp) regardless of active state
      if (!isBelongToCurrentSession) {
        // Already called above for inactive chats
      } else {
        // For active chats, still update the preview but WITHOUT incrementing unread count
        this.updateSessionPreviewOnly(msg, chatId);
      }
      
      // Nếu là liên hệ mới hoặc nhóm mới chưa có trong list -> reload sidebar
      this.checkAndReloadSessions(msg);
    });
    this.subscriptions.add(msgSub);

    // 2. Nhận trạng thái Typing
    const typingSub = this.chatService.onTyping().pipe(
      distinctUntilChanged((prev, curr) => 
        prev.senderId === curr.senderId && 
        prev.recipientId === curr.recipientId && 
        prev.isTyping === curr.isTyping
      )
    ).subscribe((typingMsg) => {
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
    const statusSub = this.chatService.onStatusUpdate().pipe(
      distinctUntilChanged((prev, curr) => 
        prev.userId === curr.userId && 
        prev.status === curr.status
      )
    ).subscribe((update: any) => {
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
    const messageStatusSub = this.chatService.onMessageStatusChange().pipe(
      distinctUntilChanged((prev, curr) => 
        prev.contactId === curr.contactId && 
        prev.status === curr.status
      )
    ).subscribe((payload: any) => {
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

    // 5. [NEW] Room-wide message updates (reactions, etc.)
    const msgUpdateSub = this.chatService.onMessageUpdate().subscribe((updated) => {
      if (!updated?.id) return;
      console.log('🔁 [Facade] Received message update:', updated);

      // Update existing message by ID (replace), otherwise append
      this.messages.update((msgs) => {
        const idx = msgs.findIndex(m => m.id === updated.id);
        if (idx === -1) {
          return [...msgs, updated];
        }

        const next = msgs.slice();
        next[idx] = {
          ...updated,
          // preserve UI-only state
          showReactionBar: msgs[idx].showReactionBar,
          isPlaying: msgs[idx].isPlaying,
          // safety: if backend omits reactions for any reason, keep existing
          reactions: (updated.reactions ?? msgs[idx].reactions) as any
        };
        return next;
      });
    });
    this.subscriptions.add(msgUpdateSub);
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
                avatar: GROUP_AVATAR, 
                type: 'GROUP',
                memberCount: room.memberIds ? room.memberIds.length : 0,
                // [FIX] Use actual values from backend
                unreadCount: room.unreadCount || 0,
                lastMessage: this.formatLastMessagePreview(room.lastMessage),
                lastMessageTimestamp: room.lastMessageTimestamp ? new Date(room.lastMessageTimestamp) : undefined
            } as ChatSession;
        } 
        
        // TRƯỜNG HỢP 2: LÀ PRIVATE (Chat 1-1)
        else {
            const partnerId = this.getPartnerId(room);
            let fullName = 'Loading...';
            let avatar = DEFAULT_AVATAR;
            
            // Check cache xem có tên/avatar chưa
            if (this.userCache.has(partnerId)) {
                const cached = this.userCache.get(partnerId)!;
                fullName = cached.username;
                avatar = this.normalizeAvatarUrl(cached.avatarUrl);
            } else {
                // Nếu chưa có, gọi API lấy info (Lazy Load)
                this.fetchUserInfo(partnerId);
            }

            return {
                id: partnerId,
                name: fullName,
                avatar: avatar, 
                type: 'PRIVATE',
                status: 'OFFLINE',
                // [FIX] Use actual values from backend
                unreadCount: room.unreadCount || 0,
                lastMessage: this.formatLastMessagePreview(room.lastMessage),
                lastMessageTimestamp: room.lastMessageTimestamp ? new Date(room.lastMessageTimestamp) : undefined
            } as ChatSession;
        }
    });

    this.sessions.set(sessions);
  }

  // Helper để fetch info user 1-1 (username + avatar)
  private fetchUserInfo(userId: string) {
      this.authService.getUserById(userId).subscribe({
          next: (user: any) => {
              const normalizedAvatar = this.normalizeAvatarUrl(user.avatarUrl);
              this.userCache.set(userId, { username: user.username, avatarUrl: normalizedAvatar });
              // Update lại signal sessions để UI hiển thị tên mới
              this.sessions.update(current => {
                  return current.map(s => {
                      if (s.id === userId && s.type === 'PRIVATE') {
                          return { ...s, name: user.username, avatar: normalizedAvatar };
                      }
                      return s;
                  });
              });

              // If currently selected session matches, update it too (so header/call uses latest avatar)
              this.selectedSession.update((s) => {
                if (s && s.id === userId && s.type === 'PRIVATE') {
                  return { ...s, name: user.username, avatar: normalizedAvatar };
                }
                return s;
              });

              // If WebRTC is currently calling this partner, update the call avatar
              if (this.webRTCService.partnerId() === userId) {
                this.webRTCService.setPartnerAvatar(normalizedAvatar);
              }
          }
      });
  }

  // [UPDATE] Logic chọn hội thoại (Hỗ trợ cả Group và Private)
  selectSession(session: ChatSession) {
    this.selectedSession.set(session);
    this.isRecipientTyping.set(false);

    // [PUSH NOTIFICATION] Update NotificationService about active chat room
    // Pass the appropriate chatId to suppress notifications for this chat
    const currentUserId = this.currentUser()?.id;
    let activeChatId: string | null = null;
    
    if (session.type === 'GROUP') {
      // For groups, chatId is the group's ID
      activeChatId = session.id;
    } else {
      // For private chats, find the actual chatId from rawRooms.
      // IMPORTANT: Do NOT rely on memberIds (backend may omit it for private rooms).
      const privateRoom = this.rawRooms().find(room =>
        !room.isGroup &&
        (
          (room.senderId === currentUserId && room.recipientId === session.id) ||
          (room.senderId === session.id && room.recipientId === currentUserId)
        )
      );
      activeChatId = privateRoom ? privateRoom.chatId : session.id;
    }
    
    this.notificationService.setActiveRoom(activeChatId);
    console.log('🔔 [Facade] Set active room for notifications:', activeChatId);

    // [NEW] Subscribe to room-wide updates (e.g., reactions) for this chatId
    this.chatService.setActiveChat(activeChatId);

    // [UNREAD LOGIC] Optimistically reset unread count for this session
    this.sessions.update(sessions => 
      sessions.map(s => 
        s.id === session.id ? { ...s, unreadCount: 0 } : s
      )
    );

    // Xử lý riêng cho từng loại
    if (session.type === 'PRIVATE') {
        // --- LOGIC CŨ: Load Online Status ---
        this.loadUserStatus(session.id);
    } else {
        // --- LOGIC MỚI: Group không cần check online ---
        this.partnerStatus.set('ONLINE');
        this.lastSeen.set(null);
        if (this.statusSubscription) this.statusSubscription.unsubscribe();
    }

    // [FIXED] Mark messages as read using unified method
    this.markMessagesAsRead(session.id);

    // Load Messages
    this.chatService.getChatMessages(this.currentUser().id, session.id).subscribe(msgs => {
      // [NEW] Populate replyToMessage for messages that have replyToId
      const enrichedMessages = msgs.map(msg => {
        if (msg.replyToId) {
          // Find the replied-to message in the same message list
          const replyToMessage = msgs.find(m => m.id === msg.replyToId);
          return { ...msg, replyToMessage };
        }
        return msg;
      });
      this.messages.set(enrichedMessages);
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
  sendMessage(content: string, replyToId?: string, type: MessageType = MessageType.TEXT, file?: File, fileName?: string) {
    const currentSession = this.selectedSession();
    if (!currentSession) return false;

    const finalContent = type === MessageType.TEXT ? content : content;

    const msg: ChatMessage = {
        senderId: this.currentUser().id,
        recipientId: currentSession.id, 
        content: finalContent,
        fileName: fileName || (file ? file.name : undefined), // Use provided fileName or extract from file
        id: `temp_${Date.now()}`,
        timestamp: new Date(),
        type: type,
        senderName: this.currentUser().username,
        reactions: [],
        replyToId: replyToId // [NEW] Add replyToId for reply feature
    };

    const isSent = this.chatService.sendMessage(msg);
    return isSent;
  }

  // --- WEBRTC ACTIONS (MỚI) ---
  
  startVideoCall() {
    const session = this.selectedSession();
    if (!session) return;

    const isGroup = session.type === 'GROUP';
    this.webRTCService.setPartnerAvatar(session.avatar || DEFAULT_AVATAR);
    // [FIX] Gọi hàm chuẩn, không cần ép kiểu any nữa
    this.webRTCService.startCall(session.id, isGroup, true);
  }

  startVoiceCall() {
    const session = this.selectedSession();
    if (!session) return;

    const isGroup = session.type === 'GROUP';
    this.webRTCService.setPartnerAvatar(session.avatar || DEFAULT_AVATAR);
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
          avatar: DEFAULT_AVATAR,
          unreadCount: 0,
          lastMessage: undefined,
          lastMessageTimestamp: undefined
      };
      
      this.sessions.update(s => [tempSession, ...s]);
      this.selectSession(tempSession);
  }

  isGroup() {
      return this.selectedSession()?.type === 'GROUP';
  }

  // [UNREAD MESSAGE LOGIC] Update session with new message
  private updateSessionWithNewMessage(msg: ChatMessage, chatId: string | null, isBelongToCurrentSession: boolean) {
    if (!chatId) {
      console.warn('⚠️ [Facade] updateSessionWithNewMessage - chatId is null');
      return;
    }
    
    const currentUserId = this.currentUser().id;
    const currentSession = this.selectedSession();
    
    console.log('📨 [Facade] updateSessionWithNewMessage - ChatId:', chatId, 
                'From:', msg.senderId, 'IsCurrent:', isBelongToCurrentSession);
    
    // Prepare message preview (truncate if needed)
    let messagePreview = msg.content;
    if (msg.type === MessageType.IMAGE) {
      messagePreview = '📷 Image';
    } else if (msg.type === MessageType.VIDEO) {
      messagePreview = '🎥 Video';
    } else if (msg.type === MessageType.FILE) {
      messagePreview = `📎 ${msg.fileName || 'File'}`;
    } else if (msg.type === MessageType.AUDIO) {
      messagePreview = '🎤 Voice message';
    }

    // [CRITICAL FIX] Find the matching session by chatId from rawRooms
    const matchingRoom = this.rawRooms().find(room => room.chatId === chatId);
    if (!matchingRoom) {
      console.warn('⚠️ [Facade] No room found for chatId:', chatId);
      return;
    }
    
    // Determine the session ID to update based on room type
    let sessionIdToUpdate: string;
    if (matchingRoom.isGroup) {
      // For groups: session.id is the chatId
      sessionIdToUpdate = matchingRoom.chatId;
    } else {
      // For private chats: session.id is the partner's ID
      sessionIdToUpdate = matchingRoom.senderId === currentUserId 
        ? matchingRoom.recipientId 
        : matchingRoom.senderId;
    }

    console.log('🔍 [Facade] Updating session with ID:', sessionIdToUpdate, 
                'Room type:', matchingRoom.isGroup ? 'GROUP' : 'PRIVATE');

    // Update sessions
    this.sessions.update(sessions => {
      return sessions.map(session => {
        // [CRITICAL] Match by the correct session ID
        if (session.id === sessionIdToUpdate) {
          const updatedSession = { ...session };
          const oldUnreadCount = session.unreadCount || 0;
          
          // Update last message and timestamp
          updatedSession.lastMessage = messagePreview;
          updatedSession.lastMessageTimestamp = msg.timestamp || new Date();
          
          // [CRITICAL FIX] Increment unread count only if:
          // 1. The message is NOT from the current user
          // 2. AND the chat is NOT currently active
          if (msg.senderId !== currentUserId && !isBelongToCurrentSession) {
            updatedSession.unreadCount = oldUnreadCount + 1;
            console.log('🔔 [Facade] Unread count for', session.name, 'incremented:', 
                        oldUnreadCount, '->', updatedSession.unreadCount);
          } else {
            // Keep unread count as is (don't increment)
            console.log('✅ [Facade] NOT incrementing unread for', session.name, 
                        '- FromMe:', msg.senderId === currentUserId, 
                        'IsCurrentChat:', isBelongToCurrentSession);
          }
          
          return updatedSession;
        }
        return session;
      })
      // Sort by lastMessageTimestamp (newest first)
      .sort((a, b) => {
        const timeA = a.lastMessageTimestamp?.getTime() || 0;
        const timeB = b.lastMessageTimestamp?.getTime() || 0;
        return timeB - timeA;
      });
    });
  }

  // [NEW] Update session preview (last message, timestamp) WITHOUT incrementing unread count
  // Used for messages arriving in currently active chat
  private updateSessionPreviewOnly(msg: ChatMessage, chatId: string | null) {
    if (!chatId) {
      console.warn('⚠️ [Facade] updateSessionPreviewOnly - chatId is null');
      return;
    }
    
    const currentUserId = this.currentUser().id;
    
    console.log('📝 [Facade] updateSessionPreviewOnly - ChatId:', chatId);
    
    // Prepare message preview (truncate if needed)
    let messagePreview = msg.content;
    if (msg.type === MessageType.IMAGE) {
      messagePreview = '📷 Image';
    } else if (msg.type === MessageType.VIDEO) {
      messagePreview = '🎥 Video';
    } else if (msg.type === MessageType.FILE) {
      messagePreview = `📎 ${msg.fileName || 'File'}`;
    } else if (msg.type === MessageType.AUDIO) {
      messagePreview = '🎤 Voice message';
    }

    // Find the matching session by chatId from rawRooms
    const matchingRoom = this.rawRooms().find(room => room.chatId === chatId);
    if (!matchingRoom) {
      console.warn('⚠️ [Facade] No room found for chatId:', chatId);
      return;
    }
    
    // Determine the session ID to update based on room type
    let sessionIdToUpdate: string;
    if (matchingRoom.isGroup) {
      sessionIdToUpdate = matchingRoom.chatId;
    } else {
      sessionIdToUpdate = matchingRoom.senderId === currentUserId 
        ? matchingRoom.recipientId 
        : matchingRoom.senderId;
    }

    console.log('🔍 [Facade] Updating preview for session ID:', sessionIdToUpdate);

    // Update sessions - ONLY update preview, NOT unread count
    this.sessions.update(sessions => {
      return sessions.map(session => {
        if (session.id === sessionIdToUpdate) {
          const updatedSession = { ...session };
          
          // Update ONLY last message and timestamp
          updatedSession.lastMessage = messagePreview;
          updatedSession.lastMessageTimestamp = msg.timestamp || new Date();
          
          console.log('📝 [Facade] Updated preview for', session.name, '- Unread count unchanged:', session.unreadCount);
          
          return updatedSession;
        }
        return session;
      })
      // Sort by lastMessageTimestamp (newest first)
      .sort((a, b) => {
        const timeA = a.lastMessageTimestamp?.getTime() || 0;
        const timeB = b.lastMessageTimestamp?.getTime() || 0;
        return timeB - timeA;
      });
    });
  }

  // [NEW] Unified mark as read method for both PRIVATE and GROUP chats
  private markMessagesAsRead(sessionId: string) {
    const currentSession = this.selectedSession();
    if (!currentSession) return;

    const currentUserId = this.currentUser().id;

    if (currentSession.type === 'PRIVATE') {
        // For private chat: mark messages from partner as SEEN
        // WebSocket call (legacy)
        this.chatService.markAsRead(sessionId, currentUserId);
        
        // HTTP call for reliability
        this.chatService.markAsReadHTTP(sessionId, currentUserId).subscribe({
          next: () => console.log('✅ [Facade] Private messages marked as read'),
          error: (err) => console.error('❌ [Facade] Failed to mark private messages as read:', err)
        });
    } else if (currentSession.type === 'GROUP') {
        // For group chat: mark messages not sent by me as SEEN
        // WebSocket call (legacy)
        this.chatService.markAsRead(currentUserId, sessionId);
        
        // HTTP call for reliability
        this.chatService.markAsReadHTTP(currentUserId, sessionId).subscribe({
          next: () => console.log('✅ [Facade] Group messages marked as read'),
          error: (err) => console.error('❌ [Facade] Failed to mark group messages as read:', err)
        });
    }
  }

  cleanup() {
      // [PUSH NOTIFICATION] Clear active room when leaving chat
      this.notificationService.setActiveRoom(null);
      
      // Hủy subscription riêng lẻ
      if (this.statusSubscription) this.statusSubscription.unsubscribe();
      if (this.userSubscription) this.userSubscription.unsubscribe();
      
      // Hủy toàn bộ listener socket khi component bị hủy
      this.subscriptions.unsubscribe();
  }
}