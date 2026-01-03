# KẾ HOẠCH TRIỂN KHAI FRONTEND - TÍNH NĂNG KẾT BẠN

---

## 📋 TỔNG QUAN

Friend-service backend đã hoàn thiện với tất cả API endpoint hoạt động:
- ✅ `POST /api/friends/requests/send` - Gửi lời mời kết bạn
- ✅ `GET /api/friends/requests/received` - Lấy lời mời đã nhận
- ✅ `GET /api/friends/requests/sent` - Lấy lời mời đã gửi
- ✅ `PUT /api/friends/requests/{id}/accept` - Chấp nhận lời mời
- ✅ `PUT /api/friends/requests/{id}/reject` - Từ chối lời mời
- ✅ `DELETE /api/friends/requests/{id}` - Hủy lời mời
- ✅ `GET /api/friends` - Lấy danh sách bạn bè
- ✅ `GET /api/friends/{id}/status` - Kiểm tra trạng thái bạn bè
- ✅ `DELETE /api/friends/{id}` - Hủy kết bạn
- ✅ `POST /api/friends/{id}/block` - Chặn người dùng
- ✅ `DELETE /api/friends/{id}/block` - Bỏ chặn người dùng
- ✅ `GET /api/friends/blocked` - Lấy danh sách đã chặn
- ✅ `GET /api/friends/recommendations` - Lấy gợi ý kết bạn
- ✅ `GET /api/friends/search` - Tìm kiếm người dùng

---

## 🎯 PHẦN 1: CẤU TRÚC THƯ MỤC FRONTEND

```
chat-client/src/app/
├── pages/
│   └── friends/
│       ├── friends.module.ts                           # Friend Feature Module
│       ├── friends.component.ts                        # Main friends container
│       ├── friends.component.html                       # Main friends template
│       ├── friends.component.scss                       # Main friends styles
│       │
│       ├── friend-requests/
│       │   ├── friend-requests.component.ts              # Friend requests list
│       │   ├── friend-requests.component.html              # Request list UI
│       │   └── friend-requests.component.scss              # Request list styles
│       │
│       ├── find-friends/
│       │   ├── find-friends.component.ts                 # Find/search friends
│       │   ├── find-friends.component.html                 # Search UI
│       │   └── find-friends.component.scss                 # Search styles
│       │
│       └── blocked-users/
│           ├── blocked-users.component.ts                   # Blocked users list
│           ├── blocked-users.component.html                   # Blocked UI
│           └── blocked-users.component.scss                   # Blocked styles
│
├── services/
│   └── friend.service.ts                             # Friend API Service
│
├── interfaces/
│   ├── friend.interface.ts                          # Friend data model
│   ├── friend-request.interface.ts                    # Friend request model
│   └── user.interface.ts                            # User data model (reuse)
│
└── shared/
    └── components/
        ├── friend-card/
        │   ├── friend-card.component.ts                # Single friend card
        │   ├── friend-card.component.html                # Card template
        │   └── friend-card.component.scss                # Card styles
        │
        ├── friend-request-card/
        │   ├── friend-request-card.component.ts          # Single request card
        │   ├── friend-request-card.component.html          # Request template
        │   └── friend-request-card.component.scss          # Request styles
        │
        └── user-avatar/
            ├── user-avatar.component.ts                     # Avatar component
            ├── user-avatar.component.html                     # Avatar template
            └── user-avatar.component.scss                     # Avatar styles
```

---

## 📝 PHẦN 2: DATA MODELS & INTERFACES

### 2.1. Friend Interface (`src/app/interfaces/friend.interface.ts`)

```typescript
export interface Friend {
  id: string;
  userId: string;
  friendId: string;
  friendUsername: string;
  friendFullName: string;
  friendAvatarUrl: string | null;
  status: string;
  createdAt: string;
}
```

### 2.2. Friend Request Interface (`src/app/interfaces/friend-request.interface.ts`)

```typescript
export interface FriendRequest {
  id: string;
  senderId: string;
  receiverId: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  message?: string;
  createdAt: string;
}
```

### 2.3. Friend Status Interface

```typescript
export interface FriendStatus {
  userId: string;
  status: 'NOT_FRIENDS' | 'PENDING_REQUEST' | 'ARE_FRIENDS' | 'BLOCKED';
  canSendRequest: boolean;
}
```

---

## 🔧 PHẦN 3: FRIEND SERVICE (`src/app/services/friend.service.ts`)

### 3.1. Service Methods

