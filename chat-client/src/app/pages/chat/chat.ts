import { Component, OnInit, OnDestroy, signal, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
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
    private router: Router,
    private route: ActivatedRoute
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

    // 4. Handle "startChatWith" query parameter (coming from user profile page)
    this.route.queryParams.subscribe(params => {
      const startChatWithUserId = params['startChatWith'];
      if (startChatWithUserId) {
        console.log('💬 Starting chat with user:', startChatWithUserId);
        this.handleStartChatWith(startChatWithUserId);
        
        // Clear the query parameter from URL
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {},
          replaceUrl: true
        });
      }
    });
  }

  /**
   * Handle starting a chat with a specific user (from profile page)
   */
  private handleStartChatWith(userId: string) {
    // Wait for sessions to load, then find or create conversation
    setTimeout(() => {
      const sessions = this.facade.sessions();
      
      // Check if we already have a conversation with this user
      const existingSession = sessions.find(s => 
        s.type === 'PRIVATE' && s.id === userId
      );

      if (existingSession) {
        // Select existing conversation
        console.log('📨 Found existing conversation with user:', userId);
        this.facade.selectSession(existingSession);
      } else {
        // Create a temporary session (will be created on first message)
        console.log('🆕 Creating new conversation with user:', userId);
        // Fetch user info to get their name
        this.authService.getUserById(userId).subscribe({
          next: (user: any) => {
            this.facade.createTempSession(userId, user.username || 'User');
          },
          error: () => {
            // Fallback if user info fetch fails
            this.facade.createTempSession(userId, 'User');
          }
        });
      }
    }, 500); // Small delay to ensure sessions are loaded
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