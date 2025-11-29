import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, LoginRequest, RegisterRequest } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login {
  // Trạng thái giao diện (Signals)
  isLoginMode = signal(true);
  isLoading = signal(false);
  showPassword = signal(false);
  errorMessage = signal<string>('');

  // Dữ liệu Form
  formData = {
    username: '',
    password: '',
    confirmPassword: '',
    displayName: '', // Tên hiển thị
    email: ''
  };

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  // Chuyển đổi tab Login/Register
  toggleMode() {
    this.isLoginMode.update(prev => !prev);
    this.errorMessage.set(''); // Xóa lỗi cũ
    this.resetForm();
  }

  togglePassword() {
    this.showPassword.update(prev => !prev);
  }

  onSubmit() {
    this.errorMessage.set('');
    
    if (this.isLoginMode()) {
      this.handleLogin();
    } else {
      this.handleRegister();
    }
  }

  private handleLogin() {
    if (!this.formData.username || !this.formData.password) {
      this.errorMessage.set('Vui lòng nhập tài khoản và mật khẩu.');
      return;
    }

    this.isLoading.set(true);
    
    const request: LoginRequest = {
      username: this.formData.username,
      password: this.formData.password
    };

    this.authService.login(request).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        // alert(`Xin chào ${res.displayName}!`);
        // Chuyển hướng sang trang chat sau này
        // this.router.navigate(['/chat']);
      },
      error: (err) => {
        this.isLoading.set(false);
        console.error(err);
        this.errorMessage.set('Sai tài khoản hoặc mật khẩu.');
      }
    });
  }

  private handleRegister() {
    // Validate
    if (this.formData.password !== this.formData.confirmPassword) {
      this.errorMessage.set('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (!this.formData.displayName || !this.formData.username) {
      this.errorMessage.set('Vui lòng điền đầy đủ thông tin.');
      return;
    }

    this.isLoading.set(true);

    const request: RegisterRequest = {
      username: this.formData.username,
      password: this.formData.password,
      displayName: this.formData.displayName,
      email: this.formData.email
    };

    this.authService.register(request).subscribe({
      next: () => {
        this.isLoading.set(false);
        alert('Đăng ký thành công! Vui lòng đăng nhập.');
        this.toggleMode(); // Chuyển về login
      },
      error: (err) => {
        this.isLoading.set(false);
        const msg = err.error?.message || 'Đăng ký thất bại. Tên đăng nhập có thể đã tồn tại.';
        this.errorMessage.set(msg);
      }
    });
  }

  private resetForm() {
    this.formData = {
      username: '',
      password: '',
      confirmPassword: '',
      displayName: '',
      email: ''
    };
  }
}