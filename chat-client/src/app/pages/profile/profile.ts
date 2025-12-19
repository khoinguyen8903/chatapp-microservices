import { Component, OnInit, ChangeDetectorRef } from '@angular/core'; // <--- Đã thêm ChangeDetectorRef
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService, UserProfile, UpdateProfileRequest } from '../../services/user.service';
import { MediaService } from '../../services/media.service';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.html',
  styleUrls: ['./profile.scss']
})
export class ProfileComponent implements OnInit {
  profile: UserProfile | null = null;
  isLoading = false;
  isEditing = false;
  isSaving = false;
  isUploadingAvatar = false;
  errorMessage = '';
  successMessage = '';

  // Editable fields
  editForm = {
    fullName: '',
    phone: '',
    bio: '',
    avatarUrl: ''
  };

  constructor(
    private userService: UserService,
    private mediaService: MediaService,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef // <--- Đã Inject CDR để ép cập nhật giao diện
  ) {}

  ngOnInit(): void {
    this.loadProfile();
  }

  loadProfile(): void {
    this.isLoading = true;
    this.errorMessage = '';
    
    this.userService.getCurrentUserProfile()
      .pipe(
        // finalize đảm bảo isLoading luôn tắt dù thành công hay thất bại
        finalize(() => {
            this.isLoading = false; 
            console.log('🛑 Loading stopped.');
            this.cdr.detectChanges(); // <--- QUAN TRỌNG: Ép giao diện vẽ lại ngay lập tức
        })
      )
      .subscribe({
        next: (profile) => {
          console.log('✅ API Response Data:', profile);

          if (!profile) {
              this.errorMessage = "User profile is null";
              return;
          }

          this.profile = profile;
          
          // Map dữ liệu cẩn thận, dùng || '' để tránh undefined
          this.editForm = {
            fullName: profile.fullName || '',
            phone: profile.phone || '',
            bio: profile.bio || '',
            avatarUrl: profile.avatarUrl || ''
          };
        },
        error: (err) => {
          console.error('❌ Error loading profile:', err);
          this.errorMessage = 'Failed to load profile. Please try again.';
        }
      });
  }

  toggleEdit(): void {
    if (this.isEditing) {
      // Cancel edit
      this.isEditing = false;
      if (this.profile) {
        this.editForm = {
          fullName: this.profile.fullName || '',
          phone: this.profile.phone || '',
          bio: this.profile.bio || '',
          avatarUrl: this.profile.avatarUrl || ''
        };
      }
    } else {
      // Start editing
      this.isEditing = true;
      this.errorMessage = '';
      this.successMessage = '';
    }
  }

  saveProfile(): void {
    this.isSaving = true;
    this.errorMessage = '';
    this.successMessage = '';

    const request: UpdateProfileRequest = {
      fullName: this.editForm.fullName,
      phone: this.editForm.phone,
      bio: this.editForm.bio,
      avatarUrl: this.editForm.avatarUrl
    };

    this.userService.updateProfile(request)
      .pipe(
        finalize(() => {
           this.isSaving = false;
           this.cdr.detectChanges(); // Ép cập nhật sau khi lưu xong
        })
      )
      .subscribe({
        next: (updatedProfile) => {
          this.profile = updatedProfile;
          this.isEditing = false;
          this.successMessage = 'Profile updated successfully!';
          
          // Update localStorage with new name
          const currentUser = this.authService.getCurrentUser();
          if (currentUser) {
            currentUser.name = updatedProfile.fullName;
            localStorage.setItem('user', JSON.stringify(currentUser));
          }

          setTimeout(() => {
            this.successMessage = '';
            this.cdr.detectChanges();
          }, 3000);
        },
        error: (err) => {
          console.error('Failed to update profile:', err);
          this.errorMessage = 'Failed to update profile. Please try again.';
        }
      });
  }

  onAvatarFileSelected(event: any): void {
    const file: File = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      this.errorMessage = 'Please select a valid image file';
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      this.errorMessage = 'Image size must be less than 5MB';
      return;
    }

    this.isUploadingAvatar = true;
    this.errorMessage = '';

    const userId = this.authService.getUserId();
    // Chuyển userId thành undefined nếu null để phù hợp với hàm uploadFile
    const validUserId = userId ? userId : undefined;

    this.mediaService.uploadFile(file, validUserId)
      .pipe(
        finalize(() => {
           this.isUploadingAvatar = false;
           this.cdr.detectChanges(); // Ép cập nhật sau khi upload xong
        })
      )
      .subscribe({
        next: (response) => {
          this.editForm.avatarUrl = response.url;
          if (this.profile) {
            this.profile.avatarUrl = response.url;
          }
          
          // Auto-save if not in edit mode
          if (!this.isEditing) {
            const request: UpdateProfileRequest = {
              avatarUrl: response.url
            };
            this.userService.updateProfile(request).subscribe({
              next: (updatedProfile) => {
                this.profile = updatedProfile;
                this.successMessage = 'Avatar updated successfully!';
                this.cdr.detectChanges();
                setTimeout(() => {
                  this.successMessage = '';
                  this.cdr.detectChanges();
                }, 3000);
              },
              error: (err) => {
                console.error('Failed to save avatar:', err);
                this.errorMessage = 'Failed to save avatar. Please try again.';
                this.cdr.detectChanges();
              }
            });
          }
        },
        error: (err) => {
          console.error('Failed to upload avatar:', err);
          this.errorMessage = 'Failed to upload avatar. Please try again.';
        }
      });
  }

  goBack(): void {
    this.router.navigate(['/chat']);
  }

  logout(): void {
    this.authService.logout();
  }

  getAvatarUrl(): string {
    return this.profile?.avatarUrl || 'https://via.placeholder.com/150';
  }

  getInitials(): string {
    if (!this.profile?.fullName) return '?';
    const names = this.profile.fullName.split(' ');
    if (names.length >= 2) {
      return (names[0][0] + names[names.length - 1][0]).toUpperCase();
    }
    return this.profile.fullName.substring(0, 2).toUpperCase();
  }
}