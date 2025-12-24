package com.chatapp.chat_service.enums;


public enum MessageType {
    TEXT,
    IMAGE,
    VIDEO,
    FILE,
    AUDIO,
    SYSTEM  // [NEW] System messages for group events (member added, removed, etc.)
}