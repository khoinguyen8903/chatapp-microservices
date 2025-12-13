export class FileHelper {
  // Chuyển link Docker/MinIO thành Localhost để trình duyệt đọc được
  static sanitizeUrl(url: string): string {
    if (!url) return '';
    if (url.includes('minio:9000')) {
        return url.replace('minio:9000', 'localhost:9000');
    }
    return url.replace('http://minio:9000', 'http://localhost:9000');
  }

  // Lấy tên file gốc từ URL
  static getFileName(url: string): string {
    if (!url) return 'file';
    const rawName = url.substring(url.lastIndexOf('/') + 1);
    const parts = rawName.split('_');
    // Nếu file có prefix timestamp (vd: 12345_anh.jpg) thì cắt bỏ prefix
    return parts.length > 1 ? parts.slice(1).join('_') : rawName;
  }
}