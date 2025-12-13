import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatFacade } from './chat.facade';
import { ChatSidebarComponent } from './components/chat-sidebar/chat-sidebar.component';
import { ChatWindowComponent } from './components/chat-window/chat-window.component';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [
    CommonModule, 
    ChatSidebarComponent, // Import component con
    ChatWindowComponent   // Import component con
  ],
  templateUrl: './chat.html',
  styleUrls: ['./chat.scss']
})
export class Chat implements OnDestroy {
  // Inject Facade để cleanup khi component bị hủy
  constructor(private facade: ChatFacade) {}

  ngOnDestroy() {
    this.facade.cleanup();
  }
}