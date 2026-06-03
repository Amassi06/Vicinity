package com.vicinity.desktop.ui.tabs;

import com.vicinity.desktop.api.VicinityApiClient;
import com.vicinity.desktop.config.DesktopConfig;
import com.vicinity.desktop.session.AppSession;
import com.vicinity.desktop.store.LocalStore;
import javafx.geometry.Insets;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TextArea;
import javafx.scene.layout.VBox;
import javafx.concurrent.Task;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

public final class HomeTab extends VBox {

    private final VicinityApiClient api;
    private final Label userLine = new Label();
    private final Label modeLine = new Label();
    private final Label cacheLine = new Label();
    private final TextArea healthArea = new TextArea();

    public HomeTab(final VicinityApiClient api) {
        this.api = api;
        getStyleClass().add("panel");
        setSpacing(12);
        setPadding(new Insets(16));
        build();
        refreshStatic();
    }

    private void build() {
        final Label title = new Label("Tableau de bord");
        title.getStyleClass().add("label-title");

        modeLine.getStyleClass().add("label-muted");
        userLine.getStyleClass().add("label-muted");
        cacheLine.getStyleClass().add("label-muted");

        healthArea.setEditable(false);
        healthArea.setWrapText(true);
        healthArea.getStyleClass().add("text-area-mono");
        healthArea.setPrefRowCount(10);

        final Button probeBtn = new Button("Tester l’API (healthz / readyz)");
        probeBtn.getStyleClass().add("button-secondary");
        probeBtn.setOnAction(e -> probeHealth(probeBtn));

        getChildren().addAll(title, userLine, modeLine, cacheLine, probeBtn, healthArea);
    }

    public void refreshStatic() {
        final var user = AppSession.user();
        if (user != null) {
            userLine.setText("Utilisateur : " + user.email() + " — rôle " + user.role());
        }
        modeLine.setText(
                AppSession.isOffline()
                        ? "Mode : hors ligne (cache local)"
                        : "Mode : en ligne");
        final DesktopConfig cfg = api.config();
        LocalStore.lastNeighbourhoodSync()
                .ifPresentOrElse(
                        instant ->
                                cacheLine.setText(
                                        "Dernier sync quartiers : "
                                                + DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")
                                                        .withZone(ZoneId.systemDefault())
                                                        .format(instant)
                                                + " — "
                                                + cfg.apiBaseUrl()),
                        () -> cacheLine.setText("Aucun quartier en cache — API : " + cfg.apiBaseUrl()));
    }

    private void probeHealth(final Button btn) {
        btn.setDisable(true);
        healthArea.setText("Interrogation…");
        final Task<String> task =
                new Task<>() {
                    @Override
                    protected String call() throws Exception {
                        final var hz = api.healthz();
                        final var rz = api.readyz();
                        return "GET /healthz\n" + hz + "\n\nGET /readyz\n" + rz;
                    }
                };
        task.setOnSucceeded(
                ev -> {
                    healthArea.setText(task.getValue());
                    btn.setDisable(false);
                });
        task.setOnFailed(
                ev -> {
                    final Throwable err = task.getException();
                    healthArea.setText(
                            "Échec : "
                                    + (err == null
                                            ? "inconnu"
                                            : err.getMessage() == null
                                                    ? err.getClass().getSimpleName()
                                                    : err.getMessage()));
                    btn.setDisable(false);
                });
        Thread.ofVirtual().start(task);
    }
}