```typescript
@Injectable({
  providedIn: 'root'
})
export class FriendService {
  private baseUrl = 'https://api.chatify.asia/api';

  constructor(private http: HttpClient, private authService: AuthService) {}

  // Get auth headers
  private getHeaders() {
    const token = this.authService.getToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  // === FRIEND MANAGEMENT ===

  /**
   * Get list of friends
   */
  getFriends(): Observable<Friend[]> {
    return this.http.get<Friend[]>(`${this.baseUrl}/friends`, {
      headers: this.getHeaders()
    });
  }

  /**
   * Get friendship status with a user
   */
  getFriendStatus(userId: string): Observable<FriendStatus> {
    return this.http.get<FriendStatus>(`${this.baseUrl}/friends/${userId}/status`, {
      headers: this.getHeaders()
    });
  }

  /**
   * Unfriend a user
   */
  unfriend(friendId: string): Observable<void> {
    return this.http.delete(`${this.baseUrl}/friends/${friendId}`, {
      headers: this.getHeaders()
    });
  }

  // === FRIEND REQUEST MANAGEMENT ===

  /**
   * Send friend request
   */
  sendFriendRequest(receiverId: string, message?: string): Observable<FriendRequest> {
    return this.http.post<FriendRequest>(`${this.baseUrl}/friends/requests/send`, {
      receiverId,
      message
    }, {
      headers: this.getHeaders()
    });
  }

  /**
   * Get received friend requests
   */
  getReceivedRequests(): Observable<FriendRequest[]> {
    return this.http.get<FriendRequest[]>(`${this.baseUrl}/friends/requests/received`, {
      headers: this.getHeaders()
    });
  }

  /**
   * Get sent friend requests
   */
  getSentRequests(): Observable<FriendRequest[]> {
    return this.http.get<FriendRequest[]>(`${this.baseUrl}/friends/requests/sent`, {
      headers: this.getHeaders()
    });
  }

  /**
   * Accept friend request
   */
  acceptRequest(requestId: string): Observable<void> {
    return this.http.put(`${this.baseUrl}/friends/requests/${requestId}/accept`, {}, {
      headers: this.getHeaders()
    });
  }

  /**
   * Reject friend request
   */
  rejectRequest(requestId: string): Observable<void> {
    return this.http.put(`${this.baseUrl}/friends/requests/${requestId}/reject`, {}, {
      headers: this.getHeaders()
    });
  }

  /**
   * Cancel friend request
   */
  cancelRequest(requestId: string): Observable<void> {
    return this.http.delete(`${this.baseUrl}/friends/requests/${requestId}`, {
      headers: this.getHeaders()
    });
  }

  // === BLOCK MANAGEMENT ===

  /**
   * Block a user
   */
  blockUser(userId: string, reason?: string): Observable<void> {
    return this.http.post(`${this.baseUrl}/friends/${userId}/block?reason=${reason || ''}`, {}, {
      headers: this.getHeaders()
    });
  }

  /**
   * Unblock a user
   */
  unblockUser(userId: string): Observable<void> {
    return this.http.delete(`${this.baseUrl}/friends/${userId}/block`, {
      headers: this.getHeaders()
    });
  }

  /**
   * Get blocked users
   */
  getBlockedUsers(): Observable<BlockedUser[]> {
    return this.http.get<BlockedUser[]>(`${this.baseUrl}/friends/blocked`, {
      headers: this.getHeaders()
    });
  }

  // === RECOMMENDATIONS ===

  /**
   * Get friend recommendations
   */
  getRecommendations(): Observable<Recommendation[]> {
    return this.http.get<Recommendation[]>(`${this.baseUrl}/friends/recommendations`, {
      headers: this.getHeaders()
    });
  }

  /**
   * Search users
   */
  searchUsers(keyword: string): Observable<User[]> {
    return this.http.get<User[]>(`${this.baseUrl}/friends/search?keyword=${keyword}`, {
      headers: this.getHeaders()
    });
  }
}
```

---

## 🎨 PHẦN 4: UI COMPONENTS

### 4.1. Main Friends Component (`friends.component.ts`)

**Features:**
- ✅ Tabs: Friends | Friend Requests | Find Friends | Blocked
- ✅ List view cho từng tab
- ✅ Search functionality
- ✅ Responsive design (Tailwind CSS)

**Template structure:**
```html
<div class="friends-container">
  <!-- Header -->
  <header class="friends-header">
    <h1>👥 Bạn Bè</h1>
    <div class="search-box">
      <input type="text" placeholder="Tìm kiếm bạn bè..." />
    </div>
  </header>

  <!-- Tabs -->
  <div class="friends-tabs">
    <button class="tab active">Danh Sách Bạn Bè</button>
    <button class="tab">Lời Mời ({{ receivedCount }})</button>
    <button class="tab">Tìm Bạn</button>
    <button class="tab">Đã Chặn</button>
  </div>

  <!-- Content Area -->
  <div class="friends-content">
    <!-- Friends List Tab -->
    <div *ngIf="activeTab === 'friends'" class="friends-list">
      <friend-card *ngFor="let friend of friends" [friend]="friend"></friend-card>
    </div>

    <!-- Friend Requests Tab -->
    <div *ngIf="activeTab === 'requests'" class="requests-list">
      <friend-request-card *ngFor="let request of requests" [request]="request"></friend-request-card>
    </div>

    <!-- Find Friends Tab -->
    <div *ngIf="activeTab === 'find'" class="find-friends">
      <find-friends></find-friends>
    </div>

    <!-- Blocked Users Tab -->
    <div *ngIf="activeTab === 'blocked'" class="blocked-list">
      <blocked-users [blockedUsers]="blockedUsers"></blocked-users>
    </div>
  </div>

  <!-- Loading & Error States -->
  <div *ngIf="loading" class="loading">Đang tải...</div>
  <div *ngIf="error" class="error">{{ error }}</div>
</div>
```

### 4.2. Friend Card Component (`friend-card.component.ts`)

**Features:**
- ✅ Hiển thị thông tin bạn bè
- ✅ Avatar, tên, status
- ✅ Nút: Chat, Unfriend, Block
- ✅ Hover effects

