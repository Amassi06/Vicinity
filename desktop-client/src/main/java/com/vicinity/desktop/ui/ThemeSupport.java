package com.vicinity.desktop.ui;

import com.vicinity.desktop.store.LocalStore;
import javafx.scene.Scene;

public final class ThemeSupport {

    public static final String LIGHT = "light";
    public static final String DARK = "dark";

    private ThemeSupport() {}

    public static String currentTheme() {
        return normalize(LocalStore.loadThemeMode());
    }

    public static void apply(final Scene scene, final String theme) {
        if (scene == null) {
            return;
        }
        final String normalized = normalize(theme);
        scene.getStylesheets().clear();
        scene.getStylesheets().add(resource("/styles.css"));
        if (DARK.equals(normalized)) {
            scene.getStylesheets().add(resource("/styles-dark.css"));
        }
        LocalStore.saveThemeMode(normalized);
    }

    public static String toggle(final Scene scene) {
        final String next = DARK.equals(currentTheme()) ? LIGHT : DARK;
        apply(scene, next);
        return next;
    }

    /** Couleur d'accent personnalisée (persistée), appliquée via une variable CSS JavaFX. */
    public static void applyAccentColor(final Scene scene, final String hexColor) {
        LocalStore.saveSetting("accent_color", hexColor);
        if (scene == null || scene.getRoot() == null) {
            return;
        }
        scene.getRoot().setStyle(mergeStyle(scene.getRoot().getStyle(), "-fx-accent", hexColor));
    }

    /** Taille de police relative (0.8 à 1.4), persistée, appliquée à la racine de la scène. */
    public static void applyFontScale(final Scene scene, final double scale) {
        LocalStore.saveSetting("font_scale", Double.toString(scale));
        if (scene == null || scene.getRoot() == null) {
            return;
        }
        final double basePx = 13.0 * scale;
        scene.getRoot()
                .setStyle(mergeStyle(scene.getRoot().getStyle(), "-fx-font-size", basePx + "px"));
    }

    private static String mergeStyle(final String existing, final String property, final String value) {
        final StringBuilder sb = new StringBuilder();
        if (existing != null) {
            for (final String rule : existing.split(";")) {
                if (rule.isBlank() || rule.trim().startsWith(property)) {
                    continue;
                }
                sb.append(rule.trim()).append("; ");
            }
        }
        sb.append(property).append(": ").append(value).append(";");
        return sb.toString();
    }

    private static String normalize(final String theme) {
        return DARK.equalsIgnoreCase(theme) ? DARK : LIGHT;
    }

    private static String resource(final String path) {
        final var url = ThemeSupport.class.getResource(path);
        if (url == null) {
            throw new IllegalStateException("Ressource CSS introuvable: " + path);
        }
        return url.toExternalForm();
    }
}