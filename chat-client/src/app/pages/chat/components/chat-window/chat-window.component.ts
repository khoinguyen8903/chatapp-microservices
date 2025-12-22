import { Component, inject, ElementRef, ViewChild, effect, OnDestroy, OnInit, Input, ChangeDetectionStrategy, ChangeDetectorRef, HostListener, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PickerModule } from '@ctrl/ngx-emoji-mart';
import { ChatFacade } from '../../chat.facade';
import { LastSeenPipe } from '../../pipes/last-seen.pipe';
import { SafeUrlPipe } from '../../pipes/safe-url.pipe';
import { FileNamePipe } from '../../pipes/file-name.pipe';
import { FileHelper } from '../../utils/file.helper';
import { MessageType, MessageStatus, ChatMessage, ChatSession, MessageReaction } from '../../../../models/chat.models';
import { NotificationService } from '../../../../services/notification.service';
import { ChatService } from '../../../../services/chat.service';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [CommonModule, FormsModule, PickerModule, LastSeenPipe, SafeUrlPipe, FileNamePipe],
  templateUrl: './chat-window.component.html',
  styleUrls: ['./chat-window.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush  // ✅ OnPush for better performance
})
export class ChatWindowComponent implements OnInit, OnDestroy {
  public facade = inject(ChatFacade);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  private notificationService = inject(NotificationService);
  private elementRef = inject(ElementRef);
  private chatService = inject(ChatService);

  // Mobile back button handler
  @Input() onBackToSidebar?: () => void;

  newMessage = '';
  showEmojiPicker = false;

  // --- Voice message (audio recording) ---
  isRecording = false;
  recordingTime = '00:00';
  mediaRecorder: MediaRecorder | null = null;
  audioChunks: any[] = [];
  recordingInterval: any = null;
  private recordingStream: MediaStream | null = null;
  private recordingStartTs = 0;

  // --- Long press (mobile) for reactions ---
  pressTimer: any = null;
  longPressDuration = 500;
  private longPressTriggered = false;