**Template:**
```html
<div class="friend-card" [ngClass]="{'blocked': friend.status === 'BLOCKED'}">
  <div class="friend-avatar">
    <img [src]="friend.friendAvatarUrl || '/assets/default-avatar.png'" alt="Avatar" />
  </div>
  <div class="friend-info">
    <h3>{{ friend.friendFullName || friend.friendUsername }}</h3>
    <p class="username">@{{ friend.friendUsername }}</p>
    <p class="status">{{ getStatusText(friend.status) }}</p>
    <p class="since">Kết bạn từ: {{ formatDate(friend.createdAt) }}</p>
  </div>
  <div class="friend-actions">
    <button class="btn-chat" (click)="openChat(friend.friendId)">
      💬 Chat
    </button>
    <button *ngIf="friend.status !== 'BLOCKED'" class="btn-unfriend" (click)="unfriend(friend.friendId)">
      🗑️ Hủy kết bạn
    </button>
    <button *ngIf="friend.status === 'BLOCKED'" class="btn-unblock" (click)="unblock(friend.friendId)">
      🔓 Bỏ chặn
    </button>
    <button *ngIf="friend.status !== 'BLOCKED'" class="btn-block" (click)="block(friend.friendId)">
      🚫 Chặn
    </button>
  </div>
</div>
```

### 4.3. Friend Request Card Component (`friend-request-card.component.ts`)

**Features:**
- ✅ Hiển thị thông tin lời mời
- ✅ Nút: Accept, Reject
- ✅ Xem profile người gửi

**Template:**
```html
<div class="request-card">
  <div class="request-avatar">
    <img [src]="request.senderAvatar || '/assets/default-avatar.png'" alt="Avatar" />
  </div>
  <div class="request-info">
    <h3>{{ request.senderFullName || request.senderUsername }}</h3>
    <p class="username">@{{ request.senderUsername }}</p>
    <p *ngIf="request.message" class="message">"{{ request.message }}"</p>
    <p class="date">{{ formatDate(request.createdAt) }}</p>
  </div>
  <div class="request-actions">
    <button class="btn-accept" (click)="accept(request.id)">
      ✅ Chấp nhận
    </button>
    <button class="btn-reject" (click)="reject(request.id)">
      ❌ Từ chối
    </button>
    <button class="btn-profile" (click)="viewProfile(request.senderId)">
      👤 Xem Profile
    </button>
  </div>
</div>
```

### 4.4. Find Friends Component (`find-friends.component.ts`)

**Features:**
- ✅ Search input với debounce
- ✅ Hiển thị kết quả tìm kiếm
- ✅ Nút: Send request, View profile

**Template:**
```html
<div class="find-friends-container">
  <div class="search-section">
    <input
      type="text"
      [(ngModel)]="searchKeyword"
      (input)="onSearch($event)"
      placeholder="Tìm kiếm người dùng..."
      class="search-input"
    />
  </div>

  <div *ngIf="searchKeyword.length < 3" class="search-hint">
    <p>Nhập ít nhất 3 ký tự để tìm kiếm</p>
  </div>

  <div *ngIf="searchResults.length > 0" class="search-results">
    <div *ngFor="let user of searchResults" class="user-card">
      <user-avatar [user]="user"></user-avatar>
      <div class="user-info">
        <h3>{{ user.fullName || user.username }}</h3>
        <p class="username">@{{ user.username }}</p>
      </div>
      <div class="user-actions">
        <button *ngIf="user.canSendRequest" class="btn-request" (click)="sendRequest(user.id)">
          📤 Gửi lời mời
        </button>
        <button class="btn-profile" (click)="viewProfile(user.id)">
          👤 Xem Profile
        </button>
      </div>
    </div>
  </div>

  <div *ngIf="loading" class="loading">
    <p>Đang tìm kiếm...</p>
  </div>

  <div *ngIf="searchResults.length === 0 && searchKeyword.length >= 3" class="no-results">
    <p>Không tìm thấy người dùng nào</p>
  </div>
</div>
```

---

## 🔐 PHẦN 5: AUTHENTICATION & ROUTING

### 5.1. Friends Module (`friends.module.ts`)

```typescript
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';

import { FriendsComponent } from './friends.component';
import { FriendRequestsComponent } from './friend-requests/friend-requests.component';
import { FindFriendsComponent } from './find-friends/find-friends.component';
import { BlockedUsersComponent } from './blocked-users/blocked-users.component';
import { FriendCardComponent } from '../../shared/components/friend-card/friend-card.component';
import { FriendRequestCardComponent } from '../../shared/components/friend-request-card/friend-request-card.component';
import { UserAvatarComponent } from '../../shared/components/user-avatar/user-avatar.component';

const friendsRoutes: Routes = [
  {
    path: '',
    component: FriendsComponent,
    children: [
      {
        path: '',
        redirectTo: 'friends',
        pathMatch: 'full'
      },
      {
        path: 'friends',
        component: FriendsComponent
      },
      {
        path: 'requests',
        component: FriendRequestsComponent
      },
      {
        path: 'find',
        component: FindFriendsComponent
      },
      {
        path: 'blocked',
        component: BlockedUsersComponent
      }
    ]
  }
];

@NgModule({
  declarations: [
    FriendsComponent,
    FriendRequestsComponent,
    FindFriendsComponent,
    BlockedUsersComponent,
    FriendCardComponent,
    FriendRequestCardComponent,
    UserAvatarComponent
  ],
  imports: [
    CommonModule,
    RouterModule.forChild(friendsRoutes),
    ReactiveFormsModule
  ],
  providers: [FriendService]
})
export class FriendsModule { }
```

### 5.2. Update Main App Routes (`app.routes.ts`)

```typescript
const routes: Routes = [
  // ... existing routes ...
  {
    path: 'friends',
    loadChildren: () => import('./pages/friends').then(m => m.FriendsModule)
  }
];
```

### 5.3. Add Navigation to Existing App

**Update `app.component.html` or navigation menu:**
```html
<a routerLink="/friends" routerLinkActive="active">
  👥 Bạn Bè
</a>
```

