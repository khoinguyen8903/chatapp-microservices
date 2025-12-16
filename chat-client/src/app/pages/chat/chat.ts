import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router'; // [MỚI] Import Router để đá về login nếu lỗi
import { ChatFacade } from './chat.facade';
import { ChatSidebarComponent } from './components/chat-sidebar/chat-sidebar.component';
import { ChatWindowComponent } from './components/chat-window/chat-window.component';
import { CallModalComponent } from './components/call-modal/call-modal.component';
import { NotificationService } from '../../services/notification.service';
// [MỚI] Import AuthService
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [
    CommonModule, 
    ChatSidebarComponent,
    ChatWindowComponent,
    CallModalComponent
  ],
  templateUrl: './chat.html',
  styleUrls: ['./chat.scss']
})
export class Chat implements OnInit, OnDestroy {
  
  constructor(
    private facade: ChatFacade,
    private notificationService: NotificationService,
    private authService: AuthService, // [MỚI] Inject AuthService
    private router: Router            // [MỚI] Inject Router
  ) {}

  ngOnInit() {
    // 1. Khởi tạo Chat Facade (Load tin nhắn cũ, kết nối WebSocket...)
    this.facade.init();

    // 2. [QUAN TRỌNG] Lấy User ID thật từ LocalStorage
    const currentUserId = this.authService.getUserId();

    if (currentUserId) {
      console.log('🔹 Đang kích hoạt thông báo cho User ID:', currentUserId);
      // Gọi service để xin quyền và gửi token lên Server
      this.notificationService.requestPermission(currentUserId);
    } else {
      // Trường hợp hiếm: Vào trang Chat nhưng không tìm thấy ID trong bộ nhớ
      console.error('❌ Lỗi: Không tìm thấy User ID! Đang chuyển về trang đăng nhập...');
      this.router.navigate(['/login']);
    }
  }

  ngOnDestroy() {
    this.facade.cleanup();
  }
}