import { Component, inject, ElementRef, ViewChild, effect, OnDestroy, OnInit, Input, ChangeDetectionStrategy, ChangeDetectorRef, HostListener, NgZone, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { PickerModule } from '@ctrl/ngx-emoji-mart';
import { ChatFacade } from '../../chat.facade';
import { LastSeenPipe } from '../../pipes/last-seen.pipe';
import { SafeUrlPipe } from '../../pipes/safe-url.pipe';
import { FileNamePipe } from '../../pipes/file-name.pipe';
import { FileHelper } from '../../utils/file.helper';
import { MessageType, MessageStatus, ChatMessage, ChatSession, MessageReaction } from '../../../../models/chat.models';
import { NotificationService } from '../../../../services/notification.service';
import { ChatService } from '../../../../services/chat.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, PickerModule, LastSeenPipe, SafeUrlPipe, FileNamePipe],
  templateUrl: './chat-window.component.html',
  styleUrls: ['./chat-window.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush  // ✅ OnPush for better performance
})
// Note: SlicePipe is included in CommonModule, HttpClient is provided at app level, RouterModule for routerLink
export class ChatWindowComponent implements OnInit, OnDestroy {
  public facade = inject(ChatFacade);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  private notificationService = inject(NotificationService);
  private elementRef = inject(ElementRef);
  private chatService = inject(ChatService);
  private http = inject(HttpClient);

  // Mobile back button handler
  @Input() onBackToSidebar?: () => void;

  newMessage = '';
  showEmojiPicker = false;

  // --- RIGHT SIDEBAR STATE ---
  showRightSidebar = false;
  isMediaSectionOpen = false;
  activeMediaTab: 'media' | 'files' = 'media';
  mediaItems: ChatMessage[] = [];
  fileItems: ChatMessage[] = [];
  isLoadingMedia = false;
  lightboxItem: ChatMessage | null = null;

  // --- GROUP MEMBERS STATE ---
  showGroupMembers = false;
  groupMembers: Array<{ id: string; username: string; fullName?: string; avatarUrl?: string }> = [];
  isLoadingMembers = false;

  // --- MUTE STATE ---
  isMuted = false;

  // --- SEARCH IN CHAT STATE ---
  isSearchMode = false;
  searchKeyword = '';
  searchResults: ChatMessage[] = [];
  isSearching = false;
  hasSearched = false;

  // --- Voice message (audio recording) ---
  isRecording = false;
  recordingTime = '00:00';
  mediaRecorder: MediaRecorder | null = null;
  audioChunks: any[] = [];
  recordingInterval: any = null;
  private recordingStream: MediaStream | null = null;
  private recordingStartTs = 0;

  // --- [NEW] Context Menu for Message Actions ---
  contextMenuVisible = false;
  contextMenuMsg: ChatMessage | null = null;
  contextMenuPosition = { x: 0, y: 0 };
  
  // --- [NEW] Reply feature ---
  replyingToMsg: ChatMessage | null = null;

  // --- [NEW] Inline Action Buttons ---
  hoveredMessageId: string | null = null;
  longPressMessageId: string | null = null;

  // --- Long press (mobile) for reactions ---
  pressTimer: any = null;
  longPressDuration = 500;
  private longPressTriggered = false;

  // --- Mobile touch handling (Long Press = Menu, Tap = Toggle Status) ---
  touchTimer: any = null;
  isLongPress: boolean = false;
  private touchJustHandled: boolean = false; // Prevent click after touch

  // Desktop hover detection (avoid hover behavior on touch devices)
  private readonly isHoverCapable =
    typeof window !== 'undefined' &&
    typeof window.matchMedia !== 'undefined' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // --- Context menu UX helpers ---
  private isMobileViewport(): boolean {
    // Mobile breakpoint requested: <= 768
    // Also treat non-hover devices as "mobile-like" (touch-first)
    return (typeof window !== 'undefined' && window.innerWidth <= 768) || !this.isHoverCapable;
  }

  get menuStyle(): Record<string, any> {
    // Mobile: bottom sheet positioning is handled via CSS only
    if (this.isMobileViewport()) return {};
    return {
      left: `${this.contextMenuPosition.x}px`,
      top: `${this.contextMenuPosition.y}px`
    };
  }

  private clampToViewport(pos: { x: number; y: number }): { x: number; y: number } {
    // Keep menu inside viewport on desktop to avoid overflow/jumping.
    // Use a conservative estimate for menu size (it varies based on options).
    const menuW = 240;
    const menuH = 240;
    const margin = 12;

    const vw = typeof window !== 'undefined' ? window.innerWidth : 0;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 0;

    const maxX = Math.max(margin, vw - menuW - margin);
    const maxY = Math.max(margin, vh - menuH - margin);

    return {
      x: Math.min(Math.max(pos.x, margin), maxX),
      y: Math.min(Math.max(pos.y, margin), maxY)
    };
  }
  
  // Expose enums to template
  MessageType = MessageType;
  MessageStatus = MessageStatus;