---

## 🎨 PHẦN 6: STYLING (TAILWIND CSS)

### 6.1. Color Scheme

```scss
// Primary Colors
$friend-primary: #667eea;
$friend-secondary: #764ba2;
$friend-success: #4CAF50;
$friend-danger: #f44336;
$friend-warning: #ffc107;
$friend-info: #17a2b8;

// Background Colors
$bg-primary: #ffffff;
$bg-secondary: #f8f9fa;
$bg-hover: #e9ecef;
```

### 6.2. Component Styles Examples

**Friend Card Styles:**
```scss
.friend-card {
  @apply bg-white rounded-xl shadow-md p-4 flex items-center space-x-4;
  transition: all 0.3s ease;
  border: 2px solid #e5e7eb;

  &:hover {
    @apply transform scale-105 shadow-lg;
    border-color: $friend-primary;
  }

  &.blocked {
    @apply opacity-60 grayscale;
  }
}

.friend-avatar {
  @apply w-20 h-20 rounded-full overflow-hidden;
}

.friend-info {
  @apply flex-1 space-y-2;
}

.friend-actions {
  @apply flex space-x-2;
}

.btn-chat {
  @apply bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-2 rounded-lg;
  transition: all 0.2s;

  &:hover {
    @apply scale-105;
  }
}

.btn-unfriend {
  @apply bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-2 rounded-lg;
  transition: all 0.2s;

  &:hover {
    @apply scale-105;
  }
}
```

**Friends Container Styles:**
```scss
.friends-container {
  @apply min-h-screen bg-gray-50 p-6;
}

.friends-header {
  @apply text-3xl font-bold text-gray-800 mb-6;
}

.friends-tabs {
  @apply flex space-x-4 bg-white rounded-xl p-2 mb-6 shadow-sm;
}

.tab {
  @apply px-6 py-3 rounded-lg font-semibold transition-all duration-200;
  color: #6b7280;

  &.active {
    @apply bg-gradient-to-r from-indigo-500 to-purple-600 text-white;
  }

  &:hover:not(.active) {
    @apply bg-indigo-100;
  }
}

.loading {
  @apply flex justify-center items-center py-12;
}

.error {
  @apply bg-red-100 text-red-700 p-4 rounded-lg;
}
```

---

## 🧪 PHẦN 7: TESTING

### 7.1. Unit Tests

**Service Tests (`friend.service.spec.ts`):**
```typescript
describe('FriendService', () => {
  let service: FriendService;
  let httpMock: any;
  let authServiceMock: any;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        FriendService,
        { provide: HttpClient, useValue: httpMock },
        { provide: AuthService, useValue: authServiceMock }
      ]
    });
    service = TestBed.inject(FriendService);
  });

  it('should get friends', () => {
    const mockFriends = [/* mock data */];
    httpMock.get.and.returnValue(of(mockFriends));

    service.getFriends().subscribe(friends => {
      expect(friends).toEqual(mockFriends);
    });
  });

  it('should send friend request', () => {
    const mockRequest = { id: '123', /* ... */ };
    httpMock.post.and.returnValue(of(mockRequest));

    service.sendFriendRequest('userId', 'Hi!').subscribe(request => {
      expect(request).toEqual(mockRequest);
    });
  });

  // More tests...
});
```

### 7.2. Component Tests

**Friends Component Tests (`friends.component.spec.ts`):**
```typescript
describe('FriendsComponent', () => {
  let component: FriendsComponent;
  let fixture: ComponentFixture<FriendsComponent>;
  let friendServiceMock: any;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [FriendsComponent],
      providers: [
        { provide: FriendService, useValue: jasmine.createSpyObj('FriendService') }
      ]
    });
    fixture = TestBed.createComponent(FriendsComponent);
    component = fixture.componentInstance;
    friendServiceMock = TestBed.inject(FriendService);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load friends on init', () => {
    const mockFriends = [/* mock */];
    friendServiceMock.getFriends.and.returnValue(of(mockFriends));
    component.ngOnInit();
    expect(component.friends).toEqual(mockFriends);
  });

  // More tests...
});
```

### 7.3. Integration Tests

Test flow: Gửi lời mời → Chấp nhận → Xem trong danh sách bạn bè

```typescript
describe('Friend Flow Integration Tests', () => {
  it('should complete friend request flow', async () => {
    // 1. Login
    await authService.login('user1', 'pass1');

    // 2. Get user2 profile
    const user2 = await getUserProfile('user2-id');

    // 3. Send request
    const request = await friendService.sendFriendRequest(user2.id, 'Hi!');
    expect(request.status).toBe('PENDING');

    // 4. Accept request (as user2)
    await friendService.acceptRequest(request.id);

    // 5. Verify in friends list
    const friends = await friendService.getFriends();
    expect(friends.some(f => f.friendId === user2.id)).toBe(true);
  });
});
```

---

## 📱 PHẦN 8: RESPONSIVE DESIGN & UX

### 8.1. Mobile (< 768px)

**Optimizations:**
- ✅ Single column layout
- ✅ Bottom navigation bar
- ✅ Swipe actions for friend cards
- ✅ Large touch targets (44px minimum)

### 8.2. Tablet (768px - 1024px)

**Optimizations:**
- ✅ 2-3 column layout
- ✅ Tab navigation
- ✅ Slide-over panels for actions

### 8.3. Desktop (> 1024px)

**Optimizations:**
- ✅ 3-4 column grid layout
- ✅ Sidebar navigation
- ✅ Hover tooltips

### 8.4. UX Enhancements

