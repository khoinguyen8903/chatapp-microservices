import { Component, inject, ElementRef, ViewChild, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatFacade } from '../../chat.facade';
import { LastSeenPipe } from '../../pipes/last-seen.pipe';
import { FileHelper } from '../../utils/file.helper';
// [QUAN TRỌNG] Đảm bảo đường dẫn import đúng tới file models
import { MessageType, MessageStatus } from '../../../../models/chat.models'; 

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [CommonModule, FormsModule, LastSeenPipe],
  templateUrl: './chat-window.component.html'
})
export class ChatWindowComponent {
  public facade = inject(ChatFacade);
  newMessage = '';
  
  // Expose các Helper và Enum ra template để dùng trong HTML
  FileHelper = FileHelper;
  MessageType = MessageType;
  MessageStatus = MessageStatus;

  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  constructor() {
    // Tự động cuộn xuống dưới khi có tin nhắn mới hoặc đối phương đang nhập
    effect(() => {
      if (this.facade.messages().length > 0 || this.facade.isRecipientTyping()) {
        this.scrollToBottom();
      }
    });
  }

  // Gửi tin nhắn Text
  sendMessage() {
    if (!this.newMessage.trim()) return;
    
    // Facade sẽ tự biết đang chat với User hay Group dựa vào selectedSession
    this.facade.sendMessage(this.newMessage);
    this.newMessage = '';
  }

  // Xử lý chọn file (Ảnh/Video/File)
  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      // Reset giá trị input để có thể chọn lại cùng 1 file nếu muốn
      event.target.value = '';

      // Gọi Facade upload -> nhận về URL -> Gửi tin nhắn
      this.facade.uploadFile(file).subscribe({
        next: (res: any) => {
            // URL từ server trả về (Backend Java)
            const url = res.url; 
            
            // Tự động detect loại file
            let type = MessageType.FILE;
            if (file.type.startsWith('image/')) type = MessageType.IMAGE;
            else if (file.type.startsWith('video/')) type = MessageType.VIDEO;
            
            // Gửi message chứa URL
            this.facade.sendMessage(url, type, file);
        },
        error: (err) => console.error('Upload failed', err)
      });
    }
  }

  // Gửi sự kiện đang nhập (Typing...)
  onInputTyping() {
    this.facade.sendTyping(true);
    // Tự tắt sau 2 giây nếu không gõ nữa (Debounce đơn giản)
    setTimeout(() => this.facade.sendTyping(false), 2000);
  }

  // Hàm cuộn xuống đáy khung chat
  scrollToBottom() {
    setTimeout(() => {
      if (this.scrollContainer?.nativeElement) {
        this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
      }
    }, 100);
  }
}