  // Desktop hover detection (avoid hover behavior on touch devices)
  private readonly isHoverCapable =
    typeof window !== 'undefined' &&
    typeof window.matchMedia !== 'undefined' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  
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
    this.cancelRecording();

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
    this.showEmojiPicker = false;
  }

  // --- Voice message actions ---
  async startRecording() {
    if (this.isRecording) return;
    if (!this.facade.selectedSession()) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.recordingStream = stream;

      // getUserMedia resolves outside Angular zone in some browsers -> wrap UI state updates
      this.ngZone.run(() => {
        // Reset state
        this.audioChunks = [];
        this.recordingStartTs = Date.now();
        this.recordingTime = '00:00';

        const recorder = new MediaRecorder(stream);
        this.mediaRecorder = recorder;

        recorder.ondataavailable = (event: BlobEvent) => {
          if (event?.data && event.data.size > 0) {
            this.audioChunks.push(event.data);
          }
        };

        // Start recording
        recorder.start();
        this.isRecording = true;
        this.showEmojiPicker = false;
        this.cdr.markForCheck();

        // Timer (MM:SS)
        if (this.recordingInterval) clearInterval(this.recordingInterval);
        this.recordingInterval = setInterval(() => {
          // Interval callbacks can also be outside zone -> update inside run()
          this.ngZone.run(() => {
            const elapsedSec = Math.floor((Date.now() - this.recordingStartTs) / 1000);
            const mm = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
            const ss = String(elapsedSec % 60).padStart(2, '0');
            this.recordingTime = `${mm}:${ss}`;
            this.cdr.markForCheck();
          });
        }, 1000);
      });
    } catch (err) {
      console.error('❌ [ChatWindow] Failed to start audio recording:', err);
      this.cancelRecording();
    }
  }

  stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      // Always stop interval ASAP
      if (this.recordingInterval) {
        clearInterval(this.recordingInterval);
        this.recordingInterval = null;
      }

      const recorder = this.mediaRecorder;
      if (!recorder) {
        this.isRecording = false;
        return reject(new Error('No active MediaRecorder'));
      }

      const finalize = () => {
        try {
          const blob = new Blob(this.audioChunks, { type: 'audio/webm' });

          // MediaRecorder events can fire outside zone -> reset UI state inside run()
          this.ngZone.run(() => {
            this.isRecording = false;
            this.mediaRecorder = null;
            this.audioChunks = [];
            this.recordingTime = '00:00';
            this.cdr.markForCheck();
          });

          // stop microphone
          if (this.recordingStream) {
            this.recordingStream.getTracks().forEach(t => t.stop());
            this.recordingStream = null;
          }
          resolve(blob);
        } catch (e) {
          reject(e);
        }
      };

      recorder.onstop = finalize;

      try {
        if (recorder.state !== 'inactive') recorder.stop();
        else finalize();
      } catch (e) {
        reject(e);
      }
    });
  }

  cancelRecording() {
    // Clear timer
    if (this.recordingInterval) {
      clearInterval(this.recordingInterval);
      this.recordingInterval = null;
    }

    // Stop recorder if running
    try {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
    } catch {
      // noop
    }

    // Stop microphone tracks
    if (this.recordingStream) {
      try {
        this.recordingStream.getTracks().forEach(t => t.stop());
      } catch {}
      this.recordingStream = null;
    }

    // Reset UI state inside zone (in case cancel happens from an async callback)
    this.ngZone.run(() => {
      this.mediaRecorder = null;
      this.audioChunks = [];
      this.recordingTime = '00:00';
      this.isRecording = false;
      this.cdr.markForCheck();
    });
  }

  async onSendRecording() {
    if (!this.isRecording) return;
    if (!this.facade.selectedSession()) return;

    try {
      const blob = await this.stopRecording();
      if (!blob || blob.size === 0) return;

      const timestamp = Date.now();
      const file = new File([blob], `voice_message_${timestamp}.webm`, { type: 'audio/webm' });

      // CRITICAL: use existing chatService.uploadFile(file)
      this.chatService.uploadFile(file).subscribe({
        next: (res: any) => {
          // Upload response can be either:
          // - a string URL
          // - or an object: { url, fileName, ... }
          const url: string | undefined =
            typeof res === 'string' ? res : (res?.url as string | undefined);

          console.log('Audio URL:', url);

          if (!url) {
            console.error('❌ [ChatWindow] Upload succeeded but URL is missing in response:', res);
            return;
          }

          console.log('Sending socket audio message...');

          const fileName = (typeof res === 'object' ? res?.fileName : undefined) || file.name;

          // Send immediately via WebSocket
          const ok = this.chatService.sendMessage({
            senderId: this.facade.currentUser().id,
            recipientId: this.facade.selectedSession()!.id,
            content: url,
            fileName,
            type: MessageType.AUDIO,
            id: `temp_${Date.now()}`,
            timestamp: new Date(),
            senderName: this.facade.currentUser().username,
            reactions: []
          });

          console.log('✅ [ChatWindow] sendMessage(AUDIO) returned:', ok);
        },
        error: (err) => console.error('❌ [ChatWindow] Voice upload failed:', err)
      });
    } catch (err) {
      console.error('❌ [ChatWindow] Failed to send recording:', err);
      this.cancelRecording();
    }
  }

  toggleEmojiPicker() {
    if (!this.facade.selectedSession()) return;
    this.showEmojiPicker = !this.showEmojiPicker;
  }

  onEmojiClick(event: any) {
    // ngx-emoji-mart emits EmojiEvent: { emoji: { native: "😀", ... }, ... }
    const emoji = event?.emoji?.native;
    if (!emoji) return;
    this.newMessage = `${this.newMessage}${emoji}`;
    // keep focus behavior simple; user can keep typing
  }

  // --- Reactions ---
  closeAllReactions() {
    // Close for all messages (tap outside behavior)
    this.facade.messages.update((msgs) =>
      msgs.map((m) => ({ ...m, showReactionBar: false }))
    );

    // Also cancel any pending long-press timer
    if (this.pressTimer) {
      clearTimeout(this.pressTimer);
      this.pressTimer = null;
    }
  }

  onMouseEnter(msg: ChatMessage) {
    if (!this.isHoverCapable) return;
    msg.showReactionBar = true;
  }

  onMouseLeave(msg: ChatMessage) {
    if (!this.isHoverCapable) return;
    msg.showReactionBar = false;
  }

  onTouchStart(msg: ChatMessage) {
    // Touch devices: long press to show reaction bar (normal tap does nothing)
    this.longPressTriggered = false;
    if (this.pressTimer) clearTimeout(this.pressTimer);

    this.pressTimer = setTimeout(() => {
      this.longPressTriggered = true;
      msg.showReactionBar = true;
    }, this.longPressDuration);
  }

  onTouchEnd(_msg: ChatMessage) {
    // If user releases before duration => normal tap (do nothing)
    if (this.pressTimer) {
      clearTimeout(this.pressTimer);
      this.pressTimer = null;
    }
  }

  onTouchCancel(_msg: ChatMessage) {
    if (this.pressTimer) {
      clearTimeout(this.pressTimer);
      this.pressTimer = null;
    }
  }

  onReact(message: ChatMessage, emojiType: string) {
    if (!message?.id) return;

    const userId = this.facade.currentUser()?.id;
    const chatId = message.chatId || this.facade.selectedSession()?.id;

    if (!userId || !chatId) {
      console.warn('⚠️ [ChatWindow] Missing userId/chatId for reaction');
      return;
    }

    const reactionPayload = {
      messageId: message.id,
      userId,
      chatId,
      type: emojiType
    };

    this.chatService.sendReaction(reactionPayload);

    // Hide bar immediately after click (UI helper)
    message.showReactionBar = false;
  }

  getReactionIcons(reactions?: MessageReaction[]) {
    const list = reactions || [];
    const seen = new Set<string>();
    const unique: string[] = [];

    // Always show MY reaction first (so user can see what they reacted with)
    const myUserId = this.facade.currentUser()?.id;
    if (myUserId) {
      const mine = list.find(r => r?.userId === myUserId && !!r?.type)?.type;
      if (mine) {
        seen.add(mine);
        unique.push(mine);
      }
    }

    for (const r of list) {
      const t = r?.type;
      if (!t) continue;
      if (seen.has(t)) continue;
      seen.add(t);
      unique.push(t);
      if (unique.length >= 3) break;
    }
    return unique;
  }

  getReactionTotal(reactions?: MessageReaction[]) {
    return (reactions || []).length;
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