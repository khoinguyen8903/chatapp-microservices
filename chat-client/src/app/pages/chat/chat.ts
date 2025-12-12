import { Component, OnInit, OnDestroy, signal, effect } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common'; 
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http'; 
import { ChatService } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';
import { ChatMessage, ChatRoom, TypingMessage, UserStatus, MessageType } from '../../models/chat.models';

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
  isRecipientTyping = signal(false); 
  private typingTimeout: any;
  partnerStatus = signal<string>('OFFLINE');
  lastSeen = signal<Date | null>(null);
  private statusSubscription: any; 
  private userCache = new Map<string, string>(); 
  MessageType = MessageType; 

  constructor(
    private chatService: ChatService, 
    private authService: AuthService,
    private router: Router,
    private datePipe: DatePipe,
    private http: HttpClient 
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
          const isNewContact = !this.chatRooms().some(r => r.senderId === msg.senderId || r.recipientId === msg.senderId);
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
        const processedRooms = rooms.map(room => {
            const partnerId = this.getRecipientId(room);
            if (!room.chatName && this.userCache.has(partnerId)) {
                room.chatName = this.userCache.get(partnerId);
            }
            return room;
        });
        this.chatRooms.set(processedRooms);
        processedRooms.forEach(room => {
            const partnerId = this.getRecipientId(room);
            if (!room.chatName) {
                this.authService.getUserById(partnerId).subscribe({
                    next: (user: any) => {
                        room.chatName = user.username; 
                        this.userCache.set(partnerId, user.username);
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
      error: (err) => console.error('Error loading chat rooms', err)
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

  // --- HÀM QUAN TRỌNG: CHUẨN HÓA URL ---
  // Giữ lại hàm này để chuyển đổi link Docker -> Localhost
  sanitizeUrl(url: string): string {
    if (!url) return '';
    if (url.includes('minio:9000')) {
        return url.replace('minio:9000', 'localhost:9000');
    }
    // Fix thêm trường hợp http/https lẫn lộn nếu cần
    return url.replace('http://minio:9000', 'http://localhost:9000');
  }

  // --- ĐÃ XÓA HÀM downloadFile ---
  // Vì backend giờ đã trả về header "attachment", 
  // ta dùng thẻ <a> ở HTML là tự tải được, IDM bắt link ngon lành.

  // --- CÁC HÀM HỖ TRỢ KHÁC ---
  getLastSeenText(): string {
      if (this.partnerStatus() === 'ONLINE') return 'Active now';
      if (!this.lastSeen()) return 'Active 3 months ago';
      const now = new Date();
      const diff = Math.floor((now.getTime() - this.lastSeen()!.getTime()) / 1000); 
      if (diff < 60) return 'Active just now';
      if (diff < 3600) return `Active ${Math.floor(diff / 60)} minutes ago`;
      if (diff < 86400) return `Active ${Math.floor(diff / 3600)} hours ago`;
      if (diff < 2592000) return `Active ${Math.floor(diff / 86400)} days ago`;
      return 'Active 3 months ago';
  }

  getFileNameFromUrl(url: string): string {
    if (!url) return 'file';
    const rawName = url.substring(url.lastIndexOf('/') + 1);
    const parts = rawName.split('_');
    return parts.length > 1 ? parts.slice(1).join('_') : rawName;
  }

  onFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (!file || !this.selectedUser()) return;
    this.chatService.uploadImage(file).subscribe({
        next: (response: any) => {
            const fileUrl = this.sanitizeUrl(response.url);
            let msgType = MessageType.FILE; 
            if (file.type.startsWith('image/')) { msgType = MessageType.IMAGE; } 
            else if (file.type.startsWith('video/')) { msgType = MessageType.VIDEO; }

            const msg: ChatMessage = {
                senderId: this.currentUser().id,
                recipientId: this.selectedUser().id,
                content: fileUrl, 
                fileName: file.name, 
                // [FIX NG0955] Thêm ID tạm thời
                id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                timestamp: new Date(),
                type: msgType
            };
            const isSent = this.chatService.sendMessage(msg);
            if (isSent) {
                this.messages.update(old => [...old, msg]);
                this.scrollToBottom();
            }
        },
        error: (err) => {
            console.error("Upload error:", err);
            alert("Upload failed! File too large or server error.");
        }
    });
  }

  onInputTyping() {
    if (!this.selectedUser()) return;
    const typingMsg: TypingMessage = { senderId: this.currentUser().id, recipientId: this.selectedUser().id, isTyping: true };
    this.chatService.sendTyping(typingMsg);
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
        const stopTypingMsg: TypingMessage = { senderId: this.currentUser().id, recipientId: this.selectedUser().id, isTyping: false };
        this.chatService.sendTyping(stopTypingMsg);
    }, 1500);
  }

  startNewChat() {
    if (!this.userToChat.trim()) return;
    const usernameInput = this.userToChat.trim();
    this.authService.checkUserExists(usernameInput).subscribe({
      next: (res: any) => {
        const realRecipientId = res.userId; const realUsername = res.username;
        if (realRecipientId === this.currentUser().id) { alert('You cannot chat with yourself!'); return; }
        const existingRoom = this.chatRooms().find(r => r.senderId === realRecipientId || r.recipientId === realRecipientId);
        if (existingRoom) { if (!existingRoom.chatName) existingRoom.chatName = realUsername; this.onSelectUser(existingRoom); this.userToChat = ''; return; }
        const newRoom: ChatRoom = { id: 'temp_' + Date.now(), chatId: `${this.currentUser().id}_${realRecipientId}`, senderId: this.currentUser().id, recipientId: realRecipientId, chatName: realUsername };
        this.chatRooms.update(rooms => [newRoom, ...rooms]); this.onSelectUser(newRoom); this.userToChat = '';
      },
      error: (err) => { if (err.status === 404) alert(`User "${usernameInput}" not found!`); else console.error(err); }
    });
  }

  sendMessage() {
    if (!this.newMessage.trim() || !this.selectedUser()) return;
    const msg: ChatMessage = { 
        senderId: this.currentUser().id, recipientId: this.selectedUser().id, 
        content: this.newMessage, 
        // [FIX NG0955] Thêm ID tạm thời
        id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(), type: MessageType.TEXT 
    };
    const isSent = this.chatService.sendMessage(msg);
    if (isSent) { 
        this.messages.update(old => [...old, msg]); 
        this.newMessage = ''; 
        if (this.typingTimeout) clearTimeout(this.typingTimeout); 
    } 
    else { alert('Could not send message. Please check your connection!'); }
  }

  getDisplayName(room: ChatRoom): string { 
      if (room.chatName) return room.chatName; 
      const currentId = this.currentUser()?.id;
      if (!currentId) return 'Unknown';
      const partnerId = room.senderId === currentId ? room.recipientId : room.senderId;
      return partnerId || 'Unknown';
  }
  getRecipientId(room: ChatRoom): string { 
      const currentId = this.currentUser()?.id;
      if (!currentId) return room.recipientId;
      return room.senderId === currentId ? room.recipientId : room.senderId; 
  }
  scrollToBottom() { setTimeout(() => { const el = document.getElementById('chat-container'); if (el) el.scrollTop = el.scrollHeight; }, 50); }
  ngOnDestroy() { if (this.statusSubscription) this.statusSubscription.unsubscribe(); }
}