  // --- Audio UI state (duration cache, one-at-a-time playback) ---
  private audioDurationByMessageKey = new Map<string, number>(); // seconds
  private currentlyPlayingAudioKey: string | null = null;
  private audioDurationResolveInFlight = new Set<string>();
  private audioCtx: AudioContext | null = null;

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
    
    // If replying, send with replyToId
    if (this.replyingToMsg && this.replyingToMsg.id) {
      this.facade.sendMessage(this.newMessage, this.replyingToMsg.id);
      this.replyingToMsg = null; // Clear reply after sending
    } else {
      this.facade.sendMessage(this.newMessage);
    }
    
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

    // [NEW] Hide action buttons and close context menu
    this.hoveredMessageId = null;
    this.longPressMessageId = null;
    this.closeContextMenu();
  }

  onMouseEnter(msg: ChatMessage) {
    if (!this.isHoverCapable) return;
    if (msg.messageStatus === 'REVOKED') return; // Don't show actions for revoked messages
    this.hoveredMessageId = msg.id || null;
  }

  onMouseLeave(msg: ChatMessage) {
    if (!this.isHoverCapable) return;
    this.hoveredMessageId = null;
  }

  // --- Mobile Touch Handling: Long Press = Menu, Tap = Toggle Status ---
  onTouchStart(event: TouchEvent, msg: ChatMessage) {
    // Desktop: existing behavior for action buttons (long press to show actions)
    if (!this.isMobileViewport()) {
      this.longPressTriggered = false;
      if (this.pressTimer) clearTimeout(this.pressTimer);

      this.pressTimer = setTimeout(() => {
        this.longPressTriggered = true;
        if (msg.messageStatus !== 'REVOKED') {
          this.longPressMessageId = msg.id || null;
        }
      }, this.longPressDuration);
      return;
    }

    // Mobile: Long press to open context menu, tap to toggle status
    this.isLongPress = false;
    if (this.touchTimer) clearTimeout(this.touchTimer);

    this.touchTimer = setTimeout(() => {
      this.isLongPress = true;
      // Long press detected → Open context menu (bottom sheet)
      this.onMobileContextMenu(event, msg);
    }, 500); // 500ms threshold for long press
  }

  onTouchEnd(event: TouchEvent, msg: ChatMessage) {
    // Desktop behavior
    if (!this.isMobileViewport()) {
      if (this.pressTimer) {
        clearTimeout(this.pressTimer);
        this.pressTimer = null;
      }
      return;
    }

    // Mobile: Clear timer and check for tap
    if (this.touchTimer) {
      clearTimeout(this.touchTimer);
      this.touchTimer = null;
    }

    // If it wasn't a long press, it's a TAP → toggle status info (Time/Seen)
    if (!this.isLongPress) {
      // Ignore taps on interactive elements
      const target = event.target as HTMLElement | null;
      if (target?.closest('button, a, input, textarea, audio, video, .reaction-bar, .message-actions, .emoji-picker-popover, .context-menu')) {
        return;
      }
      
      // Toggle showStatus on the message via signal update (OnPush compatible)
      const msgId = msg.id;
      if (msgId) {
        this.facade.messages.update((msgs) =>
          msgs.map((m) => m.id === msgId ? { ...m, showStatus: !m.showStatus } : m)
        );
      }
    }

    // Set flag to prevent click event from opening menu
    this.touchJustHandled = true;
    setTimeout(() => {
      this.touchJustHandled = false;
    }, 100);
  }

  onTouchMove(event: TouchEvent, msg: ChatMessage) {
    // Cancel long press timer if user moves finger (prevents accidental menu open while scrolling)
    if (this.touchTimer) {
      clearTimeout(this.touchTimer);
      this.touchTimer = null;
    }
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
    if (this.touchTimer) {
      clearTimeout(this.touchTimer);
      this.touchTimer = null;
    }
    this.longPressMessageId = null;
    this.isLongPress = false;
  }

  /**
   * Mobile context menu (bottom sheet) - triggered by long press
   */
  onMobileContextMenu(event: TouchEvent, msg: ChatMessage) {
    event.preventDefault();
    event.stopPropagation();

    // Skip revoked messages
    if (msg.messageStatus === 'REVOKED') return;

    // Open context menu (bottom sheet on mobile via CSS)
    this.contextMenuMsg = msg;
    this.contextMenuVisible = true;

    // Vibration feedback (nice haptic response)
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }

    // Hide action buttons
    this.hoveredMessageId = null;
    this.longPressMessageId = null;

    this.cdr.markForCheck();
  }

  /**
   * Check if action buttons should be visible for a message
   */
  shouldShowActions(msg: ChatMessage): boolean {
    if (msg.messageStatus === 'REVOKED') return false;
    return this.hoveredMessageId === msg.id || this.longPressMessageId === msg.id;
  }

  /**
   * Open emoji picker for quick reaction (shows the reaction bar)
   */
  openQuickReaction(event: Event, msg: ChatMessage) {
    event.stopPropagation();
    msg.showReactionBar = true;
  }

  /**
   * Open more options menu (three dots menu)
   */
  openMoreOptions(event: MouseEvent | TouchEvent, msg: ChatMessage) {
    event.preventDefault();
    event.stopPropagation();

    // Desktop: place menu near pointer; Mobile: bottom sheet (CSS handles position).
    if (!this.isMobileViewport()) {
      let x: number, y: number;
      if (event instanceof MouseEvent) {
        x = event.clientX;
        y = event.clientY;
      } else {
        const touch = event.touches[0] || event.changedTouches[0];
        x = touch.clientX;
        y = touch.clientY;
      }
      this.contextMenuPosition = this.clampToViewport({ x, y });
    }

    this.contextMenuMsg = msg;
    this.contextMenuVisible = true;
    
    // Hide action buttons when menu opens
    this.hoveredMessageId = null;
    this.longPressMessageId = null;
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

  // --- [NEW] Context Menu Actions ---

  /**
   * Open context menu on right-click (desktop) or long-press (mobile)
   */
  onRightClick(event: MouseEvent, msg: ChatMessage) {
    // Desktop only: Mobile uses tap-to-open bottom sheet.
    if (this.isMobileViewport()) return;

    // Prevent default browser context menu
    event.preventDefault();
    event.stopPropagation();
    
    // Position the menu at the click location
    this.contextMenuPosition = this.clampToViewport({ x: event.clientX, y: event.clientY });
    
    this.contextMenuMsg = msg;
    this.contextMenuVisible = true;
  }

  /**
   * Handle long-press on mobile for context menu
   */
  onLongPress(msg: ChatMessage, event: TouchEvent) {
    // Mobile: long-press-to-open is deprecated in favor of single tap.
    if (this.isMobileViewport()) return;

    event.preventDefault();
    event.stopPropagation();
    
    // Position menu at touch location
    const touch = event.touches[0] || event.changedTouches[0];
    this.contextMenuPosition = {
      x: touch.clientX,
      y: touch.clientY
    };
    
    this.contextMenuMsg = msg;
    this.contextMenuVisible = true;
  }

  /**
   * Mobile: click fallback - now deprecated in favor of touch events.
   * Touch handling: Long Press = Menu, Tap = Toggle Status
   * Desktop: do nothing (right-click handles it).
   */
  onMobileMessageClick(event: MouseEvent, msg: ChatMessage) {
    if (!this.isMobileViewport()) return;

    // If touch events already handled this interaction, skip click handling
    if (this.touchJustHandled) {
      return;
    }

    // Ignore clicks on interactive elements inside the message bubble
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, a, input, textarea, audio, video, .reaction-bar, .message-actions, .emoji-picker-popover, .context-menu')) {
      return;
    }

    // For non-touch devices that still trigger click (rare on mobile),
    // toggle status as fallback
    event.preventDefault();
    event.stopPropagation();

    // Toggle showStatus via signal update (OnPush compatible)
    const msgId = msg.id;
    if (msgId) {
      this.facade.messages.update((msgs) =>
        msgs.map((m) => m.id === msgId ? { ...m, showStatus: !m.showStatus } : m)
      );
    }
  }

  /**
   * Close context menu
   */
  closeContextMenu() {
    this.contextMenuVisible = false;
    this.contextMenuMsg = null;
  }

  /**
   * Check if the current user can revoke the message
   */
  canRevokeMessage(msg: ChatMessage): boolean {
    return msg.senderId === this.facade.currentUser()?.id && msg.messageStatus !== 'REVOKED';
  }

  /**
   * Check if message is text (for copy feature)
   */
  isTextMessage(msg: ChatMessage): boolean {
    return msg.type === MessageType.TEXT;
  }

  /**
   * Copy message text to clipboard
   */
  handleCopy(msg: ChatMessage) {
    if (!msg.content) return;
    
    navigator.clipboard.writeText(msg.content).then(() => {
      console.log('✅ [ChatWindow] Message copied to clipboard');
      // You can show a toast notification here if needed
    }).catch(err => {
      console.error('❌ [ChatWindow] Failed to copy:', err);
    });
    
    this.closeContextMenu();
  }

  /**
   * Reply to a message
   */
  handleReply(msg: ChatMessage) {
    this.replyingToMsg = msg;
    this.closeContextMenu();
    
    // Focus on the input field
    setTimeout(() => {
      const textarea = document.querySelector('.message-input') as HTMLTextAreaElement;
      textarea?.focus();
    }, 100);
  }

  /**
   * Cancel reply
   */
  cancelReply() {
    this.replyingToMsg = null;
  }

  /**
   * Revoke/unsend a message (with confirmation)
   */
  handleRevoke(msg: ChatMessage) {
    if (!this.canRevokeMessage(msg)) return;
    
    // Show confirmation dialog
    const confirmed = confirm('Tin nhắn này sẽ bị thu hồi ở cả 2 phía. Bạn có chắc không?');
    
    if (!confirmed) {
      this.closeContextMenu();
      return;
    }
    
    const chatId = msg.chatId || this.facade.selectedSession()?.id;
    if (!msg.id || !chatId) {
      console.error('❌ [ChatWindow] Missing messageId or chatId for revoke');
      this.closeContextMenu();
      return;
    }
    
    // Send revoke request via WebSocket
    const success = this.chatService.revokeMessage(msg.id, chatId);
    
    if (success) {
      console.log('🚫 [ChatWindow] Revoke request sent for message:', msg.id);
      const before = this.facade.messages();
      const wasLast = !!before.length && !!before[before.length - 1]?.id && before[before.length - 1]?.id === msg.id;

      // Optimistically update UI
      this.facade.messages.update(msgs => 
        msgs.map(m => m.id === msg.id ? { ...m, messageStatus: 'REVOKED' } : m)
      );

      // Sync sidebar immediately if this was the latest message in the current chat
      if (wasLast) {
        const sessionId = this.facade.selectedSession()?.id;
        if (sessionId) {
          this.chatService.updateChatRoomPreview(sessionId, { ...msg, messageStatus: 'REVOKED' });
        }
      }
    } else {
      console.error('❌ [ChatWindow] Failed to send revoke request');
    }
    
    this.closeContextMenu();
  }

  /**
   * Delete message for current user only (with confirmation)
   */
  handleDeleteForMe(msg: ChatMessage) {
    // Show confirmation dialog
    const confirmed = confirm('Tin nhắn này sẽ chỉ bị xóa ở phía bạn. Người khác vẫn xem được. Bạn có chắc không?');
    
    if (!confirmed) {
      this.closeContextMenu();
      return;
    }
    
    const userId = this.facade.currentUser()?.id;
    if (!msg.id || !userId) {
      console.error('❌ [ChatWindow] Missing messageId or userId for delete');
      this.closeContextMenu();
      return;
    }
    
    // Call delete API for persisted messages
    this.chatService.deleteMessageForMe(msg.id, userId).subscribe({
      next: () => {
        console.log('🗑️ [ChatWindow] Message deleted for user:', userId);

        // Sync sidebar preview only if the deleted message was the last one in this chat
        const before = this.facade.messages();
        const wasLast = !!before.length && !!before[before.length - 1]?.id && before[before.length - 1]?.id === msg.id;

        let newLastMsg: ChatMessage | null = null;
        this.facade.messages.update((msgs) => {
          const next = msgs.filter(m => m.id !== msg.id);
          newLastMsg = next[next.length - 1] || null;
          return next;
        });

        if (wasLast) {
          const sessionId = this.facade.selectedSession()?.id;
          if (sessionId) {
            this.chatService.updateChatRoomPreview(sessionId, newLastMsg);
          }
        }
      },
      error: (err) => {
        // Some legacy messages were persisted with id like "temp_...", and some truly-local messages
        // might still exist. If backend says not found, remove locally as a fallback.
        if (err?.status === 404) {
          console.warn('⚠️ [ChatWindow] Delete API returned 404 - removing locally as fallback:', msg.id);
          const before = this.facade.messages();
          const wasLast = !!before.length && !!before[before.length - 1]?.id && before[before.length - 1]?.id === msg.id;

          let newLastMsg: ChatMessage | null = null;
          this.facade.messages.update((msgs) => {
            const next = msgs.filter(m => m.id !== msg.id);
            newLastMsg = next[next.length - 1] || null;
            return next;
          });

          if (wasLast) {
            const sessionId = this.facade.selectedSession()?.id;
            if (sessionId) {
              this.chatService.updateChatRoomPreview(sessionId, newLastMsg);
            }
          }
          return;
        }

        console.error('❌ [ChatWindow] Failed to delete message:', err);
        alert('Không thể xóa tin nhắn. Vui lòng thử lại.');
      }
    });
    
    this.closeContextMenu();
  }

  /**
   * Get the message content for reply preview
   */
  getReplyPreview(msg: ChatMessage): string {
    if (msg.type === MessageType.TEXT) {
      return msg.content.length > 50 ? msg.content.substring(0, 50) + '...' : msg.content;
    } else if (msg.type === MessageType.IMAGE) {
      return '📷 Image';
    } else if (msg.type === MessageType.VIDEO) {
      return '🎥 Video';
    } else if (msg.type === MessageType.AUDIO) {
      return '🎤 Voice message';
    } else if (msg.type === MessageType.FILE) {
      return `📎 ${msg.fileName || 'File'}`;
    }
    return msg.content;
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
            // sendMessage(content, replyToId?, type?, file?, fileName?)
            this.facade.sendMessage(url, undefined, type, undefined, fileName);
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

  // --- Custom audio player helpers ---
  onAudioLoadedMetadata(msg: ChatMessage, audioEl: HTMLAudioElement) {
    const key = this.getAudioKey(msg);
    if (!key) return;

    const dur = Number.isFinite(audioEl.duration) ? audioEl.duration : 0;
    if (!dur || dur <= 0) {
      // Fallback for servers that don't expose duration via media metadata (e.g., missing range support)
      this.tryResolveAudioDurationFromUrl(msg);
      return;
    }

    this.audioDurationByMessageKey.set(key, dur);
    this.cdr.markForCheck();
  }

  getAudioDurationLabel(msg: ChatMessage): string {
    const key = this.getAudioKey(msg);
    if (!key) return '--:--';
    const sec = this.audioDurationByMessageKey.get(key);
    if (!sec || !Number.isFinite(sec) || sec <= 0) return '--:--';
    return this.formatAudioTime(sec);
  }

  private getAudioKey(msg: ChatMessage): string | null {
    // Prefer stable backend ID, otherwise fall back to URL (good enough for UI duration cache)
    return (msg?.id || msg?.content || null) as string | null;
  }

  private isSameAudioMessage(msg: ChatMessage, key: string): boolean {
    return (!!msg?.id && msg.id === key) || (!!msg?.content && msg.content === key);
  }

  private tryResolveAudioDurationFromUrl(msg: ChatMessage) {
    const key = this.getAudioKey(msg);
    const url = msg?.content;
    if (!key || !url) return;
    if (this.audioDurationByMessageKey.has(key)) return;
    if (this.audioDurationResolveInFlight.has(key)) return;

    this.audioDurationResolveInFlight.add(key);

    // Compute duration by downloading + decoding audio (works even when <audio>.duration is NaN/0)
    // NOTE: Requires CORS to allow fetch() from your frontend origin.
    (async () => {
      try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`fetch failed: ${resp.status}`);
        const buf = await resp.arrayBuffer();

        // Lazily create AudioContext (reuse)
        const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!Ctx) throw new Error('AudioContext not supported');
        if (!this.audioCtx) this.audioCtx = new Ctx();

        // decodeAudioData callback API vs promise API differences across browsers
        const audioBuffer: AudioBuffer = await new Promise((resolve, reject) => {
          const ctx: AudioContext = this.audioCtx!;
          const copy = buf.slice(0);
          const maybePromise = (ctx as any).decodeAudioData(copy, resolve, reject);
          if (maybePromise && typeof maybePromise.then === 'function') {
            (maybePromise as Promise<AudioBuffer>).then(resolve).catch(reject);
          }
        });

        const sec = audioBuffer?.duration;
        if (sec && Number.isFinite(sec) && sec > 0) {
          this.audioDurationByMessageKey.set(key, sec);
          this.cdr.markForCheck();
        }
      } catch (e) {
        // Keep --:-- if we can't resolve. Most common causes: CORS blocked or unsupported codec.
        console.warn('⚠️ [ChatWindow] Could not resolve audio duration from URL:', e);
      } finally {
        this.audioDurationResolveInFlight.delete(key);
      }
    })();
  }

  private formatAudioTime(totalSeconds: number): string {
    const s = Math.max(0, Math.floor(totalSeconds));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  }

  toggleAudio(msg: ChatMessage, audioEl: HTMLAudioElement) {
    const key = this.getAudioKey(msg);
    if (!key) return;

    // Stop other playing audio first (1-at-a-time like Messenger)
    if (this.currentlyPlayingAudioKey && this.currentlyPlayingAudioKey !== key) {
      const prevKey = this.currentlyPlayingAudioKey;
      this.facade.messages.update((msgs) =>
        msgs.map((m) => (this.isSameAudioMessage(m, prevKey) ? { ...m, isPlaying: false } : m))
      );
    }

    const shouldPlay = !msg.isPlaying;
    this.currentlyPlayingAudioKey = shouldPlay ? key : null;

    this.facade.messages.update((msgs) =>
      msgs.map((m) => (this.isSameAudioMessage(m, key) ? { ...m, isPlaying: shouldPlay } : m))
    );

    // Audio element control
    try {
      if (shouldPlay) {
        const p = audioEl.play();
        if (p && typeof (p as any).catch === 'function') {
          (p as Promise<void>).catch((e) => {
            console.error('❌ [ChatWindow] Audio play() failed:', e);
            this.facade.messages.update((msgs) =>
              msgs.map((m) => (this.isSameAudioMessage(m, key) ? { ...m, isPlaying: false } : m))
            );
            this.currentlyPlayingAudioKey = null;
          });
        }
      } else {
        audioEl.pause();
      }
    } catch (e) {
      console.error('❌ [ChatWindow] Audio toggle failed:', e);
    }
  }

  onAudioEnded(msg: ChatMessage) {
    const key = this.getAudioKey(msg);
    if (!key) return;
    if (this.currentlyPlayingAudioKey === key) this.currentlyPlayingAudioKey = null;
    this.facade.messages.update((msgs) =>
      msgs.map((m) => (this.isSameAudioMessage(m, key) ? { ...m, isPlaying: false } : m))
    );
  }

  // =============================================
  // RIGHT SIDEBAR METHODS
  // =============================================

  toggleRightSidebar() {
    this.showRightSidebar = !this.showRightSidebar;
    if (this.showRightSidebar) {
      this.loadMuteStatus();
    }
  }

  closeRightSidebar() {
    this.showRightSidebar = false;
    this.isSearchMode = false;
    this.searchKeyword = '';
    this.searchResults = [];
    this.hasSearched = false;
    this.showGroupMembers = false;
    this.groupMembers = [];
  }

  // --- GROUP MEMBERS (for Group Chats) ---
  toggleGroupMembers() {
    this.showGroupMembers = !this.showGroupMembers;
    if (this.showGroupMembers && this.groupMembers.length === 0) {
      this.loadGroupMembers();
    }
  }


  loadGroupMembers() {
    const session = this.facade.selectedSession();
    if (!session || session.type !== 'GROUP') return;

    this.isLoadingMembers = true;

    // Get group details including member info
    this.http.get<any>(`${environment.apiUrl}/rooms/group/${session.id}/members`)
      .subscribe({
        next: (data) => {
          // Data should be an array of user objects with id, username, avatarUrl
          this.groupMembers = data || [];
          this.isLoadingMembers = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error loading group members:', err);
          // Fallback: Try to display members from session if available
          this.groupMembers = [];
          this.isLoadingMembers = false;
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Check if a member is the current user
   */
  isCurrentUser(memberId: string): boolean {
    return memberId === this.facade.currentUser()?.id;
  }

  /**
   * Get display name for member (fullName or username)
   */
  getMemberDisplayName(member: { id: string; username: string; fullName?: string; avatarUrl?: string }): string {
    return member.fullName || member.username;
  }

  /**
   * Get the partner ID for private chats (used for profile link)
   */
  getPartnerId(): string | null {
    const session = this.facade.selectedSession();
    if (!session || session.type !== 'PRIVATE') return null;
    return session.id; // In private chats, session.id is the partner's ID
  }

  // =============================================
  // ROLE MANAGEMENT HELPERS
  // =============================================

  /**
   * Get current room data (helper method)
   * Returns null if session is null, not a group, or room not found
   */
  private getCurrentRoom(): any | null {
    try {
      const session = this.facade.selectedSession();
      
      // Early return if no session
      if (!session) {
        return null;
      }

      // Only process GROUP sessions
      if (session.type !== 'GROUP') {
        return null;
      }

      // Safely access session.id with optional chaining
      const sessionId = session?.id;
      if (!sessionId) {
        return null;
      }

      // Try to get from rawRooms (accessing private member via type assertion)
      try {
        const rawRoomsSignal = (this.facade as any).rawRooms;
        if (!rawRoomsSignal) {
          return null;
        }

        const rooms = rawRoomsSignal() || [];
        if (!Array.isArray(rooms) || rooms.length === 0) {
          return null;
        }

        // Find room matching session ID
        return rooms.find((r: any) => {
          if (!r) return false;
          return r.chatId === sessionId || r.id === sessionId;
        }) || null;
      } catch (error) {
        console.warn('⚠️ [ChatWindow] Error accessing rawRooms:', error);
        return null;
      }
    } catch (error) {
      console.warn('⚠️ [ChatWindow] Error in getCurrentRoom:', error);
      return null;
    }
  }

  /**
   * Get current user's role in the selected group
   * Returns: 'OWNER', 'ADMIN', or 'MEMBER'
   */
  getMyRole(): string | null {
    const session = this.facade.selectedSession();
    if (!session || session.type !== 'GROUP') return null;

    const currentUserId = this.facade.currentUser()?.id;
    if (!currentUserId) return null;

    const room = this.getCurrentRoom();
    if (!room || !room.isGroup) return null;

    // Check if owner
    const ownerId = room.ownerId || room.adminId; // Fallback to adminId for backward compatibility
    if (ownerId === currentUserId) return 'OWNER';

    // Check if admin
    if (room.adminIds && room.adminIds.includes(currentUserId)) return 'ADMIN';

    // Default to member
    return 'MEMBER';
  }

  /**
   * Get a member's role in the group
   */
  getMemberRole(memberId: string): string {
    const session = this.facade.selectedSession();
    if (!session || session.type !== 'GROUP') return 'MEMBER';

    const room = this.getCurrentRoom();
    if (!room || !room.isGroup) return 'MEMBER';

    const ownerId = room.ownerId || room.adminId;
    if (ownerId === memberId) return 'OWNER';

    if (room.adminIds && room.adminIds.includes(memberId)) return 'ADMIN';

    return 'MEMBER';
  }

  /**
   * Check if current user can manage (kick) a target user
   * Returns true if myRole > targetUserRole
   */
  canManageUser(targetUserId: string): boolean {
    const myRole = this.getMyRole();
    if (!myRole) return false;

    const targetRole = this.getMemberRole(targetUserId);
    
    // Role hierarchy: OWNER > ADMIN > MEMBER
    const roleHierarchy: { [key: string]: number } = {
      'OWNER': 3,
      'ADMIN': 2,
      'MEMBER': 1
    };

    return (roleHierarchy[myRole] || 0) > (roleHierarchy[targetRole] || 0);
  }

  /**
   * Check if current user can promote/demote a target user
   * Returns true if I am OWNER
   */
  canPromote(targetUserId: string): boolean {
    return this.getMyRole() === 'OWNER';
  }

  /**
   * Check if target user is an admin
   */
  isAdmin(memberId: string): boolean {
    return this.getMemberRole(memberId) === 'ADMIN';
  }

  // =============================================
  // ROLE MANAGEMENT ACTIONS
  // =============================================

  /**
   * Promote a member to admin
   */
  promoteToAdmin(memberId: string) {
    const session = this.facade.selectedSession();
    if (!session || session.type !== 'GROUP') return;

    const roomId = session.id;
    this.chatService.updateRole(roomId, memberId, 'PROMOTE').subscribe({
      next: () => {
        console.log('✅ Promoted user to admin');
        this.loadGroupMembers(); // Reload members list
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('❌ Error promoting user:', err);
        alert(err.error?.error || 'Không thể thăng chức thành viên');
      }
    });
  }

  /**
   * Demote an admin to member
   */
  demoteFromAdmin(memberId: string) {
    const session = this.facade.selectedSession();
    if (!session || session.type !== 'GROUP') return;

    const roomId = session.id;
    this.chatService.updateRole(roomId, memberId, 'DEMOTE').subscribe({
      next: () => {
        console.log('✅ Demoted admin to member');
        this.loadGroupMembers(); // Reload members list
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('❌ Error demoting user:', err);
        alert(err.error?.error || 'Không thể bãi nhiệm thành viên');
      }
    });
  }

  /**
   * Kick a member from the group
   */
  kickMember(memberId: string) {
    const session = this.facade.selectedSession();
    if (!session || session.type !== 'GROUP') return;

    if (!confirm('Bạn có chắc chắn muốn mời thành viên này khỏi nhóm?')) {
      return;
    }

    const roomId = session.id;
    this.chatService.kickMember(roomId, memberId).subscribe({
      next: () => {
        console.log('✅ Kicked member from group');
        this.loadGroupMembers(); // Reload members list
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('❌ Error kicking member:', err);
        alert(err.error?.error || 'Không thể mời thành viên khỏi nhóm');
      }
    });
  }

  /**
   * Leave the group
   */
  leaveGroup() {
    const session = this.facade.selectedSession();
    if (!session || session.type !== 'GROUP') return;

    if (!confirm('Bạn có chắc chắn muốn rời nhóm này?')) {
      return;
    }

    const roomId = session.id;
    this.chatService.leaveGroup(roomId).subscribe({
      next: () => {
        console.log('✅ Left group');
        // Navigate back to sidebar or close chat
        this.facade.selectSession(null);
        this.closeRightSidebar();
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('❌ Error leaving group:', err);
        alert(err.error?.error || 'Không thể rời nhóm');
      }
    });
  }

  // =============================================
  // ADD MEMBER MODAL
  // =============================================

  /**
   * Add members to group (simplified - using prompt)
   */
  openAddMemberModal() {
    const session = this.facade.selectedSession();
    if (!session || session.type !== 'GROUP') return;

    // Simple prompt for now - user enters comma-separated user IDs
    const input = window.prompt('Nhập ID người dùng (phân cách bằng dấu phẩy):');
    if (!input || !input.trim()) return;

    const userIds = input.split(',').map(id => id.trim()).filter(id => id.length > 0);
    if (userIds.length === 0) {
      alert('Vui lòng nhập ít nhất một ID người dùng');
      return;
    }

    const roomId = session.id;
    this.chatService.addMembers(roomId, userIds).subscribe({
      next: () => {
        console.log('✅ Added members to group');
        this.loadGroupMembers(); // Reload members list
        this.facade.loadRooms(); // Reload rooms to update member count
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('❌ Error adding members:', err);
        alert(err.error?.error || 'Không thể thêm thành viên');
      }
    });
  }

  /**
   * Delete the group (only owner can do this)
   */
  deleteGroup() {
    const session = this.facade.selectedSession();
    if (!session || session.type !== 'GROUP') return;

    if (!confirm('Bạn có chắc chắn muốn giải tán nhóm này? Hành động này không thể hoàn tác!')) {
      return;
    }

    const roomId = session.id;
    this.chatService.deleteGroup(roomId).subscribe({
      next: () => {
        console.log('✅ Deleted group');
        // Navigate back to sidebar
        this.facade.selectSession(null);
        this.closeRightSidebar();
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('❌ Error deleting group:', err);
        alert(err.error?.error || 'Không thể giải tán nhóm');
      }
    });
  }

  // --- MEDIA & FILES SECTION ---
  toggleMediaSection() {
    this.isMediaSectionOpen = !this.isMediaSectionOpen;
    if (this.isMediaSectionOpen && this.mediaItems.length === 0 && this.fileItems.length === 0) {
      this.loadMediaAndFiles();
    }
  }

  switchMediaTab(tab: 'media' | 'files') {
    this.activeMediaTab = tab;
  }

  loadMediaAndFiles() {
    const session = this.facade.selectedSession();
    if (!session) return;

    this.isLoadingMedia = true;
    const chatId = session.id;

    // Load media (images/videos)
    this.http.get<ChatMessage[]>(`${environment.apiUrl}/messages/${chatId}/media?types=IMAGE,VIDEO`)
      .subscribe({
        next: (data) => {
          this.mediaItems = data;
          this.cdr.markForCheck();
        },
        error: (err) => console.error('Error loading media:', err)
      });

    // Load files
    this.http.get<ChatMessage[]>(`${environment.apiUrl}/messages/${chatId}/media?types=FILE`)
      .subscribe({
        next: (data) => {
          this.fileItems = data;
          this.isLoadingMedia = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error loading files:', err);
          this.isLoadingMedia = false;
          this.cdr.markForCheck();
        }
      });
  }

  openLightbox(item: ChatMessage) {
    this.lightboxItem = item;
  }

  closeLightbox() {
    this.lightboxItem = null;
  }

  // --- MUTE NOTIFICATIONS ---
  loadMuteStatus() {
    const session = this.facade.selectedSession();
    if (!session) return;

    const userId = this.facade.currentUser()?.id;
    if (!userId) return;

    this.http.get<{ muted: boolean }>(`${environment.apiUrl}/rooms/${session.id}/mute/${userId}`)
      .subscribe({
        next: (data) => {
          this.isMuted = data.muted;
          this.cdr.markForCheck();
        },
        error: () => {
          this.isMuted = false;
        }
      });
  }

  toggleMute() {
    const session = this.facade.selectedSession();
    if (!session) return;

    const userId = this.facade.currentUser()?.id;
    if (!userId) return;

    this.http.put<{ muted: boolean }>(`${environment.apiUrl}/rooms/${session.id}/mute`, { userId })
      .subscribe({
        next: (data) => {
          this.isMuted = data.muted;
          this.cdr.markForCheck();
          console.log(this.isMuted ? '🔕 Notifications muted' : '🔔 Notifications enabled');
        },
        error: (err) => console.error('Error toggling mute:', err)
      });
  }

  // --- SEARCH IN CHAT ---
  openSearchInChat() {
    this.isSearchMode = true;
    this.searchKeyword = '';
    this.searchResults = [];
    this.hasSearched = false;
    
    // Focus search input after render
    setTimeout(() => {
      const input = document.querySelector('.search-input') as HTMLInputElement;
      input?.focus();
    }, 100);
  }

  closeSearchInChat() {
    this.isSearchMode = false;
    this.searchKeyword = '';
    this.searchResults = [];
    this.hasSearched = false;
  }

  performSearch() {
    if (!this.searchKeyword.trim()) return;

    const session = this.facade.selectedSession();
    if (!session) return;

    this.isSearching = true;
    this.hasSearched = true;

    this.http.get<ChatMessage[]>(`${environment.apiUrl}/messages/${session.id}/search?keyword=${encodeURIComponent(this.searchKeyword)}`)
      .subscribe({
        next: (results) => {
          this.searchResults = results;
          this.isSearching = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Search error:', err);
          this.searchResults = [];
          this.isSearching = false;
          this.cdr.markForCheck();
        }
      });
  }

  scrollToMessage(targetMsg: ChatMessage) {
    // Close sidebar on mobile
    if (window.innerWidth < 1024) {
      this.closeRightSidebar();
    }

    // Find message in current loaded messages
    const messages = this.facade.messages();
    const existingMsg = messages.find(m => m.id === targetMsg.id);

    if (existingMsg) {
      // Message is loaded, scroll to it
      this.scrollToMessageElement(targetMsg.id!);
    } else {
      // Message not in current view - need to load more history
      // For now, just show a notification
      console.log('Message not in current view, loading more history...');
      // TODO: Implement pagination to load the message's context
      this.scrollToMessageElement(targetMsg.id!);
    }
  }

  private scrollToMessageElement(messageId: string) {
    setTimeout(() => {
      const messageElements = document.querySelectorAll('.message-wrapper');
      let targetElement: HTMLElement | null = null;

      messageElements.forEach((el) => {
        const msg = this.facade.messages().find(m => {
          const wrapper = el as HTMLElement;
          return wrapper.contains(document.querySelector(`[data-message-id="${m.id}"]`));
        });
      });

      // Fallback: Find by iterating through messages
      const messages = this.facade.messages();
      const index = messages.findIndex(m => m.id === messageId);
      
      if (index !== -1 && messageElements[index]) {
        targetElement = messageElements[index] as HTMLElement;
      }

      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Highlight the message
        targetElement.classList.add('highlight-flash');
        setTimeout(() => {
          targetElement?.classList.remove('highlight-flash');
        }, 2000);
      }
    }, 300);
  }
}