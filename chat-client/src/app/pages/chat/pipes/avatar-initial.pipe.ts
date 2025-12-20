import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'avatarInitial',
  standalone: true,
  pure: true  // ✅ Pure pipe for performance
})
export class AvatarInitialPipe implements PipeTransform {
  transform(name: string | undefined): string {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  }
}

