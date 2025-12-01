import { Component, OnInit, OnDestroy, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ChatService } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';
import { ChatMessage, ChatRoom, TypingMessage } from '../../models/chat.models';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.html',
  styleUrls: ['./chat.scss']
})
export class Chat implements OnInit, OnDestroy {
  
  // --- STATE MANAGEMENT ---
  currentUser = signal<any>(null);
  selectedUser = signal<any>(null);
  chatRooms = signal<ChatRoom[]>([]);
  messages = signal<ChatMessage[]>([]); 
  
  newMessage = '';
  userToChat = ''; 

  // --- STATE CHO TÍNH NĂNG TYPING ---
  isRecipientTyping = signal(false); 
  private typingTimeout: any;
  // ---------------------------------

  // --- CACHE ĐỂ LƯU TÊN USER (Tránh gọi API nhiều lần) ---
  private userCache = new Map<string, string>(); 

  constructor(
    private chatService: ChatService, 
    private authService: AuthService,
    private router: Router
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

      // 1. Lắng nghe tin nhắn
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
          
          if (isNewContact) {
             this.loadRooms();
          }
        }
      });

      // 2. Lắng nghe Typing
      this.chatService.onTyping().subscribe((typingMsg) => {
        const currentSelected = this.selectedUser();
        if (currentSelected && typingMsg.senderId === currentSelected.id) {
            this.isRecipientTyping.set(typingMsg.isTyping);
        }
      });

    } else {
        this.router.navigate(['/login']);
    }
  }

  // --- SỬA HÀM NÀY: Tải phòng và tự động lấy tên thật (Fix lỗi hiện UUID) ---
  loadRooms() {
    this.chatService.getChatRooms(this.currentUser().id).subscribe({
      next: (rooms) => {
        this.chatRooms.set(rooms);
        
        // Duyệt qua từng phòng để lấy tên Username
        rooms.forEach(room => {
            const partnerId = this.getRecipientId(room);
            
            // Nếu chưa có tên hiển thị
            if (!room.chatName) {
                // Kiểm tra cache xem đã lấy chưa
                if (this.userCache.has(partnerId)) {
                    room.chatName = this.userCache.get(partnerId);
                } else {
                    // Gọi API lấy tên từ Auth Service
                    this.authService.getUserById(partnerId).subscribe({
                        next: (user: any) => {
                            room.chatName = user.username; 
                            this.userCache.set(partnerId, user.username);
                            
                            // Cập nhật lại danh sách để giao diện hiển thị tên mới
                            this.chatRooms.update(current => [...current]);
                        },
                        error: () => {
                            room.chatName = 'Unknown User';
                        }
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
    
    this.chatService.getChatMessages(this.currentUser().id, recipientId).subscribe(msgs => {
      this.messages.set(msgs); 
      this.scrollToBottom();
    });
  }

  // Gửi sự kiện Typing
  onInputTyping() {
    if (!this.selectedUser()) return;

    const typingMsg: TypingMessage = {
        senderId: this.currentUser().id,
        recipientId: this.selectedUser().id,
        isTyping: true
    };
    this.chatService.sendTyping(typingMsg);

    if (this.typingTimeout) clearTimeout(this.typingTimeout);

    this.typingTimeout = setTimeout(() => {
        const stopTypingMsg: TypingMessage = {
            senderId: this.currentUser().id,
            recipientId: this.selectedUser().id,
            isTyping: false
        };
        this.chatService.sendTyping(stopTypingMsg);
    }, 1500);
  }

  // Tạo phòng mới
  startNewChat() {
    if (!this.userToChat.trim()) return;
    const usernameInput = this.userToChat.trim();
    
    this.authService.checkUserExists(usernameInput).subscribe({
      next: (res: any) => {
        const realRecipientId = res.userId; 
        const realUsername = res.username;

        if (realRecipientId === this.currentUser().id) {
            alert('Bạn không thể chat với chính mình!');
            return;
        }

        const existingRoom = this.chatRooms().find(r => 
            r.senderId === realRecipientId || r.recipientId === realRecipientId
        );

        if (existingRoom) {
            if (!existingRoom.chatName) {
                existingRoom.chatName = realUsername;
            }
            this.onSelectUser(existingRoom);
            this.userToChat = '';
            return;
        }

        const newRoom: ChatRoom = {
            id: 'temp_' + Date.now(),
            chatId: `${this.currentUser().id}_${realRecipientId}`,
            senderId: this.currentUser().id,
            recipientId: realRecipientId,
            chatName: realUsername
        };
        
        this.chatRooms.update(rooms => [newRoom, ...rooms]);
        this.onSelectUser(newRoom);
        this.userToChat = '';
      },
      error: (err) => {
        if (err.status === 404) {
             alert(`Người dùng "${usernameInput}" không tồn tại!`);
        } else {
             console.error(err);
             alert('Lỗi hệ thống hoặc mất kết nối!');
        }
      }
    });
  }

  sendMessage() {
    if (!this.newMessage.trim() || !this.selectedUser()) return;

    const msg: ChatMessage = {
      senderId: this.currentUser().id,
      recipientId: this.selectedUser().id,
      content: this.newMessage,
      timestamp: new Date()
    };

    const isSent = this.chatService.sendMessage(msg);
    
    if (isSent) {
        this.messages.update(old => [...old, msg]);
        this.newMessage = '';
        if (this.typingTimeout) clearTimeout(this.typingTimeout);
    } else {
        alert('Không thể gửi tin nhắn. Vui lòng kiểm tra kết nối mạng!');
    }
  }

  getDisplayName(room: ChatRoom): string {
    if (room.chatName) return room.chatName;
    return room.senderId === this.currentUser().id ? room.recipientId : room.senderId;
  }

  getRecipientId(room: ChatRoom): string {
    return room.senderId === this.currentUser().id ? room.recipientId : room.senderId;
  }

  scrollToBottom() {
    setTimeout(() => {
        const element = document.getElementById('chat-container');
        if (element) element.scrollTop = element.scrollHeight;
    }, 50);
  }

  ngOnDestroy() {}
}