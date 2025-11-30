import { Component, OnInit, OnDestroy, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ChatService } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service'; // 1. Đã Import
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
    private authService: AuthService, // 2. ĐÃ SỬA: Inject AuthService vào đây
    private router: Router
  ) {
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
      
      this.chatService.connect(this.currentUser());
      this.loadRooms();

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

  onSelectUser(room: ChatRoom) {
    const recipientId = this.getRecipientId(room);
    this.selectedUser.set({ id: recipientId, name: recipientId });
    
    this.chatService.getChatMessages(this.currentUser().id, recipientId).subscribe(msgs => {
      this.messages.set(msgs); 
      this.scrollToBottom();
    });
  }

  // --- 3. ĐÃ SỬA: LOGIC KIỂM TRA USER TRƯỚC KHI TẠO ---
  startNewChat() {
    if (!this.userToChat.trim()) return;
    const recipientId = this.userToChat.trim();
    
    if (recipientId === this.currentUser().id) {
        alert('Bạn không thể chat với chính mình!');
        return;
    }

    // Kiểm tra xem đã có trong danh sách chưa
    const existingRoom = this.chatRooms().find(r => 
        r.senderId === recipientId || r.recipientId === recipientId
    );

    if (existingRoom) {
        this.onSelectUser(existingRoom);
        this.userToChat = '';
        return; // Đã có phòng thì mở luôn, không cần check API
    }

    // GỌI API KIỂM TRA USER TỒN TẠI KHÔNG
    this.authService.checkUserExists(recipientId).subscribe({
      next: () => {
        // --- NẾU USER TỒN TẠI (API trả về 200 OK) ---
        // Tạo phòng "giả" tạm thời ở Client
        const newRoom: ChatRoom = {
            id: 'temp_' + Date.now(),
            chatId: `${this.currentUser().id}_${recipientId}`,
            senderId: this.currentUser().id,
            recipientId: recipientId
        };
        
        this.chatRooms.update(rooms => [newRoom, ...rooms]);
        this.onSelectUser(newRoom);
        this.userToChat = '';
      },
      error: (err) => {
        // --- NẾU USER KHÔNG TỒN TẠI (API trả về 404) ---
        alert(`Người dùng "${recipientId}" không tồn tại trong hệ thống!`);
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

    this.chatService.sendMessage(msg);
    this.messages.update(old => [...old, msg]);
    this.newMessage = '';
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