import { Component, OnInit, OnDestroy, signal, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { ChatFacade } from './chat.facade';
import { ChatSidebarComponent } from './components/chat-sidebar/chat-sidebar.component';
import { ChatWindowComponent } from './components/chat-window/chat-window.component';
import { CallModalComponent } from './components/call-modal/call-modal.component';
import { NotificationService } from '../../services/notification.service';
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

  // Mobile responsiveness state
  private breakpointObserver = inject(BreakpointObserver);
  isMobile = signal(false);
  showSidebar = signal(true);

  // Computed properties for responsive behavior
  isMobileView = computed(() => this.isMobile());
  shouldShowSidebar = computed(() => !this.isMobile() || this.showSidebar());

  // Stable callback reference for <app-chat-window> Input (avoid creating a new function in template)
  readonly onBackToSidebar = () => this.goBackToSidebar();

  constructor(
    private facade: ChatFacade,
    private notificationService: NotificationService,
    private authService: AuthService,
    private router: Router
  ) {
    // Effect to handle mobile session selection - hide sidebar when chat is selected
    effect(() => {
      const selectedSession = this.facade.selectedSession();
      if (this.isMobile() && selectedSession) {
        this.showSidebar.set(false);
      }
    });
  }

  ngOnInit() {
    // 1. Initialize mobile detection
    this.breakpointObserver.observe([
      Breakpoints.XSmall,
      Breakpoints.Small
    ]).subscribe((result: any) => {
      const wasMobile = this.isMobile();
      this.isMobile.set(result.matches);

      // When switching from desktop to mobile, ensure sidebar is shown initially
      if (!wasMobile && result.matches) {
        this.showSidebar.set(true);
      }
    });

    // 2. Khởi tạo Chat Facade (Load tin nhắn cũ, kết nối WebSocket...)
    this.facade.init();

    // 3. [QUAN TRỌNG] Lấy User ID thật từ LocalStorage
    const currentUserId = this.authService.getUserId();

    if (currentUserId) {
      console.log('🔹 Đang kích hoạt thông báo cho User ID:', currentUserId);
      // Gọi service để xin quyền và gửi token lên Server
      this.notificationService.requestPermission(currentUserId);
    } else {
      console.error('❌ Lỗi: Không tìm thấy User ID! Đang chuyển về trang đăng nhập...');
      this.router.navigate(['/login']);
    }
  }

  // Mobile navigation methods
  goBackToSidebar() {
    if (this.isMobile()) {
      this.showSidebar.set(true);
    }
  }

  ngOnDestroy() {
    this.facade.cleanup();
  }
}