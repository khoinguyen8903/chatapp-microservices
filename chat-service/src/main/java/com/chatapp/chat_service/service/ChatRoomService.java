package com.chatapp.chat_service.service;

import com.chatapp.chat_service.model.ChatRoom;
import com.chatapp.chat_service.repository.ChatRoomRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class ChatRoomService {

    @Autowired private ChatRoomRepository chatRoomRepository;

    public Optional<String> getChatRoomId(String senderId, String recipientId, boolean createNewRoomIfNotExists) {
        return chatRoomRepository
                .findBySenderIdAndRecipientId(senderId, recipientId)
                .map(ChatRoom::getChatId)
                .or(() -> {
                    if(!createNewRoomIfNotExists) {
                        return Optional.empty();
                    }
                    var chatId = String.format("%s_%s", senderId, recipientId);

                    // Lưu 2 bản ghi: A->B và B->A để dễ truy vấn cho cả 2 người
                    ChatRoom senderRecipient = ChatRoom.builder().chatId(chatId).senderId(senderId).recipientId(recipientId).build();
                    ChatRoom recipientSender = ChatRoom.builder().chatId(chatId).senderId(recipientId).recipientId(senderId).build();

                    chatRoomRepository.save(senderRecipient);
                    chatRoomRepository.save(recipientSender);

                    return Optional.of(chatId);
                });
    }
}