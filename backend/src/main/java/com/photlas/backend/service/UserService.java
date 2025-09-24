package com.photlas.backend.service;

import com.photlas.backend.dto.RegisterRequest;
import com.photlas.backend.dto.RegisterResponse;
import com.photlas.backend.entity.User;
import com.photlas.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private JavaMailSender mailSender;

    public RegisterResponse registerUser(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Email already exists");
        }

        String hashedPassword = passwordEncoder.encode(request.getPassword());

        User user = new User(
            request.getUsername(),
            request.getEmail(),
            hashedPassword,
            "USER"
        );

        user = userRepository.save(user);

        String token = jwtService.generateToken(user.getEmail());

        sendWelcomeEmail(user.getEmail(), user.getUsername());

        return new RegisterResponse(
            new RegisterResponse.UserResponse(user),
            token
        );
    }

    private void sendWelcomeEmail(String email, String username) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(email);
            message.setSubject("Welcome to Photlas!");
            message.setText("Hello " + username + ",\n\n" +
                           "Welcome to Photlas! Your account has been successfully created.\n\n" +
                           "You can now start exploring and sharing your favorite photography spots.\n\n" +
                           "Best regards,\n" +
                           "The Photlas Team");

            mailSender.send(message);
        } catch (Exception e) {
            // Log the error but don't fail registration
            System.err.println("Failed to send welcome email: " + e.getMessage());
        }
    }
}