package com.chatapp.chat_service.service;

import com.chatapp.chat_service.client.UserClient;
import com.chatapp.chat_service.dto.UserDTO;
import com.chatapp.chat_service.enums.MessageStatus;
import com.chatapp.chat_service.enums.MessageType;
import com.chatapp.chat_service.model.ChatMessage;
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
                .adminId(adminId)  // Keep for backward compatibility
                .ownerId(adminId)  // [NEW] Set ownerId when creating group
                .groupName(groupName)
                .isGroup(true)
                .memberIds(memberIds)
                .adminIds(new ArrayList<>())  // [NEW] Initialize empty admin list
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

    // =============================================
    // ROLE MANAGEMENT METHODS
    // =============================================

    /**
     * Get user's role in a group room.
     * Returns: 'OWNER', 'ADMIN', or 'MEMBER'
     */
    public String getRole(String roomId, String userId) {
        Optional<ChatRoom> roomOpt = chatRoomRepository.findByChatId(roomId);
        
        if (roomOpt.isEmpty()) {
            throw new RuntimeException("Room not found: " + roomId);
        }
        
        ChatRoom room = roomOpt.get();
        
        if (!room.isGroup()) {
            throw new RuntimeException("Room is not a group: " + roomId);
        }
        
        // Check if user is owner
        String ownerId = room.getOwnerId() != null ? room.getOwnerId() : room.getAdminId(); // Fallback to adminId for backward compatibility
        if (ownerId != null && ownerId.equals(userId)) {
            return "OWNER";
        }
        
        // Check if user is admin
        if (room.getAdminIds() != null && room.getAdminIds().contains(userId)) {
            return "ADMIN";
        }
        
        // Default to member
        return "MEMBER";
    }

    /**
     * Promote or demote a user to/from admin role.
     * Only OWNER can perform this action.
     */
    public ChatRoom promoteOrDemoteAdmin(String roomId, String currentUserId, String targetUserId, String action) {
        Optional<ChatRoom> roomOpt = chatRoomRepository.findByChatId(roomId);
        
        if (roomOpt.isEmpty()) {
            throw new RuntimeException("Room not found: " + roomId);
        }
        
        ChatRoom room = roomOpt.get();
        
        if (!room.isGroup()) {
            throw new RuntimeException("Room is not a group: " + roomId);
        }
        
        // Check permission: Only OWNER can promote/demote
        String currentRole = getRole(roomId, currentUserId);
        if (!"OWNER".equals(currentRole)) {
            throw new RuntimeException("Only OWNER can promote/demote admins");
        }
        
        // Ensure target user is a member
        if (room.getMemberIds() == null || !room.getMemberIds().contains(targetUserId)) {
            throw new RuntimeException("Target user is not a member of this group");
        }
        
        // Cannot promote/demote owner
        String ownerId = room.getOwnerId() != null ? room.getOwnerId() : room.getAdminId();
        if (ownerId != null && ownerId.equals(targetUserId)) {
            throw new RuntimeException("Cannot promote/demote the owner");
        }
        
        // Initialize adminIds if null
        if (room.getAdminIds() == null) {
            room.setAdminIds(new ArrayList<>());
        }
        
        if ("PROMOTE".equals(action)) {
            // Add to admin list if not already admin
            if (!room.getAdminIds().contains(targetUserId)) {
                room.getAdminIds().add(targetUserId);
                System.out.println("✅ [ChatRoomService] Promoted user " + targetUserId + " to ADMIN in room " + roomId);
            }
        } else if ("DEMOTE".equals(action)) {
            // Remove from admin list
            room.getAdminIds().remove(targetUserId);
            System.out.println("✅ [ChatRoomService] Demoted user " + targetUserId + " from ADMIN in room " + roomId);
        } else {
            throw new RuntimeException("Invalid action: " + action + ". Must be 'PROMOTE' or 'DEMOTE'");
        }
        
        return chatRoomRepository.save(room);
    }

    /**
     * Kick a member from the group.
     * Permission matrix:
     * - OWNER: Can kick ADMIN and MEMBER
     * - ADMIN: Can kick MEMBER only
     * - MEMBER: Cannot kick anyone
     * 
     * Creates a system message before removing the user.
     * Returns a Map with the updated room and system message.
     */
    public Map<String, Object> kickMember(String roomId, String currentUserId, String targetUserId) {
        Optional<ChatRoom> roomOpt = chatRoomRepository.findByChatId(roomId);
        
        if (roomOpt.isEmpty()) {
            throw new RuntimeException("Room not found: " + roomId);
        }
        
        ChatRoom room = roomOpt.get();
        
        if (!room.isGroup()) {
            throw new RuntimeException("Room is not a group: " + roomId);
        }
        
        // Check permission
        String currentRole = getRole(roomId, currentUserId);
        String targetRole = getRole(roomId, targetUserId);
        
        if ("MEMBER".equals(currentRole)) {
            throw new RuntimeException("Members cannot kick other users");
        }
        
        // Cannot kick owner
        String ownerId = room.getOwnerId() != null ? room.getOwnerId() : room.getAdminId();
        if (ownerId != null && ownerId.equals(targetUserId)) {
            throw new RuntimeException("Cannot kick the owner");
        }
        
        // ADMIN can only kick MEMBER
        if ("ADMIN".equals(currentRole) && !"MEMBER".equals(targetRole)) {
            throw new RuntimeException("Admins can only kick members");
        }
        
        // [NEW] Create system message BEFORE removing user (so they can see it)
        // Personal message for the kicked user: "Bạn đã bị mời ra khỏi nhóm"
        ChatMessage systemMessage = null;
        try {
            // Create personalized message for the kicked user
            String systemMessageContent = "Bạn đã bị mời ra khỏi nhóm";
            
            systemMessage = ChatMessage.builder()
                    .chatId(roomId)
                    .senderId("SYSTEM")
                    .recipientId(roomId)
                    .content(systemMessageContent)
                    .type(MessageType.SYSTEM)
                    .status(MessageStatus.SEEN) // System messages are always "seen"
                    .timestamp(new Date())
                    .build();
            
            systemMessage = chatMessageRepository.save(systemMessage);
            System.out.println("📢 [ChatRoomService] Created system message for kicked user: " + systemMessageContent);
        } catch (Exception e) {
            System.err.println("⚠️ [ChatRoomService] Failed to create system message: " + e.getMessage());
            // Continue with kick even if system message fails
        }
        
        // Remove from memberIds
        if (room.getMemberIds() != null) {
            room.getMemberIds().remove(targetUserId);
        }
        
        // Remove from adminIds if they were an admin
        if (room.getAdminIds() != null) {
            room.getAdminIds().remove(targetUserId);
        }
        
        ChatRoom updatedRoom = chatRoomRepository.save(room);
        System.out.println("✅ [ChatRoomService] Kicked user " + targetUserId + " from room " + roomId);
        
        // Return both room and system message
        Map<String, Object> result = new HashMap<>();
        result.put("room", updatedRoom);
        result.put("systemMessage", systemMessage);
        return result;
    }

    /**
     * Leave the group.
     * Constraint: OWNER cannot leave. They must delete the group or transfer ownership first.
     */
    public ChatRoom leaveGroup(String roomId, String userId) {
        Optional<ChatRoom> roomOpt = chatRoomRepository.findByChatId(roomId);
        
        if (roomOpt.isEmpty()) {
            throw new RuntimeException("Room not found: " + roomId);
        }
        
        ChatRoom room = roomOpt.get();
        
        if (!room.isGroup()) {
            throw new RuntimeException("Room is not a group: " + roomId);
        }
        
        // Check if user is owner
        String currentRole = getRole(roomId, userId);
        if ("OWNER".equals(currentRole)) {
            throw new RuntimeException("Owner cannot leave the group. Please delete the group or transfer ownership first.");
        }
        
        // Remove from memberIds
        if (room.getMemberIds() != null) {
            room.getMemberIds().remove(userId);
        }
        
        // Remove from adminIds if they were an admin
        if (room.getAdminIds() != null) {
            room.getAdminIds().remove(userId);
        }
        
        System.out.println("✅ [ChatRoomService] User " + userId + " left room " + roomId);
        return chatRoomRepository.save(room);
    }

    /**
     * Delete the group.
     * Only OWNER can delete.
     * This will hard delete the room and all associated messages.
     */
    public void deleteGroup(String roomId, String userId) {
        Optional<ChatRoom> roomOpt = chatRoomRepository.findByChatId(roomId);
        
        if (roomOpt.isEmpty()) {
            throw new RuntimeException("Room not found: " + roomId);
        }
        
        ChatRoom room = roomOpt.get();
        
        if (!room.isGroup()) {
            throw new RuntimeException("Room is not a group: " + roomId);
        }
        
        // Check permission: Only OWNER can delete
        String currentRole = getRole(roomId, userId);
        if (!"OWNER".equals(currentRole)) {
            throw new RuntimeException("Only OWNER can delete the group");
        }
        
        // Delete all messages in this room
        chatMessageRepository.deleteByChatId(roomId);
        System.out.println("🗑️ [ChatRoomService] Deleted all messages for room " + roomId);
        
        // Delete the room
        chatRoomRepository.delete(room);
        System.out.println("🗑️ [ChatRoomService] Deleted group room " + roomId);
    }

    /**
     * Add members to a group.
     * Only OWNER or ADMIN can add members.
     * Creates a system message and returns the updated room with system message info.
     */
    public Map<String, Object> addMembers(String roomId, String currentUserId, List<String> newUserIds) {
        Optional<ChatRoom> roomOpt = chatRoomRepository.findByChatId(roomId);
        
        if (roomOpt.isEmpty()) {
            throw new RuntimeException("Room not found: " + roomId);
        }
        
        ChatRoom room = roomOpt.get();
        
        if (!room.isGroup()) {
            throw new RuntimeException("Room is not a group: " + roomId);
        }
        
        // Check permission: Only OWNER or ADMIN can add members
        String currentRole = getRole(roomId, currentUserId);
        if (!"OWNER".equals(currentRole) && !"ADMIN".equals(currentRole)) {
            throw new RuntimeException("Only OWNER or ADMIN can add members");
        }
        
        // Filter out users who are already members
        List<String> existingMemberIds = room.getMemberIds() != null ? room.getMemberIds() : new ArrayList<>();
        List<String> usersToAdd = new ArrayList<>();
        for (String userId : newUserIds) {
            if (!existingMemberIds.contains(userId)) {
                usersToAdd.add(userId);
            }
        }
        
        if (usersToAdd.isEmpty()) {
            throw new RuntimeException("All users are already members of this group");
        }
        
        // Add new members
        if (room.getMemberIds() == null) {
            room.setMemberIds(new ArrayList<>());
        }
        room.getMemberIds().addAll(usersToAdd);
        
        // Save updated room
        ChatRoom updatedRoom = chatRoomRepository.save(room);
        
        // [NEW] Create system message
        ChatMessage systemMessage = null;
        try {
            // Get current user name
            String currentUserName = "Admin";
            try {
                UserDTO currentUser = userClient.getUserById(currentUserId);
                if (currentUser != null && currentUser.getUsername() != null) {
                    currentUserName = currentUser.getUsername();
                }
            } catch (Exception e) {
                System.err.println("⚠️ [ChatRoomService] Could not fetch current user name: " + e.getMessage());
            }
            
            // Get new member names
            List<String> newMemberNames = new ArrayList<>();
            for (String userId : usersToAdd) {
                try {
                    UserDTO user = userClient.getUserById(userId);
                    if (user != null && user.getUsername() != null) {
                        newMemberNames.add(user.getUsername());
                    } else {
                        newMemberNames.add("User " + userId.substring(0, Math.min(8, userId.length())));
                    }
                } catch (Exception e) {
                    newMemberNames.add("User " + userId.substring(0, Math.min(8, userId.length())));
                }
            }
            
            String membersList = String.join(", ", newMemberNames);
            String systemMessageContent = currentUserName + " đã thêm " + membersList + " vào nhóm";
            
            systemMessage = ChatMessage.builder()
                    .chatId(roomId)
                    .senderId("SYSTEM")
                    .recipientId(roomId)
                    .content(systemMessageContent)
                    .type(MessageType.SYSTEM)
                    .status(MessageStatus.SEEN)
                    .timestamp(new Date())
                    .build();
            
            systemMessage = chatMessageRepository.save(systemMessage);
            System.out.println("📢 [ChatRoomService] Created system message for add members: " + systemMessageContent);
        } catch (Exception e) {
            System.err.println("⚠️ [ChatRoomService] Failed to create system message: " + e.getMessage());
            // Continue even if system message fails
        }
        
        // Return result with system message
        Map<String, Object> result = new HashMap<>();
        result.put("room", updatedRoom);
        result.put("systemMessage", systemMessage);
        result.put("addedUserIds", usersToAdd);
        
        return result;
    }
}