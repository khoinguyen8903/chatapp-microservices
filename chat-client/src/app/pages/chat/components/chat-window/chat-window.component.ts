import { Component, inject, ElementRef, ViewChild, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatFacade } from '../../chat.facade';
import { LastSeenPipe } from '../../pipes/last-seen.pipe';
import { FileHelper } from '../../utils/file.helper';
import { MessageType } from '../../../../models/chat.models';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [CommonModule, FormsModule, LastSeenPipe],
  templateUrl: './chat-window.component.html' // <-- Đã sửa thành templateUrl
})
export class ChatWindowComponent {
  facade = inject(ChatFacade);
  newMessage = '';
  FileHelper = FileHelper;
  MessageType = MessageType;
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  constructor() {
    effect(() => {
      if (this.facade.messages().length > 0 || this.facade.isRecipientTyping()) {
        this.scrollToBottom();
      }
    });
  }

  sendMessage() {
    if (!this.newMessage.trim()) return;
    this.facade.sendMessage(this.newMessage);
    this.newMessage = '';
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.facade.uploadFile(file).subscribe((res: any) => {
        const url = FileHelper.sanitizeUrl(res.url);
        let type = MessageType.FILE;
        if (file.type.startsWith('image/')) type = MessageType.IMAGE;
        else if (file.type.startsWith('video/')) type = MessageType.VIDEO;
        
        this.facade.sendMessage(url, type, file);
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