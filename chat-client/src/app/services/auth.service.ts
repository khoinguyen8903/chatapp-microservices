import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

// --- ĐỊNH NGHĨA MODELS (DTO) ---
export interface AuthResponse {
  token: string;
  userId: string;
  displayName: string;
  username: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  displayName: string;
  email: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // Lưu ý: Đảm bảo environment.apiUrl là 'http://192.168.1.9:8080' (hoặc cổng gateway của bạn)
  private apiUrl = `${environment.apiUrl}/api/auth`;

  constructor(private http: HttpClient) { }

  // 1. Đăng Nhập
  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, request).pipe(
      tap({
        next: (response) => {
          alert('Login OK!'); // Nếu thành công thì báo OK
          if (response && response.token) {
            this.saveSession(response);
          }
        },
        error: (err) => {
          // [QUAN TRỌNG] In chi tiết lỗi ra màn hình điện thoại
          alert(`LỖI: ${err.status} - ${err.statusText}`);
          alert(`URL gọi: ${err.url}`);
          alert(`Message: ${err.message}`);
        }
      })
    );
  }

  // 2. Đăng Ký
  register(request: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, request);
  }

  // 3. Quản lý Session
  private saveSession(data: AuthResponse) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify({
      id: data.userId,
      username: data.username,
      name: data.displayName
    }));
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  logout() {
    localStorage.clear();
  }

  // 4. Kiểm tra user tồn tại (Dùng khi tìm kiếm username để tạo chat)
  checkUserExists(username: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/check/${username}`);
  }

  // 5. --- MỚI THÊM: Lấy thông tin user theo ID ---
  // Hàm này được ChatComponent gọi để hiển thị tên đẹp thay vì UUID trong danh sách chat
  getUserById(userId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/users/${userId}`);
  }
}