// src/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// 1. Khởi tạo Firebase App trong Service Worker
firebase.initializeApp({
  apiKey: "AIzaSyB19z3A6pmOYL1eCisMcjCBGOjRNCYAy-0",
  authDomain: "chat-app-25e3f.firebaseapp.com",
  projectId: "chat-app-25e3f",
  storageBucket: "chat-app-25e3f.firebasestorage.app",
  messagingSenderId: "21864381306",
  appId: "1:21864381306:web:f25d9d3e87e23fa06f74c3",
  measurementId: "G-ZGMV0QH6CR"
});

// 2. Khởi tạo Messaging để nhận thông báo background
const messaging = firebase.messaging();

// 3. Xử lý sự kiện khi nhận tin nhắn nền (Optional - Firebase tự làm, nhưng thêm để debug)
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Đã nhận tin nhắn nền:', payload);
  
  // [QUAN TRỌNG] Để tránh thông báo 2 lần và hiện đúng tên:
  // Backend phải gửi payload chỉ có 'data', KHÔNG có 'notification'.
  
  // Kiểm tra an toàn: Nếu payload không có data thì khởi tạo rỗng
  const data = payload.data || {};

  // Backend Java gửi: .putData("title", senderName) và .putData("body", messageContent)
  // Vì là Data Message nên notification sẽ null, ta lấy trực tiếp từ data
  const notificationTitle = data.title || 'Tin nhắn mới';
  const notificationBody = data.body || 'Bạn có tin nhắn mới';
  
  const notificationOptions = {
    body: notificationBody,
    //icon: '/assets/icons/icon-72x72.png',
    data: data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});