import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'fileName',
  standalone: true,
  pure: true  // ✅ Pure pipe for performance
})
export class FileNamePipe implements PipeTransform {
  transform(url: string): string {
    if (!url) return 'Unknown File';
    
    try {
      const parts = url.split('/');
      const filename = parts[parts.length - 1];
      return decodeURIComponent(filename);
    } catch {
      return 'Unknown File';
    }
  }
}

