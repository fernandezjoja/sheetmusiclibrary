package com.sheetmusic.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.http.HttpStatus;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
                // CSRF is disabled for /api/** because the session cookie uses
                // SameSite=Lax (default in modern browsers), which prevents
                // cross-origin POSTs from forging requests. If we ever embed
                // the API in a third-party frame or accept cross-origin
                // POSTs, revisit this.
                .csrf(csrf -> csrf.disable())

                // Session-based auth. Cookies are HTTP-only by default
                // (servlet container) and SameSite=Lax by default.
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))

                .authorizeHttpRequests(auth -> auth
                        // Admin-only writes
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        // Auth flow + identity probe — anyone can hit these
                        .requestMatchers("/api/login", "/api/logout", "/api/me").permitAll()
                        // .mscz download is a collaborator-tier perk. Must be
                        // declared *before* the catch-all /api/scores/**
                        // permitAll below, since first-match wins.
                        .requestMatchers("/api/scores/*/mscz").hasAnyRole("COLLABORATOR", "ADMIN")
                        // Public reads (filtered server-side: anonymous see
                        // published-only, authenticated users see all)
                        .requestMatchers("/api/scores", "/api/scores/**").permitAll()
                        // Static SPA, all other paths
                        .anyRequest().permitAll())

                // Form-based login at POST /api/login. Frontend submits
                // application/x-www-form-urlencoded with `username` and
                // `password` fields; success returns 200 with no body, failure
                // returns 401. The session cookie is set by the servlet
                // container.
                .formLogin(form -> form
                        .loginProcessingUrl("/api/login")
                        .successHandler((req, res, auth) -> res.setStatus(200))
                        .failureHandler((req, res, e) -> res.setStatus(401)))

                .logout(logout -> logout
                        .logoutUrl("/api/logout")
                        .logoutSuccessHandler((req, res, auth) -> res.setStatus(200))
                        .invalidateHttpSession(true)
                        .deleteCookies("JSESSIONID"))

                // Protected endpoints with no session return 401 instead of
                // redirecting to a login page (which doesn't exist on the
                // backend; the SPA owns the login UI).
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))

                .build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