**Features:**
- ✅ Skeleton loading states
- ✅ Optimistic UI updates
- ✅ Undo/Redo support (optional)
- ✅ Keyboard navigation
- ✅ Accessibility (ARIA labels)
- ✅ Dark mode support (optional)

---

## 🔄 PHẦN 9: STATE MANAGEMENT

### 9.1. NgRx Store Structure

```typescript
// State
export interface FriendsState {
  friends: Friend[];
  requests: FriendRequest[];
  recommendations: Recommendation[];
  blockedUsers: BlockedUser[];
  loading: boolean;
  error: string | null;
  totalFriends: number;
  pendingRequestsCount: number;
}

// Actions
export enum FriendsActionType {
  LoadFriends = '[Friends] Load Friends',
  LoadFriendsSuccess = '[Friends] Load Friends Success',
  LoadFriendsFailure = '[Friends] Load Friends Failure',
  SendRequest = '[Friends] Send Request',
  SendRequestSuccess = '[Friends] Send Request Success',
  AcceptRequest = '[Friends] Accept Request',
  // More actions...
}
```

### 9.2. Selectors

```typescript
export const selectFriends = (state: FriendsState) => state.friends;
export const selectRequests = (state: FriendsState) => state.requests;
export const selectLoading = (state: FriendsState) => state.loading;
export const selectTotalFriends = (state: FriendsState) => state.totalFriends;
export const selectPendingCount = (state: FriendsState) => state.pendingRequestsCount;
```

### 9.3. Reducers

```typescript
export const friendsReducer = createReducer(
  initialState,
  on(
    FriendsActions.LoadFriendsSuccess,
    (state, { friends }) => ({
      ...state,
      friends,
      totalFriends: friends.length,
      loading: false
    })
  ),
  on(
    FriendsActions.SendRequestSuccess,
    (state, { request }) => ({
      ...state,
      requests: [...state.requests, request],
      pendingRequestsCount: state.pendingRequestsCount + 1
    })
  ),
  // More reducers...
);
```

---

## 🚀 PHẦN 10: PERFORMANCE OPTIMIZATIONS

### 10.1. Caching Strategy

```typescript
// Cache friends list
getFriends(): Observable<Friend[]> {
  return this.http.get<Friend[]>(`${this.baseUrl}/friends`, {
    headers: this.getHeaders()
  }).pipe(
    tap(friends => this.cacheService.set('friends', friends, 300000)), // 5 minutes
    startWith(() => {
      const cached = this.cacheService.get('friends');
      return cached ? of(cached) : EMPTY;
    })
  );
}
```

### 10.2. Lazy Loading

```typescript
// Use Intersection Observer for infinite scroll
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      this.loadMoreFriends();
    }
  });
});

observer.observe(document.querySelector('.scroll-trigger'));
```

### 10.3. Request Deduplication

```typescript
// Debounce search input
search(keyword: string) {
  return this.http.get(`${this.baseUrl}/friends/search?keyword=${keyword}`, {
    headers: this.getHeaders()
  }).pipe(
    debounceTime(300),
    distinctUntilChanged()
  );
}
```

---

## 🎨 PHẦN 11: ANIMATIONS & TRANSITIONS

### 11.1. Angular Animations Module

```typescript
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

@NgModule({
  imports: [
    BrowserAnimationsModule,
    // ...
  ],
  exports: [
    BrowserAnimationsModule,
    // ...
  ]
})
export class AppRoutingModule { }
```

### 11.2. Transition Examples

**Friend Card Animation:**
```scss
.friend-card {
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

**Tab Switch Animation:**
```typescript
import { trigger, transition, style, animate } from '@angular/animations';

export const slideIn = trigger('slideIn', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(-20px)' }),
    animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
  ])
]);
```

---

## 🌐 PHẦN 12: WEB SOCKETS (OPTIONAL)

### 12.1. Real-time Updates

```typescript
@Injectable()
export class FriendWebSocketService {
  private socket: WebSocket;
  private messages$ = new Subject<FriendUpdate>();

  connect() {
    this.socket = new WebSocket('wss://api.chatify.asia/ws/friends');
    this.socket.onmessage = (event) => {
      const update = JSON.parse(event.data);
      this.messages$.next(update);
    };
  }

  // Listen for real-time updates
  getUpdates(): Observable<FriendUpdate> {
    return this.messages$.asObservable();
  }

  // Handle new friend request
  onNewRequest(request: FriendRequest) {
    // Show notification badge
    this.notificationService.showFriendRequest(request);
  }
}
```

### 12.2. Notification Integration

```typescript
// Show toast notification for new request
onNewFriendRequest(request: FriendRequest) {
  this.toastService.show(
    `${request.senderFullName} muốn kết bạn với bạn!`,
    'info',
    5000
  );

  // Update notification badge
  this.updateBadge('friends', this.pendingCount + 1);
}
```

---

## 📊 PHẦN 13: ANALYTICS & MONITORING

### 13.1. User Events Tracking

```typescript
// Track user interactions
trackFriendAction(action: string, userId: string) {
  this.analyticsService.trackEvent('friend_interaction', {
    action,
    userId,
    timestamp: new Date().toISOString()
  });
}

