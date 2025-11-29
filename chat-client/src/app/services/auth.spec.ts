import { TestBed } from '@angular/core/testing';
// Import module test cho HttpClient
import { HttpClientTestingModule } from '@angular/common/http/testing';

// SỬA LỖI: Import đúng tên class là AuthService (không phải Auth)
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule], // Cung cấp môi trường giả lập cho Http
      providers: [AuthService]
    });
    service = TestBed.inject(AuthService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});