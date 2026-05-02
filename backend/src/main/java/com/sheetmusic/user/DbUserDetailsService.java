package com.sheetmusic.user;

import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

/**
 * Loads users from the {@code users} table for Spring Security.
 * Replaces the in-memory single-admin {@code UserDetailsService} that was
 * here in Phase 4 / Phase 8. The bootstrap component creates the initial
 * admin row from env vars on first boot if no admin exists.
 */
@Service
public class DbUserDetailsService implements UserDetailsService {

    private final UserRepository repo;

    public DbUserDetailsService(UserRepository repo) {
        this.repo = repo;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User u = repo.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));
        return org.springframework.security.core.userdetails.User
                .withUsername(u.getUsername())
                .password(u.getPasswordHash())
                .authorities(new SimpleGrantedAuthority("ROLE_" + u.getRole().name()))
                .build();
    }
}
