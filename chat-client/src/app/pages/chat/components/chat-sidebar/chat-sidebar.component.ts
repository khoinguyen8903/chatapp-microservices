import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ChatFacade } from '../../chat.facade';
import { ChatSession } from '../../../../models/chat.models'; // Kiểm tra lại đường dẫn import này cho đúng project của bạn
import { CreateGroupModalComponent } from '../create-group-modal/create-group-modal.component';
import { AvatarInitialPipe } from '../../pipes/avatar-initial.pipe';

@Component({
  selector: 'app-chat-sidebar',
  standalone: true,
  // [QUAN TRỌNG] Phải import CreateGroupModalComponent vào đây mới dùng được trong HTML
  imports: [CommonModule, FormsModule, CreateGroupModalComponent, AvatarInitialPipe],
  templateUrl: './chat-sidebar.component.html',
  styleUrls: ['./chat-sidebar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush  // ✅ OnPush for better performance
})
export class ChatSidebarComponent {
  facade = inject(ChatFacade);
  router = inject(Router);
  userToChat = '';

  // [MỚI] Biến signal để điều khiển việc hiển thị Modal
  showCreateGroupModal = signal(false);

  // ✅ TrackBy function for *ngFor optimization
  trackBySessionId(index: number, session: ChatSession): string {
    return session.id;
  }

  // Hàm chọn hội thoại (User hoặc Group)
  onSelectSession(session: ChatSession) {
    this.facade.selectSession(session);
  }

  // Logic chat 1-1: Tìm người dùng và tạo session tạm
  startNewChat() {
    if (!this.userToChat.trim()) return;
    
    this.facade.findAndChatUser(this.userToChat.trim()).subscribe({
      next: (res: any) => {
        if (res.userId === this.facade.currentUser().id) { 
            alert('Không thể chat với chính mình'); 
            return; 
        }
        
        this.facade.createTempSession(res.userId, res.username);
        this.userToChat = '';
      },
      error: () => alert('Không tìm thấy người dùng này!')
    });
  }

  // [ĐÃ SỬA] Thay vì dùng prompt, giờ ta bật Modal lên
  openCreateGroupModal() {
    this.showCreateGroupModal.set(true);
  }

  // Navigate to profile page
  goToProfile() {
    this.router.navigate(['/profile']);
  }
}