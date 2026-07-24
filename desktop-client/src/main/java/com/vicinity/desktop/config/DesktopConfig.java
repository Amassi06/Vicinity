package com.vicinity.desktop.config;

import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Properties;

/**
 * Configuration locale (URL API). Fichier : {@code ~/.vicinity/config.properties}.
 */
public final class DesktopConfig {

    private static final String PROP_API_URL = "api.url";
    private static final String DEFAULT_API_URL = "https://api-vicinity.aimassi.dev";

    private final String apiBaseUrl;

    private DesktopConfig(final String apiBaseUrl) {
        this.apiBaseUrl = apiBaseUrl.endsWith("/")
                ? apiBaseUrl.substring(0, apiBaseUrl.length() - 1)
                : apiBaseUrl;
    }

    public static DesktopConfig load() {
        final Properties props = new Properties();
        final Path configPath = configFilePath();
        try {
            if (Files.isRegularFile(configPath)) {
                try (var in = Files.newInputStream(configPath)) {
                    props.load(in);
                }
            }
        } catch (Exception ignored) {
            // garde les défauts
        }
        final String fromFile = props.getProperty(PROP_API_URL, "").trim();
        final String fromJvm = System.getProperty("api-vicinity.aimassi.dev", "").trim();
        final String base =
                !fromJvm.isEmpty() ? fromJvm : !fromFile.isEmpty() ? fromFile : DEFAULT_API_URL;
        return new DesktopConfig(normalizeBaseUrl(base));
    }

    private static String normalizeBaseUrl(String raw) {
        String url = raw.trim();
        if (url.isEmpty()) {
            return DEFAULT_API_URL;
        }
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            url = "http://" + url;
        }
        return url;
    }

    /** Ports Vite (web) — pas l’API Express. */
    public boolean looksLikeWebDevServer() {
        return apiBaseUrl.contains(":5173") || apiBaseUrl.contains(":5174");
    }

    public static Path configFilePath() {
        return Path.of(System.getProperty("user.home"), ".vicinity", "config.properties");
    }

    public String apiBaseUrl() {
        return apiBaseUrl;
    }

    public URI resolve(final String path) {
        final String normalized = path.startsWith("/") ? path : "/" + path;
        return URI.create(apiBaseUrl + normalized);
    }
}
