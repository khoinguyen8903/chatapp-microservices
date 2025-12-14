import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatFacade } from '../../chat.facade';

@Component({
  selector: 'app-create-group-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-group-modal.component.html'
})
export class CreateGroupModalComponent {
  facade = inject(ChatFacade);
  
  @Output() onClose = new EventEmitter<void>();

  groupName = '';
  searchTerm = '';
  foundUser: any = null;
  selectedMembers: any[] = [];

  // Tìm user để add vào nhóm
  searchUser() {
    if (!this.searchTerm.trim()) return;
    this.facade.findAndChatUser(this.searchTerm.trim()).subscribe({
      next: (res: any) => {
        // Không tìm chính mình và không tìm người đã add rồi
        if (res.userId !== this.facade.currentUser().id && !this.selectedMembers.some(m => m.id === res.userId)) {
            this.foundUser = { id: res.userId, username: res.username };
        } else {
            alert('Không tìm thấy hoặc đã thêm rồi!');
            this.foundUser = null;
        }
      },
      error: () => {
        alert('Không tìm thấy user!');
        this.foundUser = null;
      }
    });
  }

  addMember(user: any) {
    this.selectedMembers.push(user);
    this.foundUser = null;
    this.searchTerm = '';
  }

  removeMember(userId: string) {
    this.selectedMembers = this.selectedMembers.filter(m => m.id !== userId);
  }

  createGroup() {
    if (!this.groupName || this.selectedMembers.length === 0) return;
    
    // Gom ID các thành viên + ID của mình (Backend đã tự handle admin, nhưng gửi thêm cho chắc)
    const memberIds = this.selectedMembers.map(m => m.id);
    // Lưu ý: Facade createGroup sẽ tự lấy currentUserID làm Admin
    
    this.facade.createGroup(this.groupName, memberIds).subscribe({
      next: () => {
        this.facade.loadRooms(); // Reload list
        this.close();
      },
      error: (err) => console.error(err)
    });
  }

  close() {
    this.onClose.emit();
  }
}