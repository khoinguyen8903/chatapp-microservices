import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

// --- ĐỊNH NGHĨA MODELS (DTO) ---
export interface AuthResponse {
  token: string;
  userId: string;
  fullName: string;
  username?: string;
  email?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  fullName: string;
  email: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${environment.apiUrl}/api/auth`;

  constructor(private http: HttpClient) { }

  // 1. Đăng Nhập
  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, request).pipe(
      tap({
        next: (response) => {
          // alert('Login OK!'); // Có thể comment lại cho đỡ phiền khi chạy thật
          if (response && response.token) {
            this.saveSession(response);
          }
        },
        error: (err) => {
          console.error('Login Failed', err);
          // alert(`LỖI: ${err.status} - ${err.message}`);
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
    
    // Lưu thông tin User vào localStorage để dùng lại sau này
    localStorage.setItem('user', JSON.stringify({
      id: data.userId,       // [QUAN TRỌNG] Đây là ID thật
      username: data.username,
      name: data.fullName
    }));
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  // --- [MỚI] Hàm lấy User ID thật từ bộ nhớ ---
  getUserId(): string | null {
    const userJson = localStorage.getItem('user');
    if (userJson) {
      try {
        const user = JSON.parse(userJson);
        return user.id; // Trả về ID thật (Ví dụ: "93ebd290-...")
      } catch (e) {
        console.error('Lỗi khi đọc thông tin User từ LocalStorage', e);
        return null;
      }
    }
    return null;
  }

  // --- [MỚI] Hàm lấy toàn bộ thông tin User (Tên, Username...) ---
  getCurrentUser(): any {
    const userJson = localStorage.getItem('user');
    return userJson ? JSON.parse(userJson) : null;
  }

  logout() {
    localStorage.clear();
    // Nên reload lại trang hoặc chuyển về trang login để xóa sạch state
    window.location.href = '/login'; 
  }

  // 4. Kiểm tra user tồn tại
  checkUserExists(username: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/check/${username}`);
  }

  // 5. Lấy thông tin user theo ID
  getUserById(userId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/users/${userId}`);
  }
}