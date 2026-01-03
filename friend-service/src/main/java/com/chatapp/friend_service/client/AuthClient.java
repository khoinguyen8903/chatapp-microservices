package com.chatapp.friend_service.client;

import com.chatapp.friend_service.dto.UserDTO;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@FeignClient(name = "auth-service", url = "${auth-service.url}")
public interface AuthClient {

    @GetMapping("/api/users/{userId}")
    AuthUserResponse getUserById(@PathVariable("userId") String userId);

    class AuthUserResponse {
        private String id;
        private String username;
        private String fullName;
        private String avatarUrl;

        public AuthUserResponse() {}

        public AuthUserResponse(String id, String username, String fullName, String avatarUrl) {
            this.id = id;
            this.username = username;
            this.fullName = fullName;
            this.avatarUrl = avatarUrl;
        }

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }

        public String getUsername() { return username; }
        public void setUsername(String username) { this.username = username; }

        public String getFullName() { return fullName; }
        public void setFullName(String fullName) { this.fullName = fullName; }

        public String getAvatarUrl() { return avatarUrl; }
        public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }

        public UserDTO toUserDTO() {
            return UserDTO.builder()
                    .id(id)
                    .username(username)
                    .fullName(fullName)
                    .avatarUrl(avatarUrl)
                    .build();
        }
    }
}

