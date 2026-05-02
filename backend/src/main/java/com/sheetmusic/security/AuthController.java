package com.sheetmusic.security;

import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Identity probe used by the SPA to populate its auth context on app load.
 * Returns the current user's username + role when authenticated, or 401
 * when anonymous.
 */
@RestController
public class AuthController {

    public record CurrentUser(String username, String role) {}

    @GetMapping("/api/me")
    public ResponseEntity<CurrentUser> me() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth instanceof AnonymousAuthenticationToken || !auth.isAuthenticated()) {
            return ResponseEntity.status(401).build();
        }
        // Strip Spring's "ROLE_" prefix; the SPA only cares about USER / ADMIN.
        String role = auth.getAuthorities().stream()
                .findFirst()
                .map(a -> a.getAuthority().replace("ROLE_", ""))
                .orElse("USER");
        return ResponseEntity.ok(new CurrentUser(auth.getName(), role));
    }
}
