package com.sheetmusic.user;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Seeds an initial admin user on first boot so a fresh deployment has a way
 * in. Reads {@code app.admin.username} / {@code app.admin.password} from env
 * vars (the same vars that previously fed the in-memory admin user).
 *
 * <p>Idempotent: only runs the insert when no ADMIN-role user exists in the
 * DB. Subsequent boots are no-ops, which means changing
 * {@code ADMIN_PASSWORD} on the deployment platform will <em>not</em> rotate
 * the password — that's a deliberate "production password lives in the
 * users table once the system is live, not in env vars" stance. To rotate,
 * the admin updates their own password through the user management API
 * (or, in a pinch, deletes the row in psql and re-deploys).
 */
@Component
public class AdminBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);

    private final UserRepository repo;
    private final PasswordEncoder encoder;
    private final String adminUsername;
    private final String adminPassword;

    public AdminBootstrap(
            UserRepository repo,
            PasswordEncoder encoder,
            @Value("${app.admin.username}") String adminUsername,
            @Value("${app.admin.password}") String adminPassword) {
        this.repo = repo;
        this.encoder = encoder;
        this.adminUsername = adminUsername;
        this.adminPassword = adminPassword;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (repo.existsByRole(UserRole.ADMIN)) {
            return;
        }
        if (adminPassword == null || adminPassword.isBlank()) {
            log.warn("No ADMIN user exists and ADMIN_PASSWORD is not set — admin login disabled until one is created.");
            return;
        }
        User admin = new User();
        admin.setUsername(adminUsername);
        admin.setPasswordHash(encoder.encode(adminPassword));
        admin.setRole(UserRole.ADMIN);
        repo.save(admin);
        log.info("Bootstrap admin user '{}' created from env vars.", adminUsername);
    }
}
