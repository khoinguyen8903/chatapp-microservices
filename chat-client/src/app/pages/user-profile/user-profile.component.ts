import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { UserService, UserProfile } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.scss']
})
export class UserProfileComponent implements OnInit {
  profile: UserProfile | null = null;
  isLoading = false;
  errorMessage = '';
  userId: string | null = null;
  isOwnProfile = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private userService: UserService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Get user ID from route parameter
    this.userId = this.route.snapshot.paramMap.get('id');
    
    if (!this.userId) {
      this.errorMessage = 'User ID not provided';
      return;
    }

    // Check if viewing own profile
    const currentUserId = this.authService.getUserId();
    this.isOwnProfile = this.userId === currentUserId;

    // If viewing own profile, redirect to /profile (edit mode)
    if (this.isOwnProfile) {
      this.router.navigate(['/profile']);
      return;
    }

    this.loadUserProfile();
  }

  loadUserProfile(): void {
    if (!this.userId) return;

    this.isLoading = true;
    this.errorMessage = '';

    this.userService.getUserProfile(this.userId)
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (profile) => {
          console.log('✅ User profile loaded:', profile);
          this.profile = profile;
        },
        error: (err) => {
          console.error('❌ Error loading user profile:', err);
          this.errorMessage = 'Không thể tải thông tin người dùng. Vui lòng thử lại.';
        }
      });
  }

  /**
   * Go back to previous page
   */
  goBack(): void {
    // Try to go back in history, otherwise go to chat
    if (window.history.length > 1) {
      window.history.back();
    } else {
      this.router.navigate(['/chat']);
    }
  }

  /**
   * Get avatar URL with fallback
   */
  getAvatarUrl(): string {
    return this.profile?.avatarUrl || 'assets/default-avatar.svg';
  }

  /**
   * Get initials from user's name
   */
  getInitials(): string {
    if (!this.profile?.fullName) return '?';
    const names = this.profile.fullName.split(' ');
    if (names.length >= 2) {
      return (names[0][0] + names[names.length - 1][0]).toUpperCase();
    }
    return this.profile.fullName.substring(0, 2).toUpperCase();
  }

  /**
   * Handle avatar load error
   */
  onAvatarError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img) {
      img.src = 'assets/default-avatar.svg';
    }
  }
}

