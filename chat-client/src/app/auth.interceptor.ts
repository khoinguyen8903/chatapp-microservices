import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Lấy token từ LocalStorage
  const token = localStorage.getItem('token');
  
  // Nếu có token, gắn vào Header Authorization
  if (token) {
    const cloned = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    return next(cloned);
  }
  
  // Không có token thì gửi request gốc
  return next(req);
};