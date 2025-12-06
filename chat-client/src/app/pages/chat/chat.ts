import { Component, OnInit, OnDestroy, signal, effect } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common'; 
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
// [1] Import HttpClient để tải file dạng Blob
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

  // --- STATE FOR TYPING ---
  isRecipientTyping = signal(false); 
  private typingTimeout: any;

  // --- STATE FOR ONLINE/OFFLINE ---
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
    // [2] Inject HttpClient vào đây
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

  getLastSeenText(): string {
      if (this.partnerStatus() === 'ONLINE') return 'Active now';
      if (!this.lastSeen()) return 'Active 3 months ago';
      const now = new Date();
      const diff = Math.floor((now.getTime() - this.lastSeen()!.getTime()) / 1000); 
      if (diff < 60) return 'Active just now';
      if (diff < 3600) return `Active ${Math.floor(diff / 60)} minutes ago`;
      if (diff < 86400) return `Active ${Math.floor(diff / 3600)} hours ago`;
      if (diff < 2592000) return `Active ${Math.floor(diff / 86400)} days ago`;
      if (diff < 7776000) return `Active ${Math.floor(diff / 2592000)} months ago`;
      return 'Active 3 months ago';
  }

  // --- [3] HÀM DOWNLOAD FILE NÉ IDM ---
  downloadFile(url: string, fileName: string = 'downloaded-file') {
    // Gọi HTTP GET để lấy dữ liệu dạng BLOB (Binary Large Object)
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        // Tạo URL ảo trong bộ nhớ trình duyệt
        const blobUrl = window.URL.createObjectURL(blob);
        
        // Tạo thẻ <a> ẩn để kích hoạt tải xuống
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileName;
        document.body.appendChild(a);
        
        // Giả lập cú click chuột (IDM sẽ không bắt được cái này)
        a.click();
        
        // Dọn dẹp bộ nhớ
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
      },
      error: (err) => console.error('Download error:', err)
    });
  }

  // --- HANDLE FILE SELECTION ---
  onFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (!file || !this.selectedUser()) return;

    this.chatService.uploadImage(file).subscribe({
        next: (response: any) => {
            console.log("Upload successful:", response);
            // Fix URL Docker -> Localhost
            const fileUrl = response.url.replace('http://minio:9000', 'http://localhost:9000');

            let msgType = MessageType.FILE; 
            
            if (file.type.startsWith('image/')) {
                msgType = MessageType.IMAGE;
            } else if (file.type.startsWith('video/')) {
                msgType = MessageType.VIDEO;
            }

            const msg: ChatMessage = {
                senderId: this.currentUser().id,
                recipientId: this.selectedUser().id,
                content: fileUrl, 
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
        senderId: this.currentUser().id, 
        recipientId: this.selectedUser().id, 
        content: this.newMessage, 
        timestamp: new Date(),
        type: MessageType.TEXT 
    };

    const isSent = this.chatService.sendMessage(msg);
    if (isSent) { 
        this.messages.update(old => [...old, msg]); 
        this.newMessage = ''; 
        if (this.typingTimeout) clearTimeout(this.typingTimeout); 
    } 
    else { alert('Could not send message. Please check your connection!'); }
  }

  getDisplayName(room: ChatRoom): string { if (room.chatName) return room.chatName; return room.senderId === this.currentUser().id ? room.recipientId : room.senderId; }
  getRecipientId(room: ChatRoom): string { return room.senderId === this.currentUser().id ? room.recipientId : room.senderId; }
  scrollToBottom() { setTimeout(() => { const el = document.getElementById('chat-container'); if (el) el.scrollTop = el.scrollHeight; }, 50); }
  ngOnDestroy() { if (this.statusSubscription) this.statusSubscription.unsubscribe(); }
}