import { Component, ElementRef, ViewChild, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatFacade } from '../../chat.facade';

@Component({
  selector: 'app-call-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './call-modal.component.html',
  styleUrls: ['./call-modal.component.scss']
})
export class CallModalComponent {
  facade = inject(ChatFacade);

  @ViewChild('localVideo') localVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo') remoteVideo!: ElementRef<HTMLVideoElement>;

  isMicMuted = false;
  isCameraOff = false;

  constructor() {
    // 1. Tự động gán Stream của mình vào thẻ Video nhỏ
    effect(() => {
      // Đăng ký các signal phụ thuộc để effect chạy lại khi chúng thay đổi
      const state = this.facade.callState();
      const isVideo = this.facade.isVideoCall(); 
      const stream = this.facade.localStream();

      // Dùng setTimeout để đợi Angular render xong thẻ <video> trong DOM
      setTimeout(() => {
        if (state === 'CONNECTED' && this.localVideo?.nativeElement && stream) {
          this.localVideo.nativeElement.srcObject = stream;
          this.localVideo.nativeElement.muted = true; // Luôn mute video của chính mình
        }
      });
    });

    // 2. Tự động gán Stream đối phương vào thẻ Video lớn
    effect(() => {
      const state = this.facade.callState();
      const stream = this.facade.remoteStream();
      
      setTimeout(() => {
        if (state === 'CONNECTED' && this.remoteVideo?.nativeElement && stream) {
          this.remoteVideo.nativeElement.srcObject = stream;
        }
      });
    });
  }

  // --- ACTIONS ---

  answer() {
    this.facade.answerCall();
  }

  hangup() {
    this.facade.endCall();
    this.resetControls();
  }

  // Tắt/Bật Mic
  toggleMic() {
    const stream = this.facade.localStream();
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        this.isMicMuted = !audioTrack.enabled;
      }
    }
  }

  // Tắt/Bật Camera
  toggleCamera() {
    // Nếu là Voice Call thì không cho bật cam
    if (!this.facade.isVideoCall()) return;

    const stream = this.facade.localStream();
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        this.isCameraOff = !videoTrack.enabled;
      }
    }
  }

  private resetControls() {
    this.isMicMuted = false;
    this.isCameraOff = false;
  }
}