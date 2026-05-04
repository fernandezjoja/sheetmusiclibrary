package com.sheetmusic.security;

import java.util.Optional;

import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;

import com.sheetmusic.user.UserRole;

/**
 * Per-request capability flags derived from the current {@link Authentication}.
 * Read once at the controller entrypoint and passed down — avoids each layer
 * re-parsing roles out of the security context.
 *
 * <p>Anonymous (no auth, or {@link AnonymousAuthenticationToken}) yields
 * everything-false. Unknown authority strings are ignored — only the first
 * authority that starts with {@code ROLE_} and parses as a {@link UserRole}
 * counts. This matches how {@code DbUserDetailsService} emits authorities
 * (one {@code ROLE_<NAME>} per user).
 */
public record Permissions(
        boolean canSeeUnpublished,
        boolean canSeeReferences,
        boolean canDownloadMscz,
        boolean isAdmin) {

    public static Permissions from(Authentication auth) {
        Optional<UserRole> role = roleOf(auth);
        boolean atLeastUser = role.map(r -> r.atLeast(UserRole.USER)).orElse(false);
        boolean atLeastCollaborator = role.map(r -> r.atLeast(UserRole.COLLABORATOR)).orElse(false);
        boolean isAdmin = role.map(r -> r == UserRole.ADMIN).orElse(false);
        return new Permissions(atLeastUser, atLeastCollaborator, atLeastCollaborator, isAdmin);
    }

    private static Optional<UserRole> roleOf(Authentication auth) {
        if (auth == null
                || auth instanceof AnonymousAuthenticationToken
                || !auth.isAuthenticated()) {
            return Optional.empty();
        }
        for (GrantedAuthority authority : auth.getAuthorities()) {
            String s = authority.getAuthority();
            if (s != null && s.startsWith("ROLE_")) {
                try {
                    return Optional.of(UserRole.valueOf(s.substring("ROLE_".length())));
                } catch (IllegalArgumentException ignored) {
                    // Authority string isn't one of our enum values — keep looking.
                }
            }
        }
        return Optional.empty();
    }
}
