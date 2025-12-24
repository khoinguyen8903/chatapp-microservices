import { Routes } from '@angular/router';
import { Login } from './pages/login/login'; // Import Component Login
import { Chat } from './pages/chat/chat';     // Import Component Chat
import { ProfileComponent } from './pages/profile/profile'; // Import Profile Component (Edit own profile)
import { UserProfileComponent } from './pages/user-profile/user-profile.component'; // View other user's profile

export const routes: Routes = [
  // Mặc định vào trang Login
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  
  // Đường dẫn trang Login
  { path: 'login', component: Login },
  
  // Đường dẫn trang Chat
  { path: 'chat', component: Chat },
  
  // Đường dẫn trang Profile (Edit own profile)
  { path: 'profile', component: ProfileComponent },
  
  // Đường dẫn xem hồ sơ người khác (View other user's profile)
  { path: 'profile/:id', component: UserProfileComponent },
  
  // Email verification page
  { path: 'verify', component: Login }, // Will handle verification in Login component
  
  // (Tùy chọn) Chặn trang lỗi 404 quay về login
  { path: '**', redirectTo: 'login' }
];