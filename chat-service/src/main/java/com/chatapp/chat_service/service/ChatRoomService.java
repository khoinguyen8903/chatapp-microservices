package com.chatapp.chat_service.service;

import com.chatapp.chat_service.client.UserClient;
import com.chatapp.chat_service.dto.UserDTO;
import com.chatapp.chat_service.model.ChatRoom;
import com.chatapp.chat_service.repository.ChatMessageRepository;
import com.chatapp.chat_service.repository.ChatRoomRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class ChatRoomService {

    @Autowired private ChatRoomRepository chatRoomRepository;
    @Autowired private ChatMessageRepository chatMessageRepository;
    @Autowired private UserClient userClient;

    /**
     * 1. Lấy hoặc Tạo ChatId cho chat 1-1
     * Đảm bảo chỉ có DUY NHẤT 1 bản ghi cho mỗi cặp người dùng nhờ logic sắp xếp ID
     */
    public Optional<String> getChatRoomId(String senderId, String recipientId, boolean createIfNotExist) {
        // [QUAN TRỌNG] Sắp xếp ID để chatId luôn nhất quán (Vd: id1 < id2 thì id1_id2)
        String[] ids = {senderId, recipientId};
        Arrays.sort(ids);
        String chatId = String.format("%s_%s", ids[0], ids[1]);

        return chatRoomRepository.findByChatId(chatId)
                .map(ChatRoom::getChatId)
                .or(() -> {
                    if (!createIfNotExist) return Optional.empty();

                    ChatRoom newRoom = ChatRoom.builder()
                            .chatId(chatId)
                            .senderId(senderId)     // Người khởi tạo
                            .recipientId(recipientId) // Người nhận
                            .memberIds(Arrays.asList(senderId, recipientId))
                            .isGroup(false)
                            .build();

                    try {
                        // Lưu duy nhất 1 bản ghi. Unique Index trên DB sẽ bảo vệ nếu có race condition
                        chatRoomRepository.save(newRoom);
                        System.out.println("✅ [ChatRoomService] Created unique 1-1 room: " + chatId);
                        return Optional.of(chatId);
                    } catch (Exception e) {
                        // Nếu lỡ có tiến trình khác vừa tạo xong (Duplicate Key), ta lấy cái đã có
                        return chatRoomRepository.findByChatId(chatId).map(ChatRoom::getChatId);
                    }
                });
    }

    /**
     * 2. Tạo phòng Chat Nhóm
     */
    public ChatRoom createGroupChat(String adminId, String groupName, List<String> memberIds) {
        String chatId = UUID.randomUUID().toString();

        if (!memberIds.contains(adminId)) {
            memberIds = new ArrayList<>(memberIds);
            memberIds.add(adminId);
        }

        ChatRoom groupRoom = ChatRoom.builder()
                .chatId(chatId)
                .adminId(adminId)
                .groupName(groupName)
                .isGroup(true)
                .memberIds(memberIds)
                .build();

        return chatRoomRepository.save(groupRoom);
    }

    /**
     * 3. Lấy tất cả danh sách phòng của User (Cả 1-1 và Group)
     */
    public List<ChatRoom> getChatRooms(String userId) {
        // Tìm tất cả các phòng mà danh sách memberIds có chứa userId này
        List<ChatRoom> allRooms = chatRoomRepository.findByMemberIdsContaining(userId);

        // Tính toán số tin nhắn chưa đọc cho từng phòng
        for (ChatRoom room : allRooms) {
            int unread = calculateUnreadCount(room.getChatId(), userId);
            room.setUnreadCount(unread);
        }

        // Sắp xếp theo thời gian tin nhắn mới nhất (nếu có)
        allRooms.sort((a, b) -> {
            if (a.getLastMessageTimestamp() == null || b.getLastMessageTimestamp() == null) return 0;
            return b.getLastMessageTimestamp().compareTo(a.getLastMessageTimestamp());
        });

        return allRooms;
    }

    /**
     * 4. Tính số tin nhắn chưa đọc
     * [FIXED] Use precise queries that only count SENT or DELIVERED messages
     * This prevents counting old messages with null status or other unexpected statuses
     * CRITICAL FIX: For private chats, now ensures senderId != recipientId to avoid counting own messages
     */
    private int calculateUnreadCount(String chatId, String userId) {
        // Check if this is a group chat or 1-1 chat
        Optional<ChatRoom> roomOpt = chatRoomRepository.findByChatId(chatId);
        
        if (roomOpt.isEmpty()) {
            System.out.println("⚠️ [ChatRoomService] calculateUnreadCount - ChatId not found: " + chatId);
            return 0;
        }
        
        ChatRoom room = roomOpt.get();
        long count;
        
        if (room.isGroup()) {
            // For GROUP chat: Count messages NOT sent by userId with status = SENT or DELIVERED
            count = chatMessageRepository.countUnreadMessagesInGroup(chatId, userId);
            System.out.println("📊 [ChatRoomService] GROUP " + chatId + " - User " + userId + 
                               " has " + count + " unread messages (SENT/DELIVERED, NOT from self)");
        } else {
            // For 1-1 chat: Count messages where recipientId == userId AND senderId != userId 
            // with status = SENT or DELIVERED
            count = chatMessageRepository.countUnreadMessagesForRecipient(chatId, userId);
            System.out.println("💬 [ChatRoomService] PRIVATE Chat " + chatId + " - User " + userId + 
                               " has " + count + " unread messages (SENT/DELIVERED, TO user, NOT FROM user)");
        }
        
        return (int) count;
    }

    /**
     * 5. Tìm phòng theo ChatId
     */
    public Optional<ChatRoom> findByChatId(String chatId) {
        // Bây giờ chỉ có 1 bản ghi duy nhất cho mỗi chatId
        return chatRoomRepository.findByChatId(chatId);
    }

    /**
     * 6. Cập nhật tin nhắn cuối cùng (Dùng cho cả 1-1 và Group)
     */
    public void updateChatRoomLastMessage(String chatId, String lastMessage, Date timestamp) {
        chatRoomRepository.findByChatId(chatId).ifPresent(room -> {
            room.setLastMessage(lastMessage);
            room.setLastMessageTimestamp(timestamp);
            chatRoomRepository.save(room);
            System.out.println("📤 [ChatRoomService] Updated last message for: " + chatId);
        });
    }
    
    /**
     * 7. Cập nhật ChatRoom entity (Generic update method)
     */
    public ChatRoom updateChatRoom(ChatRoom chatRoom) {
        return chatRoomRepository.save(chatRoom);
    }

    // =============================================
    // MUTE NOTIFICATIONS METHODS
    // =============================================

    /**
     * Check if notifications are muted for a user in a room.
     * Works for both group chats (by chatId) and private chats (by partnerId).
     */
    public boolean isMuted(String roomIdOrPartnerId, String userId) {
        // First try to find by exact chatId (works for group chats)
        Optional<ChatRoom> roomOpt = chatRoomRepository.findByChatId(roomIdOrPartnerId);
        
        if (roomOpt.isEmpty()) {
            // For private chats, roomIdOrPartnerId might be the partner's ID
            // Try to find the room by looking for a private chat between these users
            List<ChatRoom> rooms = chatRoomRepository.findByMemberIdsContaining(userId);
            roomOpt = rooms.stream()
                    .filter(r -> !r.isGroup())
                    .filter(r -> r.getMemberIds() != null && r.getMemberIds().contains(roomIdOrPartnerId))
                    .findFirst();
        }
        
        if (roomOpt.isEmpty()) {
            return false;
        }
        
        ChatRoom room = roomOpt.get();
        if (room.getMuteSettings() == null) {
            return false;
        }
        
        return room.getMuteSettings().getOrDefault(userId, false);
    }

    /**
     * Toggle mute status for a user in a room.
     * Returns the new mute state (true = muted, false = unmuted).
     */
    public boolean toggleMute(String roomIdOrPartnerId, String userId) {
        // First try to find by exact chatId (works for group chats)
        Optional<ChatRoom> roomOpt = chatRoomRepository.findByChatId(roomIdOrPartnerId);
        
        if (roomOpt.isEmpty()) {
            // For private chats, roomIdOrPartnerId might be the partner's ID
            List<ChatRoom> rooms = chatRoomRepository.findByMemberIdsContaining(userId);
            roomOpt = rooms.stream()
                    .filter(r -> !r.isGroup())
                    .filter(r -> r.getMemberIds() != null && r.getMemberIds().contains(roomIdOrPartnerId))
                    .findFirst();
        }
        
        if (roomOpt.isEmpty()) {
            throw new RuntimeException("Room not found: " + roomIdOrPartnerId);
        }
        
        ChatRoom room = roomOpt.get();
        
        if (room.getMuteSettings() == null) {
            room.setMuteSettings(new HashMap<>());
        }
        
        // Toggle the current state
        boolean currentState = room.getMuteSettings().getOrDefault(userId, false);
        boolean newState = !currentState;
        
        room.getMuteSettings().put(userId, newState);
        chatRoomRepository.save(room);
        
        System.out.println("🔔 [ChatRoomService] Mute toggled for user " + userId + 
                          " in room " + room.getChatId() + ": " + (newState ? "MUTED" : "UNMUTED"));
        
        return newState;
    }

    /**
     * Check if notifications should be suppressed for a recipient.
     * Used by NotificationService before sending push notifications.
     */
    public boolean shouldSuppressNotification(String chatId, String recipientId) {
        Optional<ChatRoom> roomOpt = chatRoomRepository.findByChatId(chatId);
        
        if (roomOpt.isEmpty()) {
            return false;
        }
        
        ChatRoom room = roomOpt.get();
        if (room.getMuteSettings() == null) {
            return false;
        }
        
        boolean muted = room.getMuteSettings().getOrDefault(recipientId, false);
        
        if (muted) {
            System.out.println("🔕 [ChatRoomService] Suppressing notification for muted user: " + recipientId);
        }
        
        return muted;
    }

    // =============================================
    // GROUP MEMBERS METHODS
    // =============================================

    /**
     * Get group members with their user information (username, avatarUrl).
     * Fetches user details from auth-service via Feign client.
     */
    public List<Map<String, Object>> getGroupMembersWithInfo(String groupId) {
        List<Map<String, Object>> members = new ArrayList<>();
        
        Optional<ChatRoom> roomOpt = chatRoomRepository.findByChatId(groupId);
        
        if (roomOpt.isEmpty()) {
            System.out.println("⚠️ [ChatRoomService] Group not found: " + groupId);
            return members;
        }
        
        ChatRoom room = roomOpt.get();
        
        if (!room.isGroup()) {
            System.out.println("⚠️ [ChatRoomService] Room is not a group: " + groupId);
            return members;
        }
        
        List<String> memberIds = room.getMemberIds();
        if (memberIds == null || memberIds.isEmpty()) {
            System.out.println("⚠️ [ChatRoomService] Group has no members: " + groupId);
            return members;
        }
        
        System.out.println("👥 [ChatRoomService] Fetching info for " + memberIds.size() + " members");
        
        for (String memberId : memberIds) {
            try {
                UserDTO user = userClient.getUserById(memberId);
                
                Map<String, Object> memberInfo = new HashMap<>();
                memberInfo.put("id", memberId);
                memberInfo.put("username", user != null ? user.getUsername() : "Unknown");
                memberInfo.put("fullName", user != null ? user.getFullName() : null);
                memberInfo.put("avatarUrl", user != null ? user.getAvatarUrl() : null);
                
                members.add(memberInfo);
                
                System.out.println("  ✅ Loaded member: " + (user != null ? user.getUsername() : memberId));
            } catch (Exception e) {
                // If user service is unavailable, add minimal info
                System.err.println("  ❌ Error fetching user " + memberId + ": " + e.getMessage());
                
                Map<String, Object> memberInfo = new HashMap<>();
                memberInfo.put("id", memberId);
                memberInfo.put("username", "User " + memberId.substring(0, Math.min(8, memberId.length())));
                memberInfo.put("fullName", null);
                memberInfo.put("avatarUrl", null);
                
                members.add(memberInfo);
            }
        }
        
        return members;
    }
}