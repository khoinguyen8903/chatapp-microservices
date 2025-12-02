// ... imports giữ nguyên
import { Component, OnInit, OnDestroy, signal, effect } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common'; 
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ChatService } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';
import { ChatMessage, ChatRoom, TypingMessage, UserStatus } from '../../models/chat.models';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.html',
  styleUrls: ['./chat.scss'],
  providers: [DatePipe] 
})
export class Chat implements OnInit, OnDestroy {
  
  // --- STATE MANAGEMENT ---
  currentUser = signal<any>(null);
  selectedUser = signal<any>(null);
  chatRooms = signal<ChatRoom[]>([]);
  messages = signal<ChatMessage[]>([]); 
  
  newMessage = '';
  userToChat = ''; 

  // --- STATE CHO TYPING ---
  isRecipientTyping = signal(false); 
  private typingTimeout: any;

  // --- STATE CHO ONLINE/OFFLINE ---
  partnerStatus = signal<string>('OFFLINE');
  lastSeen = signal<Date | null>(null);
  private statusSubscription: any; 

  // --- CACHE TÊN USER ---
  private userCache = new Map<string, string>(); 

  constructor(
    private chatService: ChatService, 
    private authService: AuthService,
    private router: Router,
    private datePipe: DatePipe 
  ) {
    effect(() => {
      if (this.messages().length > 0 || this.isRecipientTyping()) {
        this.scrollToBottom();
      }
    });
  }

  ngOnInit() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      this.currentUser.set(user);
      
      this.chatService.connect(this.currentUser());
      this.loadRooms();

      this.chatService.onMessage().subscribe((msg) => {
        if (msg) {
          const currentSelected = this.selectedUser();
          if (currentSelected && (msg.senderId === currentSelected.id || msg.senderId === this.currentUser().id)) {
            this.messages.update(old => [...old, msg]);
            this.isRecipientTyping.set(false);
          }

          const isNewContact = !this.chatRooms().some(r => 
             r.senderId === msg.senderId || r.recipientId === msg.senderId
          );
          if (isNewContact) this.loadRooms();
        }
      });

      this.chatService.onTyping().subscribe((typingMsg) => {
        const currentSelected = this.selectedUser();
        if (currentSelected && typingMsg.senderId === currentSelected.id) {
            this.isRecipientTyping.set(typingMsg.isTyping);
        }
      });

