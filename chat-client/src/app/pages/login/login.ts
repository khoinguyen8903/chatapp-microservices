import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrls: ['./login.scss']
})
export class Login implements OnInit { // [MỚI] Implement OnInit
  isLoginMode = signal(true);
  isLoading = signal(false);
  showPassword = signal(false);
  
  authForm: FormGroup;
  globalError = signal<string>('');

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.authForm = this.fb.group({
      username: ['', [
        Validators.required, 
        Validators.minLength(3), 
        Validators.maxLength(20),
        Validators.pattern('^[a-zA-Z0-9]*$')
      ]],
      password: ['', [
        Validators.required, 
        Validators.minLength(6)
      ]],
      confirmPassword: [''],
      fullName: ['', [Validators.maxLength(50)]],
      email: ['', [Validators.email]]
    });
  }

  // [MỚI] Kiểm tra nếu đã đăng nhập thì đá sang Chat luôn
  ngOnInit() {
    if (this.authService.getToken()) {
      this.router.navigate(['/chat']);
    }
  }

  get f() { return this.authForm.controls; }

  toggleMode() {
    this.isLoginMode.update(prev => !prev);
    this.globalError.set('');
    this.authForm.reset();
  }

  togglePassword() {
    this.showPassword.update(prev => !prev);
  }

  onSubmit() {
    this.globalError.set('');

    if (this.authForm.invalid) {
      this.authForm.markAllAsTouched(); 
      return;
    }

    const val = this.authForm.value;

    // --- LOGIC LOGIN ---
    if (this.isLoginMode()) {
      this.isLoading.set(true);
      // Gọi AuthService.login -> Service này sẽ tự lưu Token và User Info vào LocalStorage
      this.authService.login({ username: val.username, password: val.password }).subscribe({
        next: (res) => {
          this.isLoading.set(false);
          // Sau khi login thành công, chuyển hướng sang trang Chat
          // Lúc này ChatComponent sẽ lấy được User ID thật từ LocalStorage
          this.router.navigate(['/chat']); 
        },
        error: (err) => {
          this.isLoading.set(false);
          if (err.status === 401 || err.status === 400) {
             this.globalError.set('Sai tài khoản hoặc mật khẩu.');
          } else {
             this.globalError.set('Lỗi kết nối đến máy chủ.');
          }
        }
      });
    } 
    // --- LOGIC REGISTER ---
    else {
      if (val.password !== val.confirmPassword) {
        this.authForm.get('confirmPassword')?.setErrors({ mismatch: true });
        return;
      }

      this.isLoading.set(true);
      this.authService.register({
        username: val.username,
        password: val.password,
        fullName: val.fullName || val.username,
        email: val.email
      }).subscribe({
        next: () => {
          this.isLoading.set(false);
          alert('Đăng ký thành công! Vui lòng đăng nhập.');
          this.toggleMode();
        },
        error: (err) => {
          this.isLoading.set(false);
          
          if (err.status === 400 && err.error) {
            const serverErrors = err.error;
            
            // Xử lý lỗi chung
            if (serverErrors.error) {
                if (serverErrors.error === 'Username already exists') {
                    this.globalError.set('Tài khoản đã tồn tại');
                } else {
                    this.globalError.set(serverErrors.error);
                }
            } 
            // Xử lý lỗi validation từng trường
            else {
                Object.keys(serverErrors).forEach(key => {
                  const control = this.authForm.get(key);
                  if (control) {
                    control.setErrors({ serverError: serverErrors[key] });
                  }
                });
            }
          } else {
            this.globalError.set('Có lỗi xảy ra, vui lòng thử lại.');
          }
        }
      });
    }
  }
}