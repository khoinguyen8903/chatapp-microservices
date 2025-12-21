import { Injectable, signal } from '@angular/core';
import { ChatService } from './chat.service';
import { BehaviorSubject } from 'rxjs';

// [CẤU HÌNH] Tối ưu cho kết nối xuyên mạng (Wifi <-> 4G)
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.relay.metered.ca:80" },
    {
      urls: [
        "turn:global.relay.metered.ca:80",
        "turn:global.relay.metered.ca:80?transport=tcp",
        "turn:global.relay.metered.ca:443",
        "turn:global.relay.metered.ca:443?transport=tcp"
      ],
      username: "fbb141abe21fa73c6264a7c0",
      credential: "FbnINukmrNTZ5qok",
    }
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  iceTransportPolicy: 'all'
};

@Injectable({ providedIn: 'root' })
export class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private iceCandidatesQueue: any[] = []; // Hàng đợi lưu ICE Candidates
  
  private currentPartnerId: string | null = null;
  private isGroupCall = false;

  localStream$ = new BehaviorSubject<MediaStream | null>(null);
  remoteStream$ = new BehaviorSubject<MediaStream | null>(null);
  isVideoCall$ = new BehaviorSubject<boolean>(true);
  callState = signal<string>('IDLE'); 

  constructor(private chatService: ChatService) {
    this.chatService.onCallMessage().subscribe(async (msg: any) => {
      await this.handleServerSignal(msg);
    });
  }

  // ==========================================
  // 1. CORE: KHỞI TẠO PEER CONNECTION
  // ==========================================
  private createPeerConnection() {
    if (this.peerConnection && this.peerConnection.connectionState !== 'closed') {
      return;
    }

    console.log('🌐 Khởi tạo PeerConnection với TURN/TCP...');
    this.peerConnection = new RTCPeerConnection(RTC_CONFIG);
    this.iceCandidatesQueue = []; // Reset hàng đợi khi tạo kết nối mới

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal('ICE_CANDIDATE', event.candidate);
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection?.iceConnectionState;
      console.log('📡 Trạng thái ICE:', state);
      if (state === 'failed' && this.peerConnection?.restartIce) {
        this.peerConnection.restartIce();
      }
    };

    this.peerConnection.ontrack = (event) => {
      console.log('✅ Đã nhận được Remote Stream!');
      this.remoteStream$.next(event.streams[0]);
    };

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });
    }
  }

  // ==========================================
  // 2. XỬ LÝ TÍN HIỆU (SIGNALING)
  // ==========================================
  private async handleServerSignal(msg: any) {
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    if (msg.senderId === currentUser.id) return;
    
    switch (msg.type) {
      case 'OFFER':
        await this.handleOffer(msg);
        break;

      case 'ANSWER':
        if (this.peerConnection) {
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(msg.data));
          await this.processQueuedCandidates(); // Xử lý hàng đợi sau khi set remote desc
          this.callState.set('CONNECTED');
        }
        break;

      case 'ICE_CANDIDATE':
        if (this.peerConnection && this.peerConnection.remoteDescription) {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(msg.data));
        } else {
          this.iceCandidatesQueue.push(msg.data); // Đưa vào hàng đợi
        }
        break;
        
      case 'HANGUP':
        this.endCall(false); 
        break;
    }
  }

  private async processQueuedCandidates() {
    while (this.iceCandidatesQueue.length > 0) {
      const candidate = this.iceCandidatesQueue.shift();
      try {
        await this.peerConnection?.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error('Lỗi add candidate từ hàng đợi:', e);
      }
    }
  }

  // ==========================================
  // 3. LOGIC CUỘC GỌI
  // ==========================================
  async startCall(partnerId: string, isGroup: boolean = false, videoEnabled: boolean = true) {
    if (this.callState() !== 'IDLE') return;
    this.currentPartnerId = partnerId;
    this.isGroupCall = isGroup;
    this.isVideoCall$.next(videoEnabled);
    this.callState.set('OUTGOING');

    await this.initLocalStream(videoEnabled);
    this.createPeerConnection();

    try {
      const offer = await this.peerConnection!.createOffer();
      await this.peerConnection!.setLocalDescription(offer);
      this.sendSignal('OFFER', offer);
    } catch (err) {
      this.endCall();
    }
  }

  private async handleOffer(msg: any) {
    if (this.callState() !== 'IDLE') return;
    this.currentPartnerId = msg.senderId;
    this.isGroupCall = msg.isGroup;
    this.isVideoCall$.next(msg.videoEnabled !== false);
    this.callState.set('INCOMING');
    
    this.createPeerConnection();
    await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(msg.data));
    await this.processQueuedCandidates(); // Xử lý các candidate đến sớm
  }

  async acceptCall() {
    await this.initLocalStream(this.isVideoCall$.value);
    try {
      const answer = await this.peerConnection!.createAnswer();
      await this.peerConnection!.setLocalDescription(answer);
      this.sendSignal('ANSWER', answer);
      this.callState.set('CONNECTED');
    } catch (err) {
      console.error('Lỗi chấp nhận cuộc gọi:', err);
    }
  }

  // ==========================================
  // 4. HELPER & CLEANUP
  // ==========================================
  private async initLocalStream(videoEnabled: boolean) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: videoEnabled, 
        audio: true 
      });
      this.localStream = stream;
      this.localStream$.next(stream);

      if (this.peerConnection) {
        const senders = this.peerConnection.getSenders();
        stream.getTracks().forEach(track => {
          const sender = senders.find(s => s.track?.kind === track.kind);
          if (sender) sender.replaceTrack(track);
          else this.peerConnection!.addTrack(track, stream);
        });
      }
    } catch (err) {
      alert('Không thể truy cập Camera/Mic. Vui lòng kiểm tra quyền HTTPS.');
      this.endCall();
    }
  }

  endCall(emitSignal: boolean = true) {
    if (emitSignal && this.currentPartnerId) {
      this.sendSignal('HANGUP', {});
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.localStream = null;
    this.localStream$.next(null);
    this.remoteStream$.next(null);
    this.iceCandidatesQueue = [];
    this.callState.set('IDLE');
  }

  private sendSignal(type: string, data: any) {
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    this.chatService.sendCallSignal({
      senderId: currentUser.id,
      recipientId: this.currentPartnerId,
      type: type,
      data: data,
      isGroup: this.isGroupCall,
      videoEnabled: this.isVideoCall$.value
    });
  }
}