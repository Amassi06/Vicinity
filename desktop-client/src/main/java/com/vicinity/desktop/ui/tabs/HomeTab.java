package com.vicinity.desktop.ui.tabs;

import com.vicinity.desktop.api.VicinityApiClient;
import com.vicinity.desktop.api.dto.Neighbourhood;
import com.vicinity.desktop.api.dto.Stats;
import com.vicinity.desktop.config.DesktopConfig;
import com.vicinity.desktop.session.AppSession;
import com.vicinity.desktop.store.LocalStore;
import javafx.collections.FXCollections;
import javafx.concurrent.Task;
import javafx.geometry.Insets;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.TextArea;
import javafx.scene.layout.GridPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;
import javafx.util.StringConverter;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

public final class HomeTab extends VBox {

    private final VicinityApiClient api;
    private final Label userLine = new Label();
    private final Label modeLine = new Label();
    private final Label cacheLine = new Label();
    private final Label cacheCountLine = new Label();
    private final Label syncStateLine = new Label();
    private final TextArea healthArea = new TextArea();
    private final ComboBox<Neighbourhood> neighbourhoodBox = new ComboBox<>();
    private final Label statsListings = new Label("—");
    private final Label statsEvents = new Label("—");
    private final Label statsPolls = new Label("—");
    private final Label statsIncidents = new Label("—");
    private final Label statsOpenIncidents = new Label("—");

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
        cacheCountLine.getStyleClass().add("label-muted");
        syncStateLine.getStyleClass().add("label-muted");

        final GridPane stats = new GridPane();
        stats.getStyleClass().add("stats-grid");
        stats.setHgap(14);
        stats.setVgap(8);
        stats.add(new Label("Statistiques locales"), 0, 0, 2, 1);
        stats.add(new Label("Quartiers en cache"), 0, 1);
        stats.add(cacheCountLine, 1, 1);
        stats.add(new Label("Dernier sync"), 0, 2);
        stats.add(cacheLine, 1, 2);
        stats.add(new Label("État"), 0, 3);
        stats.add(syncStateLine, 1, 3);
        stats.getStyleClass().add("panel");
        stats.setPadding(new Insets(12));

        healthArea.setEditable(false);
        healthArea.setWrapText(true);
        healthArea.getStyleClass().add("text-area-mono");
        healthArea.setPrefRowCount(10);

        final Button probeBtn = new Button("Tester l’API (healthz / readyz)");
        probeBtn.getStyleClass().add("button-secondary");
        probeBtn.setOnAction(e -> probeHealth(probeBtn));

        neighbourhoodBox.setConverter(
                new StringConverter<>() {
                    @Override
                    public String toString(final Neighbourhood n) {
                        return n == null ? "" : n.name();
                    }

                    @Override
                    public Neighbourhood fromString(final String s) {
                        return null;
                    }
                });
        neighbourhoodBox.setPrefWidth(220);
        neighbourhoodBox.setItems(FXCollections.observableArrayList(LocalStore.loadNeighbourhoods()));
        neighbourhoodBox.valueProperty().addListener((obs, old, selected) -> {
            if (selected != null) {
                AppSession.setSelectedNeighbourhoodId(selected.id());
                refreshParticipationStats(selected.id());
            }
        });

        final GridPane participation = new GridPane();
        participation.getStyleClass().addAll("stats-grid", "panel");
        participation.setHgap(14);
        participation.setVgap(8);
        participation.setPadding(new Insets(12));
        participation.add(new Label("Statistiques de participation"), 0, 0, 2, 1);
        participation.add(new Label("Annonces"), 0, 1);
        participation.add(statsListings, 1, 1);
        participation.add(new Label("Événements"), 0, 2);
        participation.add(statsEvents, 1, 2);
        participation.add(new Label("Sondages"), 0, 3);
        participation.add(statsPolls, 1, 3);
        participation.add(new Label("Incidents"), 0, 4);
        participation.add(statsIncidents, 1, 4);
        participation.add(new Label("Incidents ouverts"), 0, 5);
        participation.add(statsOpenIncidents, 1, 5);

        final HBox participationHeader = new HBox(10, new Label("Quartier :"), neighbourhoodBox);

        getChildren()
                .addAll(
                        title,
                        userLine,
                        modeLine,
                        stats,
                        participationHeader,
                        participation,
                        probeBtn,
                        healthArea);
    }

    private void refreshParticipationStats(final String neighbourhoodId) {
        LocalStore.loadStats(neighbourhoodId).ifPresent(this::showStats);
        if (AppSession.isOffline()) {
            return;
        }
        final Task<Stats> task =
                new Task<>() {
                    @Override
                    protected Stats call() throws Exception {
                        return api.getStats(neighbourhoodId);
                    }
                };
        task.setOnSucceeded(
                ev -> {
                    LocalStore.saveStats(neighbourhoodId, task.getValue());
                    showStats(task.getValue());
                });
        Thread.ofVirtual().start(task);
    }

    private void showStats(final Stats s) {
        statsListings.setText(String.valueOf(s.listings()));
        statsEvents.setText(String.valueOf(s.events()));
        statsPolls.setText(String.valueOf(s.polls()));
        statsIncidents.setText(String.valueOf(s.incidents()));
        statsOpenIncidents.setText(String.valueOf(s.openIncidents()));
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
        final var cached = LocalStore.loadNeighbourhoods();
        cacheCountLine.setText(cached.size() + " quartier(s)");
        neighbourhoodBox.setItems(FXCollections.observableArrayList(cached));
        final String selectedId = AppSession.selectedNeighbourhoodId();
        cached.stream()
                .filter(n -> n.id().equals(selectedId))
                .findFirst()
                .or(() -> cached.stream().findFirst())
                .ifPresent(n -> {
                    if (!n.equals(neighbourhoodBox.getValue())) {
                        neighbourhoodBox.setValue(n);
                    }
                });
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
        syncStateLine.setText(AppSession.isOffline() ? "Hors ligne" : "Connecté");
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
