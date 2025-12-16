import { Component, inject, ElementRef, ViewChild, effect, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatFacade } from '../../chat.facade';
import { LastSeenPipe } from '../../pipes/last-seen.pipe';
import { FileHelper } from '../../utils/file.helper';
import { MessageType, MessageStatus } from '../../../../models/chat.models'; 
// [MỚI] Import NotificationService
import { NotificationService } from '../../../../services/notification.service';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [CommonModule, FormsModule, LastSeenPipe],
  templateUrl: './chat-window.component.html'
})
export class ChatWindowComponent implements OnDestroy { // [MỚI] Implement OnDestroy
  public facade = inject(ChatFacade);
  
  // [MỚI] Inject Notification Service
  private notificationService = inject(NotificationService);

  newMessage = '';
  
  FileHelper = FileHelper;
  MessageType = MessageType;
  MessageStatus = MessageStatus;

  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  constructor() {
    // Effect 1: Tự động cuộn xuống (Giữ nguyên)
    effect(() => {
      if (this.facade.messages().length > 0 || this.facade.isRecipientTyping()) {
        this.scrollToBottom();
      }
    });

    // [MỚI] Effect 2: Cập nhật Active Room cho Notification Service
    effect(() => {
      // Lấy session (phòng chat) đang được chọn từ Facade
      const currentSession = this.facade.selectedSession();

      if (currentSession) {
        // Nếu đang mở phòng chat -> Set ID phòng đó là Active
        // Lưu ý: Đảm bảo 'id' là field chứa ID của phòng chat (hoặc roomId)
        this.notificationService.setActiveRoom(currentSession.id);
      } else {
        // Nếu không chọn phòng nào -> Reset về null
        this.notificationService.setActiveRoom(null);
      }
    });
  }

  // [MỚI] Reset khi component bị hủy (Người dùng chuyển trang khác)
  ngOnDestroy() {
    this.notificationService.setActiveRoom(null);
  }

  // --- Các hàm cũ giữ nguyên bên dưới ---

  sendMessage() {
    if (!this.newMessage.trim()) return;
    this.facade.sendMessage(this.newMessage);
    this.newMessage = '';
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      event.target.value = '';
      this.facade.uploadFile(file).subscribe({
        next: (res: any) => {
            const url = res.url; 
            let type = MessageType.FILE;
            if (file.type.startsWith('image/')) type = MessageType.IMAGE;
            else if (file.type.startsWith('video/')) type = MessageType.VIDEO;
            
            this.facade.sendMessage(url, type, file);
        },
        error: (err) => console.error('Upload failed', err)
      });
    }
  }

  onInputTyping() {
    this.facade.sendTyping(true);
    setTimeout(() => this.facade.sendTyping(false), 2000);
  }

  scrollToBottom() {
    setTimeout(() => {
      if (this.scrollContainer?.nativeElement) {
        this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
      }
    }, 100);
  }
}