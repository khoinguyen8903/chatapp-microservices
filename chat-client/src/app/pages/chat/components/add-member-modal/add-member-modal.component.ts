import { Component, EventEmitter, Output, Input, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatFacade } from '../../chat.facade';
import { ChatService } from '../../../../services/chat.service';
import { UserService, UserProfile } from '../../../../services/user.service';
import { debounceTime, distinctUntilChanged, Subject, switchMap, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Component({
  selector: 'app-add-member-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-member-modal.component.html',
  styleUrls: ['./add-member-modal.component.scss']
})
export class AddMemberModalComponent implements OnDestroy {
  facade = inject(ChatFacade);
  chatService = inject(ChatService);
  userService = inject(UserService);
  
  @Input() roomId: string = '';
  @Input() existingMemberIds: string[] = [];
  @Output() onClose = new EventEmitter<void>();
  @Output() onMembersAdded = new EventEmitter<string[]>();

  searchTerm = '';
  foundUsers: UserProfile[] = [];
  selectedUsers: UserProfile[] = [];
  isSearching = false;
  isAdding = false;
  private searchSubject = new Subject<string>();
  private searchSubscription = this.searchSubject.pipe(
    debounceTime(300),
    distinctUntilChanged(),
    switchMap(keyword => {
      if (!keyword.trim()) {
        this.foundUsers = [];
        this.isSearching = false;
        return of([] as UserProfile[]);
      }
      this.isSearching = true;
      return this.userService.searchUsers(keyword).pipe(
        catchError(err => {
          console.error('Error searching users:', err);
          this.isSearching = false;
          return of([] as UserProfile[]);
        })
      );
    })
  ).subscribe({
    next: (users) => {
      const currentUserId = this.facade.currentUser()?.id;
      // Filter out current user and existing members
      this.foundUsers = users.filter(user => 
        user.id !== currentUserId && 
        !this.existingMemberIds.includes(user.id) &&
        !this.selectedUsers.some(u => u.id === user.id)
      );
      this.isSearching = false;
    }
  });

  // Search for users (exclude existing members)
  searchUser() {
    if (!this.searchTerm.trim()) {
      this.foundUsers = [];
      return;
    }
    this.searchSubject.next(this.searchTerm.trim());
  }

  // Get display name for user (fullName or username)
  getUserDisplayName(user: UserProfile): string {
    return user.fullName || user.username;
  }

  // Get avatar for user
  getUserAvatar(user: UserProfile): string {
    return user.avatarUrl || 'assets/default-avatar.svg';
  }

  // Get avatar initials
  getAvatarInitials(user: UserProfile): string {
    const name = this.getUserDisplayName(user);
    return name.charAt(0).toUpperCase();
  }

  // Handle image error - show fallback initials
  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img) {
      img.style.display = 'none'; // Hide broken image
      
      const fallback = img.nextElementSibling as HTMLElement;
      if (fallback) {
        fallback.style.display = 'flex'; // Show fallback icon
      }
    }
  }

  toggleUser(user: UserProfile) {
    const index = this.selectedUsers.findIndex(u => u.id === user.id);
    if (index >= 0) {
      this.selectedUsers.splice(index, 1);
    } else {
      this.selectedUsers.push(user);
    }
    // Remove from foundUsers to avoid duplicates
    this.foundUsers = this.foundUsers.filter(u => u.id !== user.id);
  }

  isSelected(userId: string): boolean {
    return this.selectedUsers.some(u => u.id === userId);
  }

  addMembers() {
    if (this.selectedUsers.length === 0 || !this.roomId) return;

    this.isAdding = true;
    const userIds = this.selectedUsers.map(u => u.id);
    
    this.chatService.addMembers(this.roomId, userIds).subscribe({
      next: () => {
        this.onMembersAdded.emit(userIds);
        this.close();
      },
      error: (err) => {
        console.error('Error adding members:', err);
        alert(err.error?.error || 'Không thể thêm thành viên');
        this.isAdding = false;
      }
    });
  }

  close() {
    this.searchTerm = '';
    this.foundUsers = [];
    this.selectedUsers = [];
    this.onClose.emit();
  }

  ngOnDestroy() {
    this.searchSubscription.unsubscribe();
    this.searchSubject.complete();
  }
}

