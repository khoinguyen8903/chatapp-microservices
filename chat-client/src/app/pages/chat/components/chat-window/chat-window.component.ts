import { Component, inject, ElementRef, ViewChild, effect, OnDestroy, OnInit, Input, ChangeDetectionStrategy, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatFacade } from '../../chat.facade';
import { LastSeenPipe } from '../../pipes/last-seen.pipe';
import { SafeUrlPipe } from '../../pipes/safe-url.pipe';
import { FileNamePipe } from '../../pipes/file-name.pipe';
import { FileHelper } from '../../utils/file.helper';
import { MessageType, MessageStatus, ChatMessage, ChatSession } from '../../../../models/chat.models';
import { NotificationService } from '../../../../services/notification.service';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [CommonModule, FormsModule, LastSeenPipe, SafeUrlPipe, FileNamePipe],
  templateUrl: './chat-window.component.html',
  styleUrls: ['./chat-window.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush  // ✅ OnPush for better performance
})
export class ChatWindowComponent implements OnInit, OnDestroy {
  public facade = inject(ChatFacade);
  private cdr = inject(ChangeDetectorRef);
  private notificationService = inject(NotificationService);
  private elementRef = inject(ElementRef);

  // Mobile back button handler
  @Input() onBackToSidebar?: () => void;

  newMessage = '';
  
  // Expose enums to template
  MessageType = MessageType;
  MessageStatus = MessageStatus;

  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  // Stable listener references (so removeEventListener actually works)
  private readonly handleViewportChange = () => this.updateViewportHeight();
  private androidKeyboardHandler?: () => void;
  private androidDocFocusInHandler?: (e: FocusEvent) => void;
  private androidDocFocusOutHandler?: (e: FocusEvent) => void;

  private isResettingWindowScroll = false;

  // ✅ TrackBy function for *ngFor optimization
  trackByMessageId(index: number, message: ChatMessage): string | number {
    return message.id || index;
  }

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

  // ✅ Mobile: Initialize viewport height handling
  ngOnInit() {
    this.updateViewportHeight();

    // Listen for orientation changes and viewport changes
    window.addEventListener('resize', this.handleViewportChange);
    window.addEventListener('orientationchange', this.handleViewportChange);

    // Listen for visual viewport changes (keyboard open/close) - More aggressive for Android
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', this.handleViewportChange);
      // Also listen for scroll events on visual viewport (Android Chrome specific)
      window.visualViewport.addEventListener('scroll', this.handleViewportChange);
    }

