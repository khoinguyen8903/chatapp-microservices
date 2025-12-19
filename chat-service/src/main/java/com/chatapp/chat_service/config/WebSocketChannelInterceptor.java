package com.chatapp.chat_service.config;

import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

/**
 * Interceptor to capture HTTP headers during WebSocket handshake
 * and store them in the session attributes for later use in message handlers.
 */
@Component
public class WebSocketChannelInterceptor implements ChannelInterceptor {

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        
        if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {
            // During CONNECT command, capture the X-User-Name header from the HTTP upgrade request
            String userName = accessor.getFirstNativeHeader("X-User-Name");
            
            if (userName != null && !userName.trim().isEmpty()) {
                // Store it in session attributes so it's available in all subsequent messages
                accessor.getSessionAttributes().put("X-User-Name", userName);
                System.out.println("🔗 [WebSocket] Captured X-User-Name from handshake: " + userName);
            } else {
                System.out.println("⚠️ [WebSocket] X-User-Name header not found during handshake");
            }
        }
        
        return message;
    }
}
