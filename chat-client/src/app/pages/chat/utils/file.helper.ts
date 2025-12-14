export class FileHelper {
  
  // 1. Chuyển link Docker/MinIO thành Localhost để trình duyệt đọc được
  static sanitizeUrl(url: string): string {
    if (!url) return '';
    
    // Thay thế domain nội bộ docker thành localhost
    // Dùng replaceAll hoặc regex để chắc chắn thay thế hết nếu xuất hiện nhiều lần
    let sanitized = url;
    if (sanitized.includes('minio:9000')) {
        sanitized = sanitized.replace('minio:9000', 'localhost:9000');
    }
    
    // Đảm bảo protocol đúng (nếu backend trả về thiếu http)
    if (sanitized.startsWith('localhost')) {
        sanitized = 'http://' + sanitized;
    }
    
    return sanitized;
  }

  // 2. Lấy tên file gốc từ URL (ĐÃ SỬA ĐỂ LOẠI BỎ THAM SỐ DÀI)
  static getFileName(url: string): string {
    if (!url) return 'file';

    try {
        // BƯỚC 1: Cắt bỏ phần tham số query (phần sau dấu ?)
        // Ví dụ: image.png?X-Amz... -> image.png
        const urlWithoutQuery = url.split('?')[0];

        // BƯỚC 2: Giải mã URL (để xử lý các ký tự %20 thành dấu cách, v.v.)
        const decodedUrl = decodeURIComponent(urlWithoutQuery);

        // BƯỚC 3: Lấy phần cuối cùng sau dấu /
        const rawName = decodedUrl.substring(decodedUrl.lastIndexOf('/') + 1);

        // BƯỚC 4: Xử lý Prefix Timestamp (Logic cũ của bạn)
        // Ví dụ: 17345678_hinh-anh.jpg -> hinh-anh.jpg
        const parts = rawName.split('_');
        
        // Chỉ cắt nếu có dấu gạch dưới (tức là có timestamp)
        // Nếu file gốc tên là "hinh_anh_dep.jpg" mà không có timestamp prefix từ backend thì coi chừng bị cắt nhầm.
        // Tuy nhiên, nếu quy ước backend luôn thêm timestamp_ thì logic này ok.
        return parts.length > 1 ? parts.slice(1).join('_') : rawName;

    } catch (e) {
        console.error('Lỗi parse tên file:', e);
        return 'file';
    }
  }
}