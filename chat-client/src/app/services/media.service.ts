import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface MediaUploadResponse {
  url: string;
  type: string;
  fileName: string;
}

@Injectable({
  providedIn: 'root'
})
export class MediaService {
  private apiUrl = `${environment.apiUrl}/api/v1/media`;

  constructor(private http: HttpClient) { }

  // Upload file (for avatar or chat attachments)
  uploadFile(file: File, uploaderId?: string): Observable<MediaUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    if (uploaderId) {
      formData.append('uploaderId', uploaderId);
    }
    
    return this.http.post<MediaUploadResponse>(`${this.apiUrl}/upload`, formData);
  }
}

