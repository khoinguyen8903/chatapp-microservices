import { Component, OnInit, OnDestroy, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ChatService } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';
import { ChatMessage, ChatRoom } from '../../models/chat.models';

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

  constructor(
    private chatService: ChatService, 
    private authService: AuthService,
    private router: Router
  ) {
    // Tự động cuộn xuống khi có tin nhắn mới
    effect(() => {
      if (this.messages().length > 0) {
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

      // 3. Lắng nghe tin nhắn
      this.chatService.onMessage().subscribe((msg) => {
        if (msg) {
          const currentSelected = this.selectedUser();
          if (currentSelected && (msg.senderId === currentSelected.id || msg.senderId === this.currentUser().id)) {
            this.messages.update(old => [...old, msg]);
          }

          const isNewContact = !this.chatRooms().some(r => 
             r.senderId === msg.senderId || r.recipientId === msg.senderId
          );
          
          if (isNewContact) {
             this.loadRooms();
          }
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

  // Chọn phòng chat
  onSelectUser(room: ChatRoom) {
    const recipientId = this.getRecipientId(room);
    // Sử dụng helper để lấy tên hiển thị đẹp
    const displayName = this.getDisplayName(room);
    
    this.selectedUser.set({ id: recipientId, name: displayName });
    
    this.chatService.getChatMessages(this.currentUser().id, recipientId).subscribe(msgs => {
      this.messages.set(msgs); 
      this.scrollToBottom();
    });
  }

  // --- LOGIC TẠO CHAT MỚI (Lấy tên đẹp) ---
  startNewChat() {
    if (!this.userToChat.trim()) return;
    const usernameInput = this.userToChat.trim();
    
    this.authService.checkUserExists(usernameInput).subscribe({
      next: (res: any) => {
        const realRecipientId = res.userId; 
        const realUsername = res.username; // Tên thật từ DB

        if (realRecipientId === this.currentUser().id) {
            alert('Bạn không thể chat với chính mình!');
            return;
        }

        const existingRoom = this.chatRooms().find(r => 
            r.senderId === realRecipientId || r.recipientId === realRecipientId
        );

        if (existingRoom) {
            // Cập nhật tên hiển thị nếu chưa có
            if (!existingRoom.chatName) {
                existingRoom.chatName = realUsername;
            }
            this.onSelectUser(existingRoom);
            this.userToChat = '';
            return;
        }

        // Tạo phòng mới với tên hiển thị
        const newRoom: ChatRoom = {
            id: 'temp_' + Date.now(),
            chatId: `${this.currentUser().id}_${realRecipientId}`,
            senderId: this.currentUser().id,
            recipientId: realRecipientId,
            chatName: realUsername // Lưu tên vào đây
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

  // --- GỬI TIN NHẮN ---
  sendMessage() {
    if (!this.newMessage.trim() || !this.selectedUser()) return;

    const msg: ChatMessage = {
      senderId: this.currentUser().id,
      recipientId: this.selectedUser().id,
      content: this.newMessage,
      timestamp: new Date()
    };

    // Kiểm tra kết quả gửi
    const isSent = this.chatService.sendMessage(msg);
    
    if (isSent) {
        this.messages.update(old => [...old, msg]);
        this.newMessage = '';
    } else {
        alert('Không thể gửi tin nhắn. Vui lòng kiểm tra kết nối mạng!');
    }
  }

  // --- HELPER: Lấy tên hiển thị ---
  getDisplayName(room: ChatRoom): string {
    // 1. Ưu tiên tên đã lưu
    if (room.chatName) return room.chatName;
    
    // 2. Fallback: Dùng UUID (tránh lỗi trắng màn hình)
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