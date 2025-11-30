import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http'; // Import thêm withInterceptors

import { routes } from './app.routes';
import { authInterceptor } from './auth.interceptor'; // Import interceptor vừa tạo

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    
    // CẤU HÌNH QUAN TRỌNG: Đăng ký Interceptor tại đây
    provideHttpClient(withInterceptors([authInterceptor])) 
  ]
};