    // Android Chrome specific: Listen for focus/blur events on inputs
    this.setupAndroidKeyboardHandling();
  }

  // ✅ Mobile: Handle viewport height changes for virtual keyboard
  private updateViewportHeight() {
    if (typeof window !== 'undefined') {
      let vh: number;

      // Use visualViewport if available (better for mobile keyboards)
      if (window.visualViewport) {
        vh = window.visualViewport.height;
      } else {
        vh = window.innerHeight;
      }

      // Ensure we have a reasonable viewport height (prevent very small values)
      if (vh && vh > 100) { // Minimum reasonable height
        // Set CSS custom property only on this component (scoped, not global)
        if (this.elementRef?.nativeElement) {
          this.elementRef.nativeElement.style.setProperty('--vh', `${vh}px`);

          // Also set visual viewport height for Android Chrome
          if (window.visualViewport) {
            this.elementRef.nativeElement.style.setProperty('--visual-vh', `${window.visualViewport.height}px`);
            this.elementRef.nativeElement.style.setProperty('--visual-vh-offset', `${window.innerHeight - window.visualViewport.height}px`);
          }
        }
      }
    }
  }

  // ✅ Android Chrome specific keyboard handling
  private setupAndroidKeyboardHandling() {
    // Detect Android Chrome
    const isAndroidChrome = /Android.*Chrome/.test(navigator.userAgent);

    if (isAndroidChrome && window.visualViewport) {
      // More aggressive viewport updates for Android Chrome
      this.androidKeyboardHandler = () => {
        setTimeout(() => {
          this.updateViewportHeight();
          // Force layout recalculation
          if (this.elementRef?.nativeElement) {
            this.elementRef.nativeElement.style.display = 'none';
            this.elementRef.nativeElement.offsetHeight; // Trigger reflow
            this.elementRef.nativeElement.style.display = '';
          }
        }, 100);
      };

      // Listen for visual viewport changes with shorter delay
      window.visualViewport.addEventListener('resize', this.androidKeyboardHandler);
      window.visualViewport.addEventListener('scroll', this.androidKeyboardHandler);

      // Listen for input focus events
      this.androidDocFocusInHandler = (e: FocusEvent) => {
        if (e.target && (e.target as HTMLElement).tagName === 'TEXTAREA') {
          this.androidKeyboardHandler?.();
        }
      };
      this.androidDocFocusOutHandler = () => this.androidKeyboardHandler?.();

      document.addEventListener('focusin', this.androidDocFocusInHandler);
      document.addEventListener('focusout', this.androidDocFocusOutHandler);
    }
  }

  private resetWindowScroll() {
    // Some mobile browsers will still "focus scroll" the window even with fixed body.
    // Snap back to 0 to keep the header in view.
    try {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    } catch {
      // noop
    }
  }

  @HostListener('window:scroll')
  onWindowScroll() {
    if (this.isResettingWindowScroll) return;
    if (typeof window !== 'undefined' && window.scrollY !== 0) {
      this.isResettingWindowScroll = true;
      this.resetWindowScroll();
      setTimeout(() => (this.isResettingWindowScroll = false), 0);
    }
  }

  // ✅ Mobile: Listen for focus events on input to ensure proper keyboard handling
  @HostListener('focusin', ['$event'])
  onFocusIn(event: FocusEvent) {
    const target = event.target as HTMLElement;
    if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')) {
      this.resetWindowScroll();

      // Android Chrome specific: More aggressive handling
      const isAndroidChrome = /Android.*Chrome/.test(navigator.userAgent);

      if (isAndroidChrome) {
        // Prevent scroll during keyboard opening
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        this.resetWindowScroll();

        // Force viewport update with multiple attempts
        this.updateViewportHeight();
        setTimeout(() => this.updateViewportHeight(), 50);
        setTimeout(() => this.updateViewportHeight(), 150);
        setTimeout(() => this.updateViewportHeight(), 300);

        // Scroll to bottom with delay
        setTimeout(() => {
          this.scrollToBottom();
        }, 200);
      } else {
        // Standard handling for other devices
        setTimeout(() => {
          this.resetWindowScroll();
          this.updateViewportHeight();
          this.scrollToBottom();
        }, 100);
      }
    }
  }

  // ✅ Mobile: Listen for focus out events
  @HostListener('focusout', ['$event'])
  onFocusOut(event: FocusEvent) {
    const target = event.target as HTMLElement;
    if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')) {
      // Android Chrome specific: Restore scroll
      const isAndroidChrome = /Android.*Chrome/.test(navigator.userAgent);
      if (isAndroidChrome) {
        setTimeout(() => {
          document.body.style.overflow = '';
          document.documentElement.style.overflow = '';
        }, 100);
      }

      // Update viewport when keyboard closes
      setTimeout(() => {
        this.updateViewportHeight();
      }, 100);
    }
  }

  // [MỚI] Reset khi component bị hủy (Người dùng chuyển trang khác)
  ngOnDestroy() {
    this.notificationService.setActiveRoom(null);

    // Cleanup event listeners
    window.removeEventListener('resize', this.handleViewportChange);
    window.removeEventListener('orientationchange', this.handleViewportChange);

    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', this.handleViewportChange);
      window.visualViewport.removeEventListener('scroll', this.handleViewportChange);

      if (this.androidKeyboardHandler) {
        window.visualViewport.removeEventListener('resize', this.androidKeyboardHandler);
        window.visualViewport.removeEventListener('scroll', this.androidKeyboardHandler);
      }
    }

    if (this.androidDocFocusInHandler) {
      document.removeEventListener('focusin', this.androidDocFocusInHandler);
    }
    if (this.androidDocFocusOutHandler) {
      document.removeEventListener('focusout', this.androidDocFocusOutHandler);
    }
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
            const fileName = res.fileName; // Use original filename from backend
            let type = MessageType.FILE;
            if (file.type.startsWith('image/')) type = MessageType.IMAGE;
            else if (file.type.startsWith('video/')) type = MessageType.VIDEO;
            
            // Pass the fileName from backend response
            this.facade.sendMessage(url, type, undefined, fileName);
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
    const isAndroidChrome = /Android.*Chrome/.test(navigator.userAgent);

    const scrollToBottomFn = () => {
      if (this.scrollContainer?.nativeElement) {
        const container = this.scrollContainer.nativeElement;
        container.scrollTop = container.scrollHeight;

        // Android Chrome specific: Ensure scroll actually happens
        if (isAndroidChrome) {
          // Force a reflow and scroll again
          container.offsetHeight;
          setTimeout(() => {
            container.scrollTop = container.scrollHeight;
          }, 10);
        }
      }
    };

    if (isAndroidChrome) {
      // Multiple attempts for Android Chrome
      setTimeout(scrollToBottomFn, 50);
      setTimeout(scrollToBottomFn, 150);
      setTimeout(scrollToBottomFn, 300);
    } else {
      setTimeout(scrollToBottomFn, 100);
    }
  }

  onAvatarError(event: Event) {
    const img = event.target as HTMLImageElement | null;
    if (!img) return;
    img.src = 'assets/default-avatar.svg';
  }
}