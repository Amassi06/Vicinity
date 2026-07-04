package com.vicinity.desktop.ui.tabs;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vicinity.desktop.api.VicinityApiClient;
import com.vicinity.desktop.api.dto.EventItem;
import com.vicinity.desktop.session.AppSession;
import com.vicinity.desktop.store.LocalStore;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import javafx.concurrent.Task;
import javafx.geometry.Insets;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TextArea;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;
import javafx.stage.FileChooser;

/**
 * Gestion des plugins Vicinity : registre API (existant) + trois actions
 * locales concrètes demandées par le sujet (export stats, analyse sociale,
 * calendrier local). Pas de widget calendrier dédié : une liste triée
 * suffit, proportionnée au périmètre.
 */
public final class PluginsTab extends VBox {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final VicinityApiClient api;
    private final TextArea output = new TextArea();
    private final TextArea actionOutput = new TextArea();

    public PluginsTab(final VicinityApiClient api) {
        this.api = api;
        getStyleClass().add("panel");
        setPadding(new Insets(16));
        output.setEditable(false);
        output.setPrefRowCount(10);

        actionOutput.setEditable(false);
        actionOutput.setPrefRowCount(10);
        actionOutput.getStyleClass().add("text-area-mono");

        final Button exportBtn = new Button("Exporter les statistiques");
        exportBtn.getStyleClass().add("button-secondary");
        exportBtn.setOnAction(e -> exportStats());

        final Button socialBtn = new Button("Analyse sociale (recommandations)");
        socialBtn.getStyleClass().add("button-secondary");
        socialBtn.setOnAction(e -> socialAnalysis());

        final Button calendarBtn = new Button("Calendrier local");
        calendarBtn.getStyleClass().add("button-secondary");
        calendarBtn.setOnAction(e -> localCalendar());

        final HBox actions = new HBox(10, exportBtn, socialBtn, calendarBtn);

        getChildren()
                .addAll(
                        new Label("Plugins enregistrés (API)"),
                        output,
                        new Label("Plugins locaux"),
                        actions,
                        actionOutput);
        refresh();
    }

    private void refresh() {
        final Task<String> task =
                new Task<>() {
                    @Override
                    protected String call() throws Exception {
                        return api.getPluginsCatalog().toPrettyString();
                    }
                };
        task.setOnSucceeded(ev -> output.setText(task.getValue()));
        task.setOnFailed(
                ev -> output.setText(task.getException() == null ? "Erreur" : task.getException().getMessage()));
        Thread.ofVirtual().start(task);
    }

    private String requireNeighbourhoodId() {
        final String id = AppSession.selectedNeighbourhoodId();
        if (id == null) {
            actionOutput.setText("Sélectionnez d'abord un quartier (onglet Accueil ou Incidents).");
        }
        return id;
    }

    private void exportStats() {
        final String neighbourhoodId = requireNeighbourhoodId();
        if (neighbourhoodId == null) {
            return;
        }
        final var stats = LocalStore.loadStats(neighbourhoodId);
        if (stats.isEmpty()) {
            actionOutput.setText("Aucune statistique en cache pour ce quartier.");
            return;
        }
        final FileChooser chooser = new FileChooser();
        chooser.setInitialFileName("vicinity-stats-" + neighbourhoodId + ".json");
        chooser.getExtensionFilters().add(new FileChooser.ExtensionFilter("JSON", "*.json"));
        final File file = chooser.showSaveDialog(getScene() == null ? null : getScene().getWindow());
        if (file == null) {
            return;
        }
        try {
            Files.writeString(
                    Path.of(file.toURI()), MAPPER.writerWithDefaultPrettyPrinter().writeValueAsString(stats.get()));
            actionOutput.setText("Export écrit dans " + file.getAbsolutePath());
        } catch (Exception e) {
            actionOutput.setText("Échec de l'export : " + e.getMessage());
        }
    }

    private void socialAnalysis() {
        final String neighbourhoodId = requireNeighbourhoodId();
        if (neighbourhoodId == null) {
            return;
        }
        final Task<List<EventItem>> task =
                new Task<>() {
                    @Override
                    protected List<EventItem> call() throws Exception {
                        return api.getRecommendations(neighbourhoodId);
                    }
                };
        task.setOnSucceeded(
                ev -> {
                    final StringBuilder sb = new StringBuilder("Événements recommandés (Neo4j) :\n");
                    for (final EventItem it : task.getValue()) {
                        sb.append(" - ").append(it.title()).append('\n');
                    }
                    actionOutput.setText(sb.toString());
                });
        task.setOnFailed(
                ev -> actionOutput.setText(
                        "Échec : " + (task.getException() == null ? "inconnu" : task.getException().getMessage())));
        Thread.ofVirtual().start(task);
    }

    private void localCalendar() {
        final String neighbourhoodId = requireNeighbourhoodId();
        if (neighbourhoodId == null) {
            return;
        }
        final Task<List<EventItem>> task =
                new Task<>() {
                    @Override
                    protected List<EventItem> call() throws Exception {
                        return api.listEvents(neighbourhoodId);
                    }
                };
        task.setOnSucceeded(
                ev -> {
                    final List<EventItem> items = task.getValue();
                    items.sort(Comparator.comparing(EventItem::startsAt));
                    final StringBuilder sb = new StringBuilder("Calendrier local :\n");
                    for (final EventItem it : items) {
                        sb.append(" - ").append(formatInstant(it.startsAt())).append(" — ").append(it.title())
                                .append('\n');
                    }
                    actionOutput.setText(sb.toString());
                });
        task.setOnFailed(
                ev -> actionOutput.setText(
                        "Échec : " + (task.getException() == null ? "inconnu" : task.getException().getMessage())));
        Thread.ofVirtual().start(task);
    }

    private static String formatInstant(final String iso) {
        try {
            return DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")
                    .withZone(ZoneId.systemDefault())
                    .format(java.time.Instant.parse(iso));
        } catch (Exception e) {
            return iso;
        }
    }
}
