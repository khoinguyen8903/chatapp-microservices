import { Injectable, signal } from '@angular/core';
import { ChatService } from './chat.service';
import { BehaviorSubject, Subject } from 'rxjs';

// Cấu hình STUN Server (Của Google - Miễn phí)
// Giúp 2 máy tìm thấy IP của nhau qua Internet
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

@Injectable({ providedIn: 'root' })
export class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  
  // Biến lưu thông tin cuộc gọi
  private currentPartnerId: string | null = null;
  private isGroupCall = false;

  // --- SIGNALS CHO UI ---
  // Stream của mình (để hiện lên màn hình nhỏ)
  localStream$ = new BehaviorSubject<MediaStream | null>(null);
  // Stream của đối phương (để hiện lên màn hình lớn)
  remoteStream$ = new BehaviorSubject<MediaStream | null>(null);
  // [MỚI] Trạng thái loại cuộc gọi (Video hay Audio)
  isVideoCall$ = new BehaviorSubject<boolean>(true);
  
  // Trạng thái cuộc gọi: 'IDLE' | 'INCOMING' | 'OUTGOING' | 'CONNECTED'
  callState = signal<string>('IDLE'); 

  constructor(private chatService: ChatService) {
    // Lắng nghe tín hiệu từ Backend trả về
    this.chatService.onCallMessage().subscribe(async (msg: any) => {
       await this.handleServerSignal(msg);
    });
  }

  // ==========================================
  // 1. KHỞI TẠO CUỘC GỌI (Người gọi)
  // ==========================================
  async startCall(partnerId: string, isGroup: boolean = false, videoEnabled: boolean = true) {
    this.currentPartnerId = partnerId;
    this.isGroupCall = isGroup;
    this.isVideoCall$.next(videoEnabled); // Cập nhật trạng thái
    this.callState.set('OUTGOING');

    await this.initLocalStream(videoEnabled);
    this.createPeerConnection();

    // Tạo Offer (Lời mời kết nối)
    const offer = await this.peerConnection!.createOffer();
    await this.peerConnection!.setLocalDescription(offer);

    // Gửi Offer sang cho đối phương
    this.sendSignal('OFFER', offer);
  }

  // ==========================================
  // 2. XỬ LÝ TÍN HIỆU TỪ SERVER (Switch Case)
  // ==========================================
  private async handleServerSignal(msg: any) {
    // Nếu là tin nhắn của chính mình gửi đi (trong Group) thì bỏ qua
    // (Logic này tùy thuộc vào việc Backend có gửi lại cho người gửi không)
    
    switch (msg.type) {
      case 'OFFER':
        // Có người gọi đến -> Hiện Popup
        await this.handleOffer(msg);
        break;

      case 'ANSWER':
        // Người kia đã đồng ý -> Set Remote Description
        await this.handleAnswer(msg);
        break;

      case 'ICE_CANDIDATE':
        // Nhận thông tin mạng của đối phương
        if (this.peerConnection) {
           await this.peerConnection.addIceCandidate(new RTCIceCandidate(msg.data));
        }
        break;
        
      case 'HANGUP':
        this.endCall(false); // False để không gửi lại tin HANGUP
        break;
    }
  }

  // ==========================================
  // 3. XỬ LÝ KHI CÓ NGƯỜI GỌI ĐẾN (OFFER)
  // ==========================================
  private async handleOffer(msg: any) {
    if (this.callState() !== 'IDLE') {
       // Đang bận gọi người khác -> Gửi tin BUSY (Làm sau)
       return;
    }

    this.currentPartnerId = msg.senderId;
    this.isGroupCall = msg.isGroup;
    this.callState.set('INCOMING');
    
    // [MỚI] Cập nhật loại cuộc gọi dựa trên tín hiệu nhận được
    this.isVideoCall$.next(msg.videoEnabled !== false); 
    
    // Lưu tạm Offer để khi bấm "Nghe" sẽ xử lý
    // Ở đây xử lý luôn cho đơn giản, thực tế sẽ chờ UI bấm nút
    // Nhưng WebRTC cần PeerConnection để setRemoteDescription
    this.createPeerConnection();
    await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(msg.data));
  }

  // Hành động: Chấp nhận cuộc gọi
  async acceptCall() {
    await this.initLocalStream(this.isVideoCall$.value); // Bật Camera/Mic tùy theo loại cuộc gọi

    // Tạo Answer
    const answer = await this.peerConnection!.createAnswer();
    await this.peerConnection!.setLocalDescription(answer);

    this.sendSignal('ANSWER', answer);
    this.callState.set('CONNECTED');
  }

  // Hành động: Từ chối cuộc gọi
  rejectCall() {
    this.sendSignal('HANGUP', {}); // Hoặc REJECT
    this.endCall();
  }

  // ==========================================
  // 4. XỬ LÝ KHI ĐỐI PHƯƠNG TRẢ LỜI (ANSWER)
  // ==========================================
  private async handleAnswer(msg: any) {
    if (this.peerConnection) {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(msg.data));
      this.callState.set('CONNECTED');
    }
  }

  // ==========================================
  // 5. CÁC HÀM CỐT LÕI WEBRTC
  // ==========================================
  
  // Bật Camera/Mic
  private async initLocalStream(videoEnabled: boolean) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: videoEnabled, audio: true });
      this.localStream = stream;
      this.localStream$.next(stream);

      // Add Track vào Peer (nếu Peer đã tạo)
      if (this.peerConnection) {
         stream.getTracks().forEach(track => {
             this.peerConnection!.addTrack(track, stream);
         });
      }
    } catch (err) {
      console.error('Không thể truy cập Camera/Mic:', err);
      alert('Vui lòng cấp quyền Camera/Mic để gọi điện.');
    }
  }

  // Khởi tạo Peer Connection
  private createPeerConnection() {
    this.peerConnection = new RTCPeerConnection(RTC_CONFIG);

    // 1. Khi tìm thấy đường mạng (ICE Candidate) -> Gửi cho đối phương
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal('ICE_CANDIDATE', event.candidate);
      }
    };

    // 2. Khi nhận được Stream của đối phương -> Hiển thị lên UI
    this.peerConnection.ontrack = (event) => {
       console.log('Nhận được Remote Stream!');
       this.remoteStream$.next(event.streams[0]);
    };

    // 3. Add Local Stream vào Peer (nếu đã có stream)
    if (this.localStream) {
       this.localStream.getTracks().forEach(track => {
           this.peerConnection!.addTrack(track, this.localStream!);
       });
    }
  }

  // ==========================================
  // 6. KẾT THÚC VÀ TIỆN ÍCH
  // ==========================================
  
  endCall(emitSignal: boolean = true) {
    if (emitSignal && this.currentPartnerId) {
        this.sendSignal('HANGUP', {});
    }

    // Dọn dẹp
    if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop()); // Tắt đèn Camera
    }
    if (this.peerConnection) {
        this.peerConnection.close();
    }

    this.peerConnection = null;
    this.localStream = null;
    this.localStream$.next(null);
    this.remoteStream$.next(null);
    this.currentPartnerId = null;
    this.callState.set('IDLE');
  }

  // Helper gửi tin qua ChatService
  private sendSignal(type: string, data: any) {
    // Lấy thông tin user hiện tại từ localStorage hoặc ChatFacade
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    
    const payload = {
        senderId: currentUser.id,
        recipientId: this.currentPartnerId,
        type: type,
        data: data,
        isGroup: this.isGroupCall,
        videoEnabled: this.isVideoCall$.value // [MỚI] Gửi kèm trạng thái video
    };

    this.chatService.sendCallSignal(payload);
  }
}