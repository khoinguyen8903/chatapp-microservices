package com.chatapp.auth_service.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String fromEmail;

    @Value("${app.verification-url}")
    private String verificationBaseUrl;

    public EmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    @Async
    public void sendVerificationEmail(String toEmail, String token, String username) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromEmail);
            message.setTo(toEmail);
            message.setSubject("Chatify - Email Verification");
            
            String verificationLink = verificationBaseUrl + "?token=" + token;
            
            System.out.println("📧 Generating verification email for: " + username);
            System.out.println("   Verification link: " + verificationLink);
            
            String emailBody = String.format(
                "Hello %s,\n\n" +
                "Welcome to Chatify! Please verify your email address by clicking the link below:\n\n" +
                "%s\n\n" +
                "This link will expire in 24 hours.\n\n" +
                "If you didn't create an account with Chatify, please ignore this email.\n\n" +
                "Best regards,\n" +
                "Chatify Team",
                username,
                verificationLink
            );
            
            message.setText(emailBody);
            mailSender.send(message);
            
            System.out.println("✅ Verification email sent successfully to: " + toEmail);
        } catch (Exception e) {
            System.err.println("❌ Failed to send verification email to: " + toEmail);
            System.err.println("   Error: " + e.getMessage());
            e.printStackTrace();
        }
    }

    @Async
    public void sendWelcomeEmail(String toEmail, String username) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromEmail);
            message.setTo(toEmail);
            message.setSubject("Welcome to Chatify!");
            
            String emailBody = String.format(
                "Hello %s,\n\n" +
                "Your email has been successfully verified!\n\n" +
                "You can now enjoy all the features of Chatify:\n" +
                "- Send messages to friends\n" +
                "- Create group chats\n" +
                "- Share media files\n" +
                "- Make voice/video calls\n\n" +
                "Start chatting now!\n\n" +
                "Best regards,\n" +
                "Chatify Team",
                username
            );
            
            message.setText(emailBody);
            mailSender.send(message);
            
            System.out.println("✅ Welcome email sent to: " + toEmail);
        } catch (Exception e) {
            System.err.println("❌ Failed to send welcome email to: " + toEmail);
            e.printStackTrace();
        }
    }
}

