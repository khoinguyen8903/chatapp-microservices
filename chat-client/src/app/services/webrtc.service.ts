import { Injectable, signal } from '@angular/core';
import { ChatService } from './chat.service';
import { BehaviorSubject } from 'rxjs';

// [CẤU HÌNH] FINAL: Dùng TÊN MIỀN (Kết hợp với File HOSTS bạn đã sửa)
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    {
      urls: "stun:stun.relay.metered.ca:80",
    },
    {
      urls: "turn:global.relay.metered.ca:80",
      username: "fbb141abe21fa73c6264a7c0",
      credential: "FbnINukmrNTZ5qok",
    },
    {
      urls: "turn:global.relay.metered.ca:80?transport=tcp",
      username: "fbb141abe21fa73c6264a7c0",
      credential: "FbnINukmrNTZ5qok",
    },
    {
      urls: "turn:global.relay.metered.ca:443",
      username: "fbb141abe21fa73c6264a7c0",
      credential: "FbnINukmrNTZ5qok",
    },
    {
      urls: "turn:global.relay.metered.ca:443?transport=tcp",
      username: "fbb141abe21fa73c6264a7c0",
      credential: "FbnINukmrNTZ5qok",
    },
],
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  iceTransportPolicy: 'all'
};

@Injectable({ providedIn: 'root' })
export class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  
  // Biến lưu thông tin cuộc gọi
  private currentPartnerId: string | null = null;
  private isGroupCall = false;

  // --- SIGNALS CHO UI ---
  localStream$ = new BehaviorSubject<MediaStream | null>(null);
  remoteStream$ = new BehaviorSubject<MediaStream | null>(null);
  isVideoCall$ = new BehaviorSubject<boolean>(true);
  
  // Trạng thái: 'IDLE', 'INCOMING', 'OUTGOING', 'CONNECTED'
  callState = signal<string>('IDLE'); 

  constructor(private chatService: ChatService) {
    // Lắng nghe tín hiệu từ Backend
    this.chatService.onCallMessage().subscribe(async (msg: any) => {
        await this.handleServerSignal(msg);
    });
  }

  // ==========================================
  // 1. CORE: KHỞI TẠO KẾT NỐI
  // ==========================================
  private createPeerConnection() {
    if (this.peerConnection && this.peerConnection.connectionState !== 'closed') {
        console.warn('⚠️ PeerConnection đang hoạt động. Bỏ qua việc tạo mới!');
        return;
    }

    console.log('🌐 Khởi tạo PeerConnection (OpenRelay Domain + HOSTS Fix)...');
    this.peerConnection = new RTCPeerConnection(RTC_CONFIG);

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal('ICE_CANDIDATE', event.candidate);
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
        const state = this.peerConnection?.iceConnectionState;
        console.log('📡 Trạng thái ICE:', state);
        
        if (state === 'disconnected' || state === 'failed') {
             if (this.peerConnection?.restartIce) {
                 console.warn('🔄 Mạng yếu, đang thử kết nối lại (Restart ICE)...');
                 this.peerConnection.restartIce();
             }
        }
    };

    this.peerConnection.ontrack = (event) => {
       console.log('✅ Đã nhận được Remote Stream (Video/Audio)!');
       this.remoteStream$.next(event.streams[0]);
    };

    if (this.localStream) {
       this.localStream.getTracks().forEach(track => {
           this.peerConnection!.addTrack(track, this.localStream!);
       });
    }
  }

  // ==========================================
  // 2. NGƯỜI GỌI (CALLER)
  // ==========================================
  async startCall(partnerId: string, isGroup: boolean = false, videoEnabled: boolean = true) {
    if (this.callState() !== 'IDLE') return;

    this.currentPartnerId = partnerId;
    this.isGroupCall = isGroup;
    this.isVideoCall$.next(videoEnabled);
    this.callState.set('OUTGOING');

    // B1: Bật Camera
    await this.initLocalStream(videoEnabled);
    
    // B2: Tạo Peer
    this.createPeerConnection();

    // B3: Tạo Offer và gửi đi
    try {
        const offer = await this.peerConnection!.createOffer();
        await this.peerConnection!.setLocalDescription(offer);
        this.sendSignal('OFFER', offer);
    } catch (err) {
        console.error('Lỗi tạo Offer:', err);
        this.endCall();
    }
  }

  // ==========================================
  // 3. NGƯỜI NHẬN (CALLEE)
  // ==========================================
  async acceptCall() {
    await this.initLocalStream(this.isVideoCall$.value);

    try {
        const answer = await this.peerConnection!.createAnswer();
        await this.peerConnection!.setLocalDescription(answer);
        
        this.sendSignal('ANSWER', answer);
        this.callState.set('CONNECTED');
    } catch (err) {
        console.error('Lỗi tạo Answer:', err);
    }
  }

  rejectCall() {
    this.sendSignal('HANGUP', {}); 
    this.endCall();
  }

  // ==========================================
  // 4. XỬ TÍN HIỆU SERVER
  // ==========================================
  private async handleServerSignal(msg: any) {
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    if (msg.senderId === currentUser.id) return;
    
    switch (msg.type) {
      case 'OFFER':
        await this.handleOffer(msg);
        break;

      case 'ANSWER':
        console.log('📩 Nhận được ANSWER');
        if (this.peerConnection) {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(msg.data));
            this.callState.set('CONNECTED');
        }
        break;

      case 'ICE_CANDIDATE':
        if (this.peerConnection && this.peerConnection.remoteDescription) {
           await this.peerConnection.addIceCandidate(new RTCIceCandidate(msg.data));
        }
        break;
        
      case 'HANGUP':
        console.warn('⚠️ NHẬN ĐƯỢC TÍN HIỆU HANGUP TỪ SOCKET!'); 
        this.endCall(false); 
        break;
    }
  }

  private async handleOffer(msg: any) {
    if (this.callState() !== 'IDLE') return;

    console.log('📩 Có cuộc gọi đến (OFFER)');
    this.currentPartnerId = msg.senderId;
    this.isGroupCall = msg.isGroup;
    this.callState.set('INCOMING');
    this.isVideoCall$.next(msg.videoEnabled !== false); 
    
    this.createPeerConnection();
    await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(msg.data));
  }

  // ==========================================
  // 5. HELPER: CAMERA & DỌN DẸP
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
          this.peerConnection.getSenders().forEach(sender => this.peerConnection?.removeTrack(sender));
          stream.getTracks().forEach(track => {
              this.peerConnection!.addTrack(track, stream);
          });
      }
    } catch (err) {
      console.error('❌ LỖI KHÔNG THỂ TRUY CẬP CAMERA/MIC:', err);
      alert('Không thể truy cập Camera/Mic. Vui lòng kiểm tra quyền truy cập.');
      this.endCall();
    }
  }

  endCall(emitSignal: boolean = true) {
    console.log('🛑 Đang thực hiện kết thúc cuộc gọi...');

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
    this.currentPartnerId = null;
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