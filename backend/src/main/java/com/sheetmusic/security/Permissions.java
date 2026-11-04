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
 *
 * <p>Roles are not ranked, so each role's flags are listed explicitly:
 * <pre>
 *                access  unpublished  pdf  references  mscz  admin
 * anonymous        -         -         -       -        -     -
 * CORO             x         -         x       -        -     -
 * PRUEBA           x         x         -       -        -     -
 * DEPARTAMENTO     x         x         x       x        x     -
 * ADMIN            x         x         x       x        x     x
 * </pre>
 * "access" covers published scores, MusicXML playback and recordings.
 */
public record Permissions(
        boolean canAccessMusic,
        boolean canSeeUnpublished,
        boolean canSeeReferences,
        boolean canDownloadMscz,
        boolean canDownloadPdf,
        boolean isAdmin) {

    private static final Permissions NONE = new Permissions(false, false, false, false, false, false);

    public static Permissions from(Authentication auth) {
        return roleOf(auth).map(Permissions::forRole).orElse(NONE);
    }

    private static Permissions forRole(UserRole role) {
        return switch (role) {
            case CORO -> new Permissions(true, false, false, false, true, false);
            case PRUEBA -> new Permissions(true, true, false, false, false, false);
            case DEPARTAMENTO -> new Permissions(true, true, true, true, true, false);
            case ADMIN -> new Permissions(true, true, true, true, true, true);
        };
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
