import { Component, OnInit, OnDestroy, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ChatService } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';
import { ChatMessage, ChatRoom, TypingMessage } from '../../models/chat.models'; // Import thêm TypingMessage

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
  isRecipientTyping = signal(false); // Người kia có đang gõ không?
  private typingTimeout: any;        // Biến đếm ngược để dừng gõ
  // ---------------------------------

  constructor(
    private chatService: ChatService, 
    private authService: AuthService,
    private router: Router
  ) {
    // Tự động cuộn xuống khi có tin nhắn mới HOẶC khi người kia đang gõ
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
      
      // 1. Kết nối Socket
      this.chatService.connect(this.currentUser());
      
      // 2. Tải danh sách phòng
      this.loadRooms();

      // 3. Lắng nghe tin nhắn Chat
      this.chatService.onMessage().subscribe((msg) => {
        if (msg) {
          const currentSelected = this.selectedUser();
          if (currentSelected && (msg.senderId === currentSelected.id || msg.senderId === this.currentUser().id)) {
            this.messages.update(old => [...old, msg]);
            // Nhận tin nhắn xong -> Chắc chắn họ đã dừng gõ -> Tắt typing
            this.isRecipientTyping.set(false);
          }

          // Reload phòng nếu có người lạ nhắn
          const isNewContact = !this.chatRooms().some(r => 
             r.senderId === msg.senderId || r.recipientId === msg.senderId
          );
          
          if (isNewContact) {
             this.loadRooms();
          }
        }
      });

      // 4. Lắng nghe sự kiện Typing (Đang gõ...)
      this.chatService.onTyping().subscribe((typingMsg) => {
        const currentSelected = this.selectedUser();
        // Chỉ hiện nếu người đang gõ đúng là người mình đang chat
        if (currentSelected && typingMsg.senderId === currentSelected.id) {
            this.isRecipientTyping.set(typingMsg.isTyping);
        }
      });

    } else {
        this.router.navigate(['/login']);
    }
  }

  loadRooms() {
    this.chatService.getChatRooms(this.currentUser().id).subscribe({
      next: (rooms) => this.chatRooms.set(rooms),
      error: (err) => console.error('Lỗi tải phòng chat', err)
    });
  }

  onSelectUser(room: ChatRoom) {
    const recipientId = this.getRecipientId(room);
    const displayName = this.getDisplayName(room);
    
    this.selectedUser.set({ id: recipientId, name: displayName });
    
    // Reset trạng thái typing khi chuyển phòng
    this.isRecipientTyping.set(false);
    
    this.chatService.getChatMessages(this.currentUser().id, recipientId).subscribe(msgs => {
      this.messages.set(msgs); 
      this.scrollToBottom();
    });
  }

  // --- HÀM XỬ LÝ KHI MÌNH GÕ PHÍM (Gọi từ HTML) ---
  onInputTyping() {
    if (!this.selectedUser()) return;

    // Gửi sự kiện "Đang gõ" (True)
    const typingMsg: TypingMessage = {
        senderId: this.currentUser().id,
        recipientId: this.selectedUser().id,
        isTyping: true
    };
    this.chatService.sendTyping(typingMsg);

    // Debounce: Nếu ngừng gõ sau 1.5s -> Gửi sự kiện "Dừng gõ" (False)
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

  // --- TẠO PHÒNG CHAT MỚI (Logic chuẩn UUID) ---
  startNewChat() {
    if (!this.userToChat.trim()) return;
    const usernameInput = this.userToChat.trim();
    
    // Gọi API check user để lấy ID thật (UUID)
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

        // Tạo phòng với UUID
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

    // Kiểm tra mạng trước khi gửi
    const isSent = this.chatService.sendMessage(msg);
    
    if (isSent) {
        this.messages.update(old => [...old, msg]);
        this.newMessage = '';
        // Gửi xong thì xóa timeout gõ phím
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

  ngOnDestroy() {
    // Có thể ngắt kết nối socket nếu muốn
  }
}