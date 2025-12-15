package com.chatapp.chat_service.controller;

import com.chatapp.chat_service.model.CallMessage;
import com.chatapp.chat_service.model.ChatRoom;
import com.chatapp.chat_service.service.ChatRoomService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.util.Optional;

@Controller
public class CallController {

    @Autowired private SimpMessagingTemplate messagingTemplate;
    @Autowired private ChatRoomService chatRoomService;

    // Frontend sẽ gửi tín hiệu vào: /app/call
    @MessageMapping("/call")
    public void handleCallSignal(@Payload CallMessage message) {

        // --- LOGIC GỌI NHÓM (GROUP CALL) ---
        if (message.isGroup()) {
            Optional<ChatRoom> groupRoom = chatRoomService.findByChatId(message.getRecipientId());

            if (groupRoom.isPresent()) {
                ChatRoom room = groupRoom.get();
                // Gửi tín hiệu cho TẤT CẢ thành viên trong nhóm (Trừ người gửi)
                for (String memberId : room.getMemberIds()) {
                    if (!memberId.equals(message.getSenderId())) {
                        messagingTemplate.convertAndSend(
                                "/topic/call/" + memberId,
                                message
                        );
                    }
                }
            }
        }

        // --- LOGIC GỌI 1-1 (P2P) ---
        else {
            // Chuyển tiếp thẳng tín hiệu đến người nhận
            // Người nhận lắng nghe tại: /topic/call/{userId}
            messagingTemplate.convertAndSend(
                    "/topic/call/" + message.getRecipientId(),
                    message
            );
        }
    }
}