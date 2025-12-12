package com.chatapp.chat_service.service;

import com.chatapp.chat_service.model.ChatMessage;
import com.chatapp.chat_service.repository.ChatMessageRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class ChatMessageService {

    @Autowired private ChatMessageRepository repository;
    @Autowired private ChatRoomService chatRoomService;

    public ChatMessage save(ChatMessage chatMessage) {
// --- SỬA LỖI TẠI ĐÂY ---
// Nếu tin nhắn đã có chatId (do Controller set cho Chat Nhóm), thì dùng luôn
// Chỉ gọi getChatRoomId nếu chatId đang trống (Chat 1-1 chưa có phòng)
        if (chatMessage.getChatId() == null || chatMessage.getChatId().isEmpty()) {
            var chatId = chatRoomService
                    .getChatRoomId(chatMessage.getSenderId(), chatMessage.getRecipientId(), true)
                    .orElseThrow();
            chatMessage.setChatId(chatId);
        }

        repository.save(chatMessage);
        return chatMessage;
    }

    public List<ChatMessage> findChatMessages(String senderId, String recipientId) {
// Cập nhật logic tìm tin nhắn:
// 1. Kiểm tra xem recipientId có phải là một Group Chat ID không
        var groupRoom = chatRoomService.findByChatId(recipientId);

        if (groupRoom.isPresent() && groupRoom.get().isGroup()) {
// Nếu là nhóm -> Lấy tin nhắn theo ID nhóm
            return repository.findByChatId(recipientId);
        } else {
// Nếu là 1-1 -> Tìm chatId chung rồi lấy tin nhắn
            var chatId = chatRoomService.getChatRoomId(senderId, recipientId, false);
            return chatId.map(repository::findByChatId).orElse(new ArrayList<>());
        }
    }
}