      this.chatService.onStatusUpdate().subscribe((update: any) => {
          if (this.selectedUser() && update.userId === this.selectedUser().id) {
              this.partnerStatus.set(update.status);
              
              if (update.status === 'OFFLINE') {
                  const time = update.lastSeen ? new Date(update.lastSeen) : new Date();
                  this.lastSeen.set(time);
              }
          }
      });

    } else {
        this.router.navigate(['/login']);
    }
  }

  loadRooms() {
    this.chatService.getChatRooms(this.currentUser().id).subscribe({
      next: (rooms) => {
        this.chatRooms.set(rooms);
        rooms.forEach(room => {
            const partnerId = this.getRecipientId(room);
            if (!room.chatName) {
                if (this.userCache.has(partnerId)) {
                    room.chatName = this.userCache.get(partnerId);
                } else {
                    this.authService.getUserById(partnerId).subscribe({
                        next: (user: any) => {
                            room.chatName = user.username; 
                            this.userCache.set(partnerId, user.username);
                            this.chatRooms.update(current => [...current]);
                        },
                        error: () => { room.chatName = 'Unknown User'; }
                    });
                }
            }
        });
      },
      error: (err) => console.error('Lỗi tải phòng chat', err)
    });
  }

  onSelectUser(room: ChatRoom) {
    const recipientId = this.getRecipientId(room);
    const displayName = this.getDisplayName(room);
    
    this.selectedUser.set({ id: recipientId, name: displayName });
    this.isRecipientTyping.set(false);

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

    if (this.statusSubscription) this.statusSubscription.unsubscribe();
    this.statusSubscription = this.chatService.subscribeToStatus(recipientId);
    
    this.chatService.getChatMessages(this.currentUser().id, recipientId).subscribe(msgs => {
      this.messages.set(msgs); 
      this.scrollToBottom();
    });
  }

  // --- HÀM ĐÃ SỬA: Luôn hiển thị text "Hoạt động..." ---
  getLastSeenText(): string {
      // 1. Nếu đang Online
      if (this.partnerStatus() === 'ONLINE') return 'Đang hoạt động';
      
      // 2. Nếu không có dữ liệu (null) -> Coi như đã off rất lâu -> "3 tháng trước"
      if (!this.lastSeen()) return 'Hoạt động 3 tháng trước';

      const now = new Date();
      const diff = Math.floor((now.getTime() - this.lastSeen()!.getTime()) / 1000); // Giây

      // 3. Logic hiển thị thời gian tương đối
      if (diff < 60) return 'Vừa mới truy cập';
      if (diff < 3600) return `Hoạt động ${Math.floor(diff / 60)} phút trước`;
      if (diff < 86400) return `Hoạt động ${Math.floor(diff / 3600)} giờ trước`;
      if (diff < 2592000) return `Hoạt động ${Math.floor(diff / 86400)} ngày trước`; // Dưới 30 ngày
      if (diff < 7776000) return `Hoạt động ${Math.floor(diff / 2592000)} tháng trước`; // Dưới 3 tháng (90 ngày)

      // 4. Nếu quá 3 tháng -> "3 tháng trước"
      return 'Hoạt động 3 tháng trước';
  }

  // ... (Các hàm khác giữ nguyên) ...
  
  onInputTyping() {
    if (!this.selectedUser()) return;
    const typingMsg: TypingMessage = {
        senderId: this.currentUser().id, recipientId: this.selectedUser().id, isTyping: true
    };
    this.chatService.sendTyping(typingMsg);
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
        const stopTypingMsg: TypingMessage = {
            senderId: this.currentUser().id, recipientId: this.selectedUser().id, isTyping: false
        };
        this.chatService.sendTyping(stopTypingMsg);
    }, 1500);
  }

  startNewChat() {
    if (!this.userToChat.trim()) return;
    const usernameInput = this.userToChat.trim();
    this.authService.checkUserExists(usernameInput).subscribe({
      next: (res: any) => {
        const realRecipientId = res.userId; const realUsername = res.username;
        if (realRecipientId === this.currentUser().id) { alert('Bạn không thể chat với chính mình!'); return; }
        const existingRoom = this.chatRooms().find(r => r.senderId === realRecipientId || r.recipientId === realRecipientId);
        if (existingRoom) { if (!existingRoom.chatName) existingRoom.chatName = realUsername; this.onSelectUser(existingRoom); this.userToChat = ''; return; }
        const newRoom: ChatRoom = { id: 'temp_' + Date.now(), chatId: `${this.currentUser().id}_${realRecipientId}`, senderId: this.currentUser().id, recipientId: realRecipientId, chatName: realUsername };
        this.chatRooms.update(rooms => [newRoom, ...rooms]); this.onSelectUser(newRoom); this.userToChat = '';
      },
      error: (err) => { if (err.status === 404) alert(`Người dùng "${usernameInput}" không tồn tại!`); else console.error(err); }
    });
  }

  sendMessage() {
    if (!this.newMessage.trim() || !this.selectedUser()) return;
    const msg: ChatMessage = { senderId: this.currentUser().id, recipientId: this.selectedUser().id, content: this.newMessage, timestamp: new Date() };
    const isSent = this.chatService.sendMessage(msg);
    if (isSent) { 
        this.messages.update(old => [...old, msg]); this.newMessage = ''; 
        if (this.typingTimeout) clearTimeout(this.typingTimeout); 
    } 
    else { alert('Không thể gửi tin nhắn. Vui lòng kiểm tra kết nối mạng!'); }
  }

  getDisplayName(room: ChatRoom): string { if (room.chatName) return room.chatName; return room.senderId === this.currentUser().id ? room.recipientId : room.senderId; }
  getRecipientId(room: ChatRoom): string { return room.senderId === this.currentUser().id ? room.recipientId : room.senderId; }
  scrollToBottom() { setTimeout(() => { const el = document.getElementById('chat-container'); if (el) el.scrollTop = el.scrollHeight; }, 50); }
  ngOnDestroy() { if (this.statusSubscription) this.statusSubscription.unsubscribe(); }
}