// Usage examples:
trackFriendAction('send_request', 'user123');
trackFriendAction('accept_request', 'user456');
trackFriendAction('unfriend', 'user789');
```

### 13.2. Performance Monitoring

```typescript
// Monitor API response times
getFriends(): Observable<Friend[]> {
  const startTime = Date.now();
  return this.http.get<Friend[]>(`${this.baseUrl}/friends`, {
    headers: this.getHeaders()
  }).pipe(
    tap(() => {
      const duration = Date.now() - startTime;
      if (duration > 2000) {
        this.performanceService.logSlowResponse('getFriends', duration);
      }
    })
  );
}
```

---

## 🔒 PHẦN 14: SECURITY CONSIDERATIONS

### 14.1. Input Validation

```typescript
// Validate friend request input
sendFriendRequest(receiverId: string, message?: string) {
  // Validate receiverId
  if (!this.isValidUUID(receiverId)) {
    this.errorService.show('ID người dùng không hợp lệ');
    return EMPTY;
  }

  // Validate message length
  if (message && message.length > 500) {
    this.errorService.show('Tin nhắn quá dài (tối đa 500 ký tự)');
    return EMPTY;
  }

  // Validate message content
  if (message && this.containsProfanity(message)) {
    this.errorService.show('Tin nhắn chứa nội dung không phù hợp');
    return EMPTY;
  }

  // Proceed with valid data
  return this.http.post(/* ... */);
}
```

### 14.2. Rate Limiting

```typescript
// Prevent spam friend requests
sendFriendRequest(receiverId: string, message?: string) {
  const lastRequestTime = localStorage.getItem('lastFriendRequest');
  const cooldown = 60000; // 1 minute

  if (lastRequestTime && Date.now() - parseInt(lastRequestTime) < cooldown) {
    this.errorService.show('Vui lòng đợi 1 phút trước khi gửi lời mời mới');
    return EMPTY;
  }

  localStorage.setItem('lastFriendRequest', Date.now().toString());
  return this.http.post(/* ... */);
}
```

---

## 📱 PHẦN 15: PWA & OFFLINE SUPPORT (OPTIONAL)

### 15.1. Service Worker Setup

```typescript
// Cache friends list for offline access
ngsw-config.json:
{
  "index": "/index.html",
  "assetGroups": [{
    "name": "friends",
    "urls": ["/api/friends/**"],
    "cacheMode": "runtime"
  }]
}
```

### 15.2. Offline UI

```typescript
@Component({
  template: `
    <div *ngIf="!isOnline" class="offline-banner">
      ⚠️ Bạn đang offline. Chức năng kết bạn bè có thể bị hạn chế.
    </div>
    <div class="friends-container">
      <!-- Normal friends UI -->
    </div>
  `
})
export class FriendsComponent {
  isOnline = true;

  constructor(private networkService: NetworkService) {
    this.networkService.online$.subscribe(online => {
      this.isOnline = online;
    });
  }
}
```

---

## 🧪 PHẦN 16: TESTING CHECKLIST

### 16.1. Functional Tests

| Feature | Test Case | Expected Result | Status |
|----------|-----------|----------------|--------|
| Send Friend Request | Thành công khi ID hợp lệ | ⬜ |
| Accept Request | Tự động cập nhật danh sách | ⬜ |
| Reject Request | Xóa khỏi danh sách pending | ⬜ |
| Unfriend | Xóa khỏi danh sách bạn bè | ⬜ |
| Block User | User chuyển sang trạng thái chặn | ⬜ |
| Unblock User | User thoát khỏi trạng thái chặn | ⬜ |
| Get Friends List | Hiển thị danh sách bạn bè | ⬜ |
| Search Users | Hiển thị kết quả tìm kiếm | ⬜ |
| Get Recommendations | Hiển thị gợi ý bạn bè | ⬜ |

### 16.2. Integration Tests

| Flow | Steps | Expected | Status |
|------|-------|---------|--------|
| Complete friend request flow | Send → Accept → Verify | ⬜ |
| Block then unblock | Block → Unblock → Verify | ⬜ |
| Send request to blocked user | Error 403 Forbidden | ⬜ |
| Search with empty keyword | Empty list | ⬜ |
| Rate limiting test | Second request blocked | ⬜ |

### 16.3. Performance Tests

| Metric | Target | Status |
|---------|--------|--------|
| Initial load time | < 2s | ⬜ |
| Tab switch animation | < 300ms | ⬜ |
| Search response time | < 1s | ⬜ |
| Friend card render | < 100ms | ⬜ |
| Infinite scroll | No jank | ⬜ |

---

## 📝 PHẦN 17: DOCUMENTATION

### 17.1. Component Documentation

```typescript
/**
 * FriendsComponent
 *
 * Main component for friend management features
 * Handles displaying friends list, friend requests,
 * find friends, and blocked users.
 *
 * @component
 */
@Component({
  selector: 'app-friends',
  template: './friends.component.html',
  styleUrls: ['./friends.component.scss']
})
export class FriendsComponent {
  // ... implementation
}
```

### 17.2. API Documentation Update

Update `chat-client/README.md`:
```markdown
## Friend Feature

The friend feature allows users to:
- Send friend requests
- Accept/reject friend requests
- View friends list
- Block/unblock users
- Get friend recommendations
- Search for new friends

### API Endpoints
- POST /api/friends/requests/send - Send friend request
- GET /api/friends/requests/received - Get received requests
- GET /api/friends/requests/sent - Get sent requests
- PUT /api/friends/requests/{id}/accept - Accept request
- PUT /api/friends/requests/{id}/reject - Reject request
- DELETE /api/friends/requests/{id} - Cancel request
- GET /api/friends - Get friends list
- DELETE /api/friends/{id} - Unfriend
- POST /api/friends/{id}/block - Block user
- DELETE /api/friends/{id}/block - Unblock user
- GET /api/friends/blocked - Get blocked users
- GET /api/friends/recommendations - Get recommendations
```

---

## 🚀 PHẦN 18: LỘ TRÌNH TRIỂN KHAI (IMPLEMENTATION ROADMAP)

### Phase 1: Foundation (1-2 ngày)

**Tasks:**
- [ ] ✅ Setup friends module structure
- [ ] Create FriendService with all API methods
- [ ] Create data interfaces (Friend, FriendRequest)
- [ ] Setup routing configuration
- [ ] Create base layouts

**Acceptance Criteria:**
- ✅ Module imports successfully
- ✅ Routes accessible via /friends
- ✅ Service injected correctly

### Phase 2: Data Models (1 ngày)

**Tasks:**
- [ ] Create Friend interface
- [ ] Create FriendRequest interface
- [ ] Create User extension interface (if needed)
- [ ] Create BlockedUser interface

**Acceptance Criteria:**
- ✅ All interfaces defined
- ✅ TypeScript compilation successful
- ✅ No type errors

### Phase 3: Service Layer (2 ngày)

**Tasks:**
- [ ] Implement getFriends()
- [ ] Implement sendFriendRequest()
- [ ] Implement getReceivedRequests()
- [ ] Implement getSentRequests()
- [ ] Implement acceptRequest()
- [ ] Implement rejectRequest()
- [ ] Implement cancelRequest()
- [ ] Implement unfriend()
- [ ] Implement blockUser()
- [ ] Implement unblockUser()
- [ ] Implement getBlockedUsers()
- [ ] Implement getRecommendations()

**Acceptance Criteria:**
- ✅ All methods implemented
- ✅ Proper error handling
- ✅ TypeScript compilation successful
- ✅ Services tested with Postman

### Phase 4: Shared Components (2 ngày)

**Tasks:**
- [ ] Create FriendCardComponent
- [ ] Create FriendRequestCardComponent
- [ ] Create UserAvatarComponent
- [ ] Apply Tailwind CSS styling
- [ ] Add responsive design

**Acceptance Criteria:**
- ✅ All components render
- ✅ Proper styling applied
- ✅ Components reusable
- ✅ No console errors

### Phase 5: Feature Components (3-4 ngày)

**Tasks:**
- [ ] Create FriendsComponent with tabs
- [ ] Create FriendRequestsComponent
- [ ] Create FindFriendsComponent
- [ ] Create BlockedUsersComponent
- [ ] Integrate shared components
- [ ] Add loading states
- [ ] Add error handling

**Acceptance Criteria:**
- ✅ All features working
- ✅ Tab navigation functional
- ✅ Data loading correctly
- ✅ Responsive layout

### Phase 6: Navigation & Routing (1 ngày)

**Tasks:**
- [ ] Create FriendsModule
- [ ] Define routes
- [ ] Update app.routes.ts
- [ ] Add navigation menu item
- [ ] Test routing

**Acceptance Criteria:**
- ✅ Routes accessible
- ✅ Lazy loading working
- ✅ Navigation from menu works
- ✅ Back/forward browser buttons work

### Phase 7: Styling & UX (2-3 ngày)

**Tasks:**
- [ ] Apply Tailwind CSS
- [ ] Create responsive layouts
- [ ] Add animations
- [ ] Implement dark mode (optional)
- [ ] Add skeleton loading states
- [ ] Optimize performance

**Acceptance Criteria:**
- ✅ Beautiful UI with Tailwind
- ✅ Responsive on all devices
- ✅ Smooth animations
- ✅ Fast loading
- ✅ Accessibility (ARIA)

### Phase 8: Testing (2-3 ngày)

**Tasks:**
- [ ] Write unit tests for services
- [ ] Write unit tests for components
- [ ] Write integration tests
- [ ] Test with real backend API
- [ ] Performance testing
- [ ] Cross-browser testing

**Acceptance Criteria:**
- ✅ Test coverage > 70%
- ✅ All critical paths tested
- ✅ No console errors
- ✅ Performance metrics good
- ✅ Works on Chrome, Firefox, Safari

### Phase 9: Documentation (1 ngày)

**Tasks:**
- [ ] Update README with friend feature
- [ ] Create component documentation
- [ ] Create user guide
- [ ] Add screenshots/UI mockups
- [ ] Document API integration

**Acceptance Criteria:**
- ✅ Documentation complete
- ✅ Screenshots included
- ✅ Code comments clear
- ✅ User guide available

### Phase 10: Deployment (1 ngày)

**Tasks:**
- [ ] Build production bundle
- [ ] Test on staging environment
- [ ] Deploy to production
- [ ] Monitor for errors
- [ ] Gather user feedback

**Acceptance Criteria:**
- ✅ Production build successful
- ✅ No deployment errors
- ✅ All features working
- ✅ Performance acceptable
- ✅ User testing successful

---

## 📋 CHECKLIST TRƯỚC KHAI BẮT ĐẦU

### Before Starting Development

- [ ] Angular CLI installed
- [ ] Node.js version 16+ installed
- [ ] Tailwind CSS configured
- [ ] Backend API accessible (https://api.chatify.asia)
- [ ] Authentication token available
- [ ] Read backend API documentation

### During Development

- [ ] TypeScript compilation successful
- [ ] No linting errors
- [ ] All components render
- [ ] API calls successful
- [ ] Error handling implemented
- [ ] Loading states visible
- [ ] Responsive design tested

### Before Deployment

- [ ] All tests passing
- [ ] Build bundle size < 500KB (gzipped)
- [ ] No console warnings
- [ ] Performance metrics acceptable
- [ ] Accessibility check passed
- [ ] Cross-browser tested
- [ ] Documentation complete

---

## 🎓 PHẦN 19: BEST PRACTICES & PATTERNS

### 19.1. Code Quality

**Angular Best Practices:**
- ✅ Use OnPush change detection strategy
- ✅ Implement trackByFn for *ngFor loops
- ✅ Use async pipe where appropriate
- ✅ Implement pure functions for business logic
- ✅ Use dependency injection properly
- ✅ Follow SOLID principles

### 19.2. Performance Patterns

**Optimization Techniques:**
- ✅ Lazy loading of modules
- ✅ Virtual scrolling for large lists
- ✅ Image lazy loading
- ✅ Route preloading strategies
- ✅ Memory leak prevention

### 19.3. UX Patterns

**User Experience:**
- ✅ Clear error messages
- ✅ Loading indicators
- ✅ Success confirmations
- ✅ Undo/Redo support
- ✅ Keyboard shortcuts
- ✅ Touch-friendly mobile UI

---

## 🎯 PHẦN 20: METRICS & SUCCESS CRITERIA

### 20.1. Technical Metrics

| Metric | Target | How to Measure |
|---------|--------|---------------|
| Bundle Size | < 2MB (main) | Angular CLI build --prod |
| Initial Load Time | < 2s | Lighthouse / DevTools |
| Time to Interactive | < 3s | Lighthouse / DevTools |
| Lighthouse Performance Score | > 90 | Lighthouse audit |
| Test Coverage | > 70% | Angular CLI test |
| Lint Score | > 8/10 | Angular CLI lint |

### 20.2. User Experience Metrics

| Metric | Target | How to Measure |
|---------|--------|---------------|
| Task Completion Rate | > 95% | User feedback/analytics |
| Error Rate | < 2% | Error monitoring |
| Page Load Time | < 1s (PWA) | DevTools |
| Mobile Usability | > 80% satisfaction | User surveys |
| Feature Adoption | > 60% users | Analytics |

### 20.3. Business Metrics

| Metric | Target | How to Measure |
|---------|--------|---------------|
| Friend Requests Sent | 50+ per month (avg) | Analytics |
| Request Acceptance Rate | > 30% | Analytics |
| Active Friendships | 10+ per user (avg) | Database queries |
| Feature Usage Frequency | Daily/Weekly | Analytics |
| User Retention | > 80% after adding friends | Analytics |

---

## 🚀 GETTING STARTED - QUICK START

### Step 1: Create Module Structure
```bash
cd chat-client/src/app/pages
ng g module friends --routing=true --skip-tests
```

### Step 2: Create Service
```bash
cd chat-client/src/app/services
ng g service friend
```

### Step 3: Create Components
```bash
cd chat-client/src/app/pages/friends
ng g component friends
ng g component friend-requests
ng g component find-friends
ng g component blocked-users
```

### Step 4: Start Development Server
```bash
cd chat-client
ng serve
```

Navigate to: http://localhost:4200/friends

---

## 📞 TROUBLESHOOTING

### Common Issues

**Issue: CORS Errors**
```
Solution: Add API URL to allowed origins in API Gateway
```

**Issue: 401 Unauthorized**
```
Solution: Check token expiration and refresh if needed
```

**Issue: Slow Loading**
```
Solution: Implement pagination and virtual scrolling
```

**Issue: State Not Updating**
```
Solution: Check ChangeDetectionStrategy and use OnPush
```

---

## 🎯 SUCCESS CRITERIA

The Friends feature is considered **SUCCESSFULLY IMPLEMENTED** when:

### Functional Requirements
- ✅ User can send friend requests
- ✅ User can view received requests
- ✅ User can accept/reject requests
- ✅ User can view friends list
- ✅ User can unfriend friends
- ✅ User can block/unblock users
- ✅ User can search for new friends
- ✅ User can view friend recommendations
- ✅ All features work without errors

### Non-Functional Requirements
- ✅ Responsive design (mobile, tablet, desktop)
- ✅ Beautiful and modern UI (Tailwind CSS)
- ✅ Smooth animations and transitions
- ✅ Clear error messages
- ✅ Loading states visible
- ✅ Accessible (keyboard, screen readers)
- ✅ Fast performance (< 2s initial load)
- ✅ Code quality maintained (TypeScript, linting)

### Technical Requirements
- ✅ All TypeScript compiled without errors
- ✅ No console warnings/errors
- ✅ Proper error handling
- ✅ Authentication integrated
- ✅ API calls optimized (caching, debounce)
- ✅ Memory efficient (no leaks)
- ✅ Test coverage > 70%

### Documentation Requirements
- ✅ Code comments where complex
- ✅ Component documentation complete
- ✅ API integration documented
- ✅ User guide available
- ✅ Screenshots/mockups included

---

## 🎉 CONCLUSION

Kế hoạch này cung cấp lộ trình chi tiết để xây dựng **Friend Frontend Feature** cho ứng dụng Chatify. Bắt đầu từ **Phase 1** và tiến từng phase để đảm bảo tính ổn định, chất lượng code và trải nghiệm người dùng tốt nhất.

**Estimated Timeline:** 15-20 ngày
**Complexity:** Medium-High
**Team Size:** 1-2 developers

**Key Success Factors:**
1. ✅ Backend API hoàn thiện và ổn định
2. ✅ Hiểu rõ về Angular architecture
3. ✅ Tuân thủ best practices
4. ✅ Test kỹ lưỡng trước khi deploy
5. ✅ Optimized cho performance
6. ✅ Responsive và accessible
7. ✅ Documentation đầy đủ

**Let's start building! 🚀**

Good luck! 💪

