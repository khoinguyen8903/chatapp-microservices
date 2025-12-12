package com.chatapp.chat_service.service;

import com.chatapp.chat_service.model.ChatRoom;
import com.chatapp.chat_service.repository.ChatRoomRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ChatRoomService {

    @Autowired private ChatRoomRepository chatRoomRepository;

    // 1. Logic Chat 1-1 (Đã cập nhật để lưu thêm memberIds)
    public Optional<String> getChatRoomId(String senderId, String recipientId, boolean createNewRoomIfNotExists) {
        return chatRoomRepository
                .findBySenderIdAndRecipientId(senderId, recipientId)
                .map(ChatRoom::getChatId)
                .or(() -> {
                    if(!createNewRoomIfNotExists) {
                        return Optional.empty();
                    }
                    var chatId = String.format("%s_%s", senderId, recipientId);

                    // Khi tạo phòng 1-1, ta cũng thêm memberIds vào để đồng bộ
                    List<String> members = Arrays.asList(senderId, recipientId);

                    ChatRoom senderRecipient = ChatRoom.builder()
                            .chatId(chatId)
                            .senderId(senderId)
                            .recipientId(recipientId)
                            .memberIds(members) // Lưu thành viên
                            .isGroup(false)
                            .build();

                    ChatRoom recipientSender = ChatRoom.builder()
                            .chatId(chatId)
                            .senderId(recipientId)
                            .recipientId(senderId)
                            .memberIds(members) // Lưu thành viên
                            .isGroup(false)
                            .build();

                    chatRoomRepository.save(senderRecipient);
                    chatRoomRepository.save(recipientSender);

                    return Optional.of(chatId);
                });
    }

    // 2. Logic Chat Nhóm (MỚI)
    public ChatRoom createGroupChat(String adminId, String groupName, List<String> memberIds) {
        String chatId = UUID.randomUUID().toString();

        // Đảm bảo admin cũng có trong danh sách thành viên nếu chưa có
        if (!memberIds.contains(adminId)) {
            // Tạo list mới để tránh lỗi UnsupportedOperationException nếu list đầu vào là immutable
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

    // 3. Lấy danh sách phòng (Gộp cả 1-1 cũ và Group mới)
    public List<ChatRoom> getChatRooms(String userId) {
        // A. Lấy các phòng 1-1 (nơi userId là sender)
        List<ChatRoom> privateRooms = chatRoomRepository.findBySenderId(userId);

        // B. Lấy các phòng Nhóm mà user tham gia
        // (Lọc chỉ lấy isGroup=true để tránh trùng với privateRooms nếu logic save bị lặp)
        List<ChatRoom> groupRooms = chatRoomRepository.findByMemberIdsContaining(userId)
                .stream()
                .filter(ChatRoom::isGroup)
                .collect(Collectors.toList());

        // C. Gộp lại
        List<ChatRoom> allRooms = new ArrayList<>(privateRooms);
        allRooms.addAll(groupRooms);

        return allRooms;
    }

    // Helper tìm phòng theo ChatId
    public Optional<ChatRoom> findByChatId(String chatId) {
        return chatRoomRepository.findByChatId(chatId);
    }
}