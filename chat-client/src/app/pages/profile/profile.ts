import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService, UserProfile, UpdateProfileRequest } from '../../services/user.service';
import { MediaService } from '../../services/media.service';
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
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadProfile();
  }

  loadProfile(): void {
    this.userService.getCurrentUserProfile().subscribe({
      next: (profile) => {
        this.profile = profile;
        this.editForm = {
          fullName: profile.fullName || '',
          phone: profile.phone || '',
          bio: profile.bio || '',
          avatarUrl: profile.avatarUrl || ''
        };
      },
      error: (err) => {
        console.error('Failed to load profile:', err);
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

    this.userService.updateProfile(request).subscribe({
      next: (updatedProfile) => {
        this.profile = updatedProfile;
        this.isEditing = false;
        this.isSaving = false;
        this.successMessage = 'Profile updated successfully!';
        
        // Update localStorage with new name
        const currentUser = this.authService.getCurrentUser();
        if (currentUser) {
          currentUser.name = updatedProfile.fullName;
          localStorage.setItem('user', JSON.stringify(currentUser));
        }

        setTimeout(() => {
          this.successMessage = '';
        }, 3000);
      },
      error: (err) => {
        console.error('Failed to update profile:', err);
        this.errorMessage = 'Failed to update profile. Please try again.';
        this.isSaving = false;
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
    this.mediaService.uploadFile(file, userId || undefined).subscribe({
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
              setTimeout(() => {
                this.successMessage = '';
              }, 3000);
            },
            error: (err) => {
              console.error('Failed to save avatar:', err);
              this.errorMessage = 'Failed to save avatar. Please try again.';
            }
          });
        }
        
        this.isUploadingAvatar = false;
      },
      error: (err) => {
        console.error('Failed to upload avatar:', err);
        this.errorMessage = 'Failed to upload avatar. Please try again.';
        this.isUploadingAvatar = false;
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

