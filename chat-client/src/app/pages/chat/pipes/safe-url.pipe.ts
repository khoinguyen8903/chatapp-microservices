import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

@Pipe({
  name: 'safeUrl',
  standalone: true,
  pure: true  // ✅ Pure pipe for performance
})
export class SafeUrlPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(url: string): SafeUrl {
    if (!url) return '';
    return this.sanitizer.bypassSecurityTrustUrl(url);
  }
}

