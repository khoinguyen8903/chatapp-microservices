package com.chatapp.chat_service.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.messaging.converter.DefaultContentTypeResolver;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.converter.MessageConverter;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.util.MimeTypeUtils;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.server.support.HttpSessionHandshakeInterceptor;

import java.net.URI;
import java.util.Base64;
import java.util.List;
import java.util.Map;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/user", "/topic");
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*")
                .addInterceptors(new HttpSessionHandshakeInterceptor() {
                    @Override
                    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler wsHandler, Map<String, Object> attributes) throws Exception {

                        String username = null;

                        // CÁCH 1: Thử lấy từ Header (Do Gateway gửi)
                        // Spring Header keys are case-insensitive
                        if (request.getHeaders().containsKey("X-User-Name")) {
                            username = request.getHeaders().getFirst("X-User-Name");
                            System.out.println("✅ [Handshake] Tìm thấy tên trong Header: " + username);
                        } else if (request.getHeaders().containsKey("x-user-name")) {
                            username = request.getHeaders().getFirst("x-user-name");
                            System.out.println("✅ [Handshake] Tìm thấy tên trong Header (lower): " + username);
                        }

                        // CÁCH 2 (DỰ PHÒNG): Nếu mất Header, lấy từ Token trên URL
                        if (username == null) {
                            try {
                                URI uri = request.getURI();
                                String query = uri.getQuery(); // vd: token=eyJhb...
                                if (query != null && query.contains("token=")) {
                                    String token = null;
                                    for (String param : query.split("&")) {
                                        if (param.startsWith("token=")) {
                                            token = param.substring(6);
                                            break;
                                        }
                                    }

                                    if (token != null) {
                                        // Giải mã JWT Payload (Phần ở giữa 2 dấu chấm)
                                        String[] parts = token.split("\\.");
                                        if (parts.length > 1) {
                                            String payload = new String(Base64.getDecoder().decode(parts[1]));
                                            ObjectMapper mapper = new ObjectMapper();
                                            JsonNode node = mapper.readTree(payload);

                                            // Ưu tiên lấy fullName, nếu không có thì lấy username, rồi đến sub
                                            if (node.has("fullName")) {
                                                username = node.get("fullName").asText();
                                            } else if (node.has("username")) {
                                                username = node.get("username").asText();
                                            } else if (node.has("sub")) {
                                                username = node.get("sub").asText();
                                            }
                                            System.out.println("🔓 [Handshake] Giải mã Token thành công. Tên: " + username);
                                        }
                                    }
                                }
                            } catch (Exception e) {
                                System.err.println("⚠️ [Handshake] Lỗi giải mã Token: " + e.getMessage());
                            }
                        }

                        // CHỐT: Lưu vào Session
                        if (username != null) {
                            attributes.put("username", username);
                        } else {
                            System.out.println("❌ [Handshake] BÓ TAY! Không tìm thấy tên ở đâu cả.");
                            // In toàn bộ Header để debug
                            request.getHeaders().forEach((k, v) -> System.out.println("Header: " + k + " = " + v));
                        }

                        return super.beforeHandshake(request, response, wsHandler, attributes);
                    }
                })
                .withSockJS();
    }

    @Override
    public boolean configureMessageConverters(List<MessageConverter> messageConverters) {
        DefaultContentTypeResolver resolver = new DefaultContentTypeResolver();
        resolver.setDefaultMimeType(MimeTypeUtils.APPLICATION_JSON);
        MappingJackson2MessageConverter converter = new MappingJackson2MessageConverter();
        converter.setObjectMapper(new ObjectMapper());
        converter.setContentTypeResolver(resolver);
        messageConverters.add(converter);
        return false;
    }
}