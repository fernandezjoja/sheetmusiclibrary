package com.sheetmusic.web;

import java.io.IOException;

import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

/**
 * In production the React build is bundled into the Spring Boot JAR under
 * {@code classpath:/static/}. This configures a resource handler that serves
 * those files for any path *not* matched by an {@code @RestController} —
 * which means {@code /api/**} keeps hitting our REST endpoints, and
 * everything else either serves a real static file (e.g. {@code /assets/...})
 * or falls back to {@code index.html} so React Router can take over for SPA
 * routes like {@code /biblioteca}, {@code /scores/3}, {@code /admin/upload},
 * etc.
 *
 * <p>If the {@code static/} directory is empty (as in dev where the frontend
 * runs on Vite at :5173), this is a no-op — the resource handler simply
 * never finds anything to serve, including {@code index.html}, and requests
 * naturally 404. Vite's dev proxy handles routing for the dev workflow.
 */
@Configuration
public class StaticResourceConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/**")
                .addResourceLocations("classpath:/static/")
                .resourceChain(true)
                .addResolver(new SpaResourceResolver());
    }

    /**
     * Resolves any request to either the matching static file or — if no
     * such file exists — the SPA's {@code index.html}. This is the standard
     * Spring Boot + SPA pattern.
     */
    private static class SpaResourceResolver extends PathResourceResolver {
        @Override
        protected Resource getResource(String resourcePath, Resource location)
                throws IOException {
            Resource resource = location.createRelative(resourcePath);
            if (resource.exists() && resource.isReadable()) {
                return resource;
            }
            // Fall back to index.html so React Router handles the route.
            Resource indexHtml = location.createRelative("index.html");
            return (indexHtml.exists() && indexHtml.isReadable()) ? indexHtml : null;
        }
    }
}
