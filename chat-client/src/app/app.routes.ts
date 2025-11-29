import { Routes } from '@angular/router';
// Import Component Login (Đảm bảo đường dẫn đúng tới file login.ts của bạn)
import { Login } from './pages/login/login'; 

export const routes: Routes = [
  // 1. Khi đường dẫn là 'login' -> Hiển thị trang Login
  { path: 'login', component: Login },
  
  // 2. Khi đường dẫn trống (trang chủ) -> Tự động chuyển hướng sang 'login'
  { path: '', redirectTo: '/login', pathMatch: 'full' },

  // 3. (Tùy chọn) Nếu nhập đường dẫn linh tinh -> Cũng chuyển về login
  { path: '**', redirectTo: '/login' }
];