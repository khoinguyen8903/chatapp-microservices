import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { Router } from '@angular/router';
import { ChatService } from '../../services/chat.service'; // Sửa path theo đúng dự án của bạn
import { AuthService } from '../../services/auth.service'; // Sửa path theo đúng dự án của bạn
import { ChatMessage, ChatRoom, TypingMessage, MessageType } from '../../models/chat.models'; // Sửa path
import { FileHelper } from './utils/file.helper';

@Injectable({ providedIn: 'root' })
export class ChatFacade {
  private chatService = inject(ChatService);
  private authService = inject(AuthService);
  private router = inject(Router);

  // --- STATE (SIGNALS) ---
  currentUser = signal<any>(null);
  selectedUser = signal<any>(null);
  chatRooms = signal<ChatRoom[]>([]);
  messages = signal<ChatMessage[]>([]);
  partnerStatus = signal<string>('OFFLINE');
  lastSeen = signal<Date | null>(null);
  isRecipientTyping = signal(false);
  
  // Cache user để đỡ phải gọi API nhiều lần
  private userCache = new Map<string, string>();
  private statusSubscription: any;

  constructor() {
    // Logic khởi tạo
    const userStr = localStorage.getItem('user');
    if (userStr) {
      this.currentUser.set(JSON.parse(userStr));
      this.chatService.connect(this.currentUser());
      this.loadRooms();
      this.setupSocketListeners();
    } else {
      this.router.navigate(['/login']);
    }
  }

  // --- SOCKET LISTENERS ---
  private setupSocketListeners() {
    // 1. Nhận tin nhắn mới
    this.chatService.onMessage().subscribe((msg) => {
      if (!msg) return;
      const currentSelected = this.selectedUser();
      
      // Nếu tin nhắn thuộc về cuộc trò chuyện đang mở -> thêm vào list
      if (currentSelected && (msg.senderId === currentSelected.id || msg.senderId === this.currentUser().id)) {
        this.messages.update(old => [...old, msg]);
        this.isRecipientTyping.set(false);
      }
      
      // Nếu là người mới chưa có trong list rooms -> reload rooms
      const isNewContact = !this.chatRooms().some(r => r.senderId === msg.senderId || r.recipientId === msg.senderId);
      if (isNewContact) this.loadRooms();
    });

    // 2. Nhận trạng thái Typing
    this.chatService.onTyping().subscribe((typingMsg) => {
      const currentSelected = this.selectedUser();
      if (currentSelected && typingMsg.senderId === currentSelected.id) {
        this.isRecipientTyping.set(typingMsg.isTyping);
      }
    });

    // 3. Nhận trạng thái Online/Offline (Global update)
    this.chatService.onStatusUpdate().subscribe((update: any) => {
        if (this.selectedUser() && update.userId === this.selectedUser().id) {
            this.partnerStatus.set(update.status);
            if (update.status === 'OFFLINE') {
                const time = update.lastSeen ? new Date(update.lastSeen) : new Date();
                this.lastSeen.set(time);
            }
        }
    });
  }

  // --- API CALLS & LOGIC ---

  loadRooms() {
    this.chatService.getChatRooms(this.currentUser().id).subscribe({
      next: (rooms) => {
        // Xử lý logic tên hiển thị
        const processedRooms = rooms.map(room => {
            const partnerId = this.getRecipientId(room);
            if (!room.chatName && this.userCache.has(partnerId)) {
                room.chatName = this.userCache.get(partnerId);
            }
            return room;
        });
        this.chatRooms.set(processedRooms);
        
        // Fetch tên user nếu chưa có (Lazy loading name)
        processedRooms.forEach(room => {
            const partnerId = this.getRecipientId(room);
            if (!room.chatName) {
                this.authService.getUserById(partnerId).subscribe({
                    next: (user: any) => {
                        room.chatName = user.username;
                        this.userCache.set(partnerId, user.username);
                        // Trigger update signal để UI render lại
                        this.chatRooms.update(current => [...current]); 
                    },
                    error: () => {
                        room.chatName = 'Unknown User';
                        this.chatRooms.update(current => [...current]);
                    }
                });
            }
        });
      },
      error: (err) => console.error('Error loading rooms', err)
    });
  }

  selectRoom(room: ChatRoom) {
    const recipientId = this.getRecipientId(room);
    const displayName = room.chatName || recipientId; // Fallback name
    
    this.selectedUser.set({ id: recipientId, name: displayName });
    this.isRecipientTyping.set(false);

    // Lấy status hiện tại
    this.chatService.getUserStatus(recipientId).subscribe({
        next: (statusData: any) => {
            this.partnerStatus.set(statusData.status);
            this.lastSeen.set(statusData.lastSeen ? new Date(statusData.lastSeen) : null);
        },
        error: () => {
            this.partnerStatus.set('OFFLINE');
            this.lastSeen.set(null);
        }
    });

    // Subscribe real-time status riêng cho user này
    if (this.statusSubscription) this.statusSubscription.unsubscribe();
    this.statusSubscription = this.chatService.subscribeToStatus(recipientId);

    // Load messages
    this.chatService.getChatMessages(this.currentUser().id, recipientId).subscribe(msgs => {
      this.messages.set(msgs);
    });
  }

  sendMessage(content: string, type: MessageType = MessageType.TEXT, file?: File, preSanitizedUrl?: string) {
    if (!this.selectedUser()) return false;

    // Nếu là file, content sẽ là URL, nếu là text, content là lời nhắn
    const finalContent = type === MessageType.TEXT ? content : (preSanitizedUrl || content);

    const msg: ChatMessage = {
        senderId: this.currentUser().id,
        recipientId: this.selectedUser().id,
        content: finalContent,
        fileName: file ? file.name : undefined,
        id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // ID tạm
        timestamp: new Date(),
        type: type
    };

    const isSent = this.chatService.sendMessage(msg);
    if (isSent) {
        this.messages.update(old => [...old, msg]);
        return true;
    }
    return false;
  }

  uploadFile(file: File) {
     return this.chatService.uploadImage(file);
  }

  sendTyping(isTyping: boolean) {
    if (!this.selectedUser()) return;
    const msg: TypingMessage = { 
        senderId: this.currentUser().id, 
        recipientId: this.selectedUser().id, 
        isTyping 
    };
    this.chatService.sendTyping(msg);
  }

  // Logic tìm user mới để chat
  findAndChatUser(username: string) {
    return this.authService.checkUserExists(username);
  }

  createTempRoom(partnerId: string, partnerName: string) {
      const newRoom: ChatRoom = {
          id: 'temp_' + Date.now(),
          chatId: `${this.currentUser().id}_${partnerId}`,
          senderId: this.currentUser().id,
          recipientId: partnerId,
          chatName: partnerName
      };
      // Thêm vào đầu danh sách
      this.chatRooms.update(rooms => [newRoom, ...rooms]);
      return newRoom;
  }

  // --- HELPER NỘI BỘ ---
  private getRecipientId(room: ChatRoom): string {
    const currentId = this.currentUser()?.id;
    if (!currentId) return room.recipientId;
    return room.senderId === currentId ? room.recipientId : room.senderId;
  }

  cleanup() {
      if (this.statusSubscription) this.statusSubscription.unsubscribe();
  }
}