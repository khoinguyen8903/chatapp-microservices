import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms'; // Import mới
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule], // Đổi FormsModule thành ReactiveFormsModule
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login {
  isLoginMode = signal(true);
  isLoading = signal(false);
  showPassword = signal(false);
  
  // Form chính
  authForm: FormGroup;

  // Global error message (lỗi chung không thuộc về field nào)
  globalError = signal<string>('');

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    // Khởi tạo Form với các validate khớp với Backend Java
    this.authForm = this.fb.group({
      username: ['', [
        Validators.required, 
        Validators.minLength(3), 
        Validators.maxLength(20),
        Validators.pattern('^[a-zA-Z0-9]*$') // Khớp với regex Backend
      ]],
      password: ['', [
        Validators.required, 
        Validators.minLength(6)
      ]],
      confirmPassword: [''], // Validate logic sau
      displayName: ['', [Validators.maxLength(50)]],
      email: ['', [Validators.email]]
    });
  }

  // Helper để lấy control ra check lỗi trong HTML cho ngắn gọn
  get f() { return this.authForm.controls; }

  toggleMode() {
    this.isLoginMode.update(prev => !prev);
    this.globalError.set('');
    this.authForm.reset();
    
    // Nếu chuyển sang Register, thêm validator required cho displayName/email nếu cần
    if (!this.isLoginMode()) {
       // Có thể thêm logic dynamic validation ở đây nếu muốn chặt chẽ hơn
    }
  }

  togglePassword() {
    this.showPassword.update(prev => !prev);
  }

  onSubmit() {
    this.globalError.set('');

    // 1. Validate Form chung
    if (this.authForm.invalid) {
      // Đánh dấu tất cả các trường là đã touch để hiển thị lỗi đỏ
      this.authForm.markAllAsTouched(); 
      return;
    }

    const val = this.authForm.value;

    // 2. Xử lý Logic Login
    if (this.isLoginMode()) {
      this.isLoading.set(true);
      this.authService.login({ username: val.username, password: val.password }).subscribe({
        next: (res) => {
          this.isLoading.set(false);
          // this.router.navigate(['/chat']);
          alert('Login thành công!');
        },
        error: (err) => {
          this.isLoading.set(false);
          this.globalError.set('Sai tài khoản hoặc mật khẩu.');
        }
      });
    } 
    // 3. Xử lý Logic Register
    else {
      // Validate khớp password thủ công
      if (val.password !== val.confirmPassword) {
        this.authForm.get('confirmPassword')?.setErrors({ mismatch: true });
        return;
      }

      this.isLoading.set(true);
      this.authService.register({
        username: val.username,
        password: val.password,
        displayName: val.displayName || val.username, // Fallback nếu rỗng
        email: val.email
      }).subscribe({
        next: () => {
          this.isLoading.set(false);
          alert('Đăng ký thành công!');
          this.toggleMode();
        },
        error: (err) => {
          this.isLoading.set(false);
          
          // XỬ LÝ LỖI TỪ BACKEND TRẢ VỀ (Map<String, String>)
          if (err.status === 400 && err.error) {
            const serverErrors = err.error; // {username: "...", password: "..."}
            
            // Map lỗi vào từng field cụ thể
            Object.keys(serverErrors).forEach(key => {
              const control = this.authForm.get(key);
              if (control) {
                control.setErrors({ serverError: serverErrors[key] });
              }
            });
          } else {
            this.globalError.set('Có lỗi xảy ra, vui lòng thử lại.');
          }
        }
      });
    }
  }
}