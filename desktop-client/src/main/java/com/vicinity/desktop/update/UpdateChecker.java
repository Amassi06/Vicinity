package com.vicinity.desktop.update;

import com.vicinity.desktop.api.VicinityApiClient;
import com.vicinity.desktop.api.dto.VersionInfo;
import javafx.application.Platform;
import javafx.concurrent.Task;
import javafx.scene.control.Alert;
import javafx.scene.control.ButtonType;

/**
 * Vérification automatique de mise à jour au démarrage, via le serveur
 * central (GET /desktop/latest-version). Le téléchargement reste manuel
 * (un clic sur "Télécharger" ouvre le navigateur) — pas de remplacement
 * silencieux du .jar en cours d'exécution.
 */
public final class UpdateChecker {

    public static final String CURRENT_VERSION = "1.0.0";

    private UpdateChecker() {}

    public static void checkAndNotify(final VicinityApiClient api) {
        final Task<VersionInfo> task =
                new Task<>() {
                    @Override
                    protected VersionInfo call() throws Exception {
                        return api.getLatestVersion();
                    }
                };
        task.setOnSucceeded(
                ev -> {
                    final VersionInfo info = task.getValue();
                    if (info != null && isNewer(info.version(), CURRENT_VERSION)) {
                        notifyUpdate(info);
                    }
                });
        // échec silencieux (hors-ligne, etc.) — la vérification est automatique mais non bloquante
        Thread.ofVirtual().start(task);
    }

    static boolean isNewer(final String remote, final String current) {
        final int[] r = parse(remote);
        final int[] c = parse(current);
        for (int i = 0; i < 3; i++) {
            if (r[i] != c[i]) {
                return r[i] > c[i];
            }
        }
        return false;
    }

    private static int[] parse(final String version) {
        final int[] out = {0, 0, 0};
        if (version == null) {
            return out;
        }
        final String[] parts = version.trim().split("\\.");
        for (int i = 0; i < Math.min(3, parts.length); i++) {
            try {
                out[i] = Integer.parseInt(parts[i].replaceAll("[^0-9]", ""));
            } catch (NumberFormatException ignored) {
                out[i] = 0;
            }
        }
        return out;
    }

    private static void notifyUpdate(final VersionInfo info) {
        Platform.runLater(
                () -> {
                    final Alert alert = new Alert(Alert.AlertType.INFORMATION);
                    alert.setTitle("Mise à jour disponible");
                    alert.setHeaderText("Vicinity " + info.version() + " est disponible");
                    alert.setContentText(
                            "Version installée : " + CURRENT_VERSION + "\nTélécharger la nouvelle version ?");
                    final ButtonType download = new ButtonType("Télécharger");
                    alert.getButtonTypes().setAll(download, ButtonType.CANCEL);
                    alert.showAndWait()
                            .filter(bt -> bt == download)
                            .ifPresent(bt -> openInBrowser(info.downloadUrl()));
                });
    }

    private static void openInBrowser(final String url) {
        try {
            if (java.awt.Desktop.isDesktopSupported()) {
                java.awt.Desktop.getDesktop().browse(java.net.URI.create(url));
            }
        } catch (Exception ignored) {
            // best effort
        }
    }
}
