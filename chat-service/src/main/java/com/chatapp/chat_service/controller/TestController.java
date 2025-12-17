package com.chatapp.chat_service.controller;


import com.chatapp.chat_service.model.ChatMessage;
import com.chatapp.chat_service.service.ChatMessageService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Date;

@RestController
@RequestMapping("/test")
public class TestController {

    @Autowired
    private ChatMessageService chatMessageService;

    //  giả lập UserA nhắn cho UserB
    @PostMapping("/trigger")
    public String triggerChat() {
        ChatMessage msg = new ChatMessage();
        msg.setSenderId("UserA");
        msg.setRecipientId("UserB");
        msg.setContent("Alo, đây là tin nhắn test từ Backend!");
        msg.setTimestamp(new Date());

        chatMessageService.save(msg);

        return "Đã giả lập gửi tin nhắn thành công!";
    }
}
