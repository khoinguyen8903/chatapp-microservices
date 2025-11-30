import { Routes } from '@angular/router';
import { Login } from './pages/login/login'; // Import Component Login
import { Chat } from './pages/chat/chat';     // Import Component Chat

export const routes: Routes = [
  // Mặc định vào trang Login
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  
  // Đường dẫn trang Login
  { path: 'login', component: Login },
  
  // Đường dẫn trang Chat
  { path: 'chat', component: Chat },
  
  // (Tùy chọn) Chặn trang lỗi 404 quay về login
  { path: '**', redirectTo: 'login' }
];