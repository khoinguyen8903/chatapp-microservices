import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatFacade } from '../../chat.facade';

@Component({
  selector: 'app-chat-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-sidebar.component.html' // <-- Đã sửa thành templateUrl
})
export class ChatSidebarComponent {
  facade = inject(ChatFacade);
  userToChat = '';

  onSelectRoom(room: any) {
    this.facade.selectRoom(room);
  }

  getRecipientId(room: any): string {
    const currentId = this.facade.currentUser()?.id;
    return room.senderId === currentId ? room.recipientId : room.senderId;
  }

  startNewChat() {
    if (!this.userToChat.trim()) return;
    this.facade.findAndChatUser(this.userToChat.trim()).subscribe({
      next: (res: any) => {
        if (res.userId === this.facade.currentUser().id) { alert('Cannot chat with yourself'); return; }
        const newRoom = this.facade.createTempRoom(res.userId, res.username);
        this.facade.selectRoom(newRoom);
        this.userToChat = '';
      },
      error: () => alert('User not found!')
    });
  }
}