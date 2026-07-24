package com.vicinity.desktop.ui.tabs;

import com.vicinity.desktop.api.ApiException;
import com.vicinity.desktop.api.VicinityApiClient;
import com.vicinity.desktop.api.dto.Incident;
import com.vicinity.desktop.api.dto.Neighbourhood;
import com.vicinity.desktop.session.AppSession;
import com.vicinity.desktop.store.LocalStore;
import javafx.beans.property.SimpleStringProperty;
import javafx.collections.FXCollections;
import javafx.concurrent.Task;
import javafx.geometry.Insets;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.TableColumn;
import javafx.scene.control.TableView;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;
import javafx.util.StringConverter;
import java.util.List;

/**
 * Gestion des incidents/alertes signalés par les résidents sur le web.
 * Consultation et changement de statut fonctionnent hors-ligne sur le cache
 * H2 ; les changements de statut effectués hors-ligne sont mis en file
 * (incident_outbox) et rejoués par SyncService dès qu'une connexion existe.
 */
public final class IncidentsTab extends BorderPane {

    private final VicinityApiClient api;
    private final ComboBox<Neighbourhood> neighbourhoodBox = new ComboBox<>();
    private final TableView<Incident> table = new TableView<>();
    private final Label status = new Label();

    public IncidentsTab(final VicinityApiClient api) {
        this.api = api;
        build();
        reloadNeighbourhoods();
    }

    private void build() {
        status.getStyleClass().add("label-muted");

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
        neighbourhoodBox.setPrefWidth(240);
        neighbourhoodBox.valueProperty().addListener((obs, old, selected) -> {
            if (selected != null) {
                AppSession.setSelectedNeighbourhoodId(selected.id());
                loadFromCache();
            }
        });

        final TableColumn<Incident, String> colTitle = new TableColumn<>("Titre");
        colTitle.setCellValueFactory(c -> new SimpleStringProperty(c.getValue().title()));
        colTitle.setPrefWidth(220);

        final TableColumn<Incident, String> colCategory = new TableColumn<>("Catégorie");
        colCategory.setCellValueFactory(c -> new SimpleStringProperty(c.getValue().category()));
        colCategory.setPrefWidth(140);

        final TableColumn<Incident, String> colStatus = new TableColumn<>("Statut");
        colStatus.setCellValueFactory(c -> new SimpleStringProperty(c.getValue().status()));
        colStatus.setPrefWidth(120);

        table.getColumns().addAll(colTitle, colCategory, colStatus);

        final ComboBox<String> statusChoice = new ComboBox<>(
                FXCollections.observableArrayList("open", "in_progress", "resolved"));
        statusChoice.setPromptText("Nouveau statut");

        final Button applyBtn = new Button("Appliquer le statut");
        applyBtn.getStyleClass().add("button-primary");
        applyBtn.setOnAction(
                e -> {
                    final Incident selected = table.getSelectionModel().getSelectedItem();
                    final String newStatus = statusChoice.getValue();
                    if (selected != null && newStatus != null) {
                        changeStatus(selected, newStatus);
                    }
                });

        final Button syncBtn = new Button("Synchroniser");
        syncBtn.getStyleClass().add("button-secondary");
        syncBtn.setOnAction(e -> syncFromApi(syncBtn));

        final HBox actions = new HBox(10, neighbourhoodBox, syncBtn, statusChoice, applyBtn);
        actions.setPadding(new Insets(0, 0, 8, 0));

        final VBox top = new VBox(8, new Label("Incidents & alertes"), status, actions);
        top.getStyleClass().add("panel");
        top.setPadding(new Insets(16));

        final VBox center = new VBox(8, table);
        VBox.setVgrow(table, javafx.scene.layout.Priority.ALWAYS);
        center.setPadding(new Insets(0, 16, 16, 16));

        setTop(top);
        setCenter(center);
    }

    /** Recharge la liste des quartiers depuis le cache H2 (appelé aussi après chaque synchro réussie). */
    public void reloadNeighbourhoods() {
        final List<Neighbourhood> items = LocalStore.loadNeighbourhoods();
        neighbourhoodBox.setItems(FXCollections.observableArrayList(items));
        final String selectedId = AppSession.selectedNeighbourhoodId();
        items.stream()
                .filter(n -> n.id().equals(selectedId))
                .findFirst()
                .or(() -> items.stream().findFirst())
                .ifPresent(neighbourhoodBox::setValue);
    }

    public void syncFromApi(final Button trigger) {
        final Neighbourhood selected = neighbourhoodBox.getValue();
        if (selected == null) {
            status.setText("Sélectionnez un quartier.");
            return;
        }
        if (AppSession.isOffline()) {
            status.setText("Hors ligne — utilisation du cache.");
            loadFromCache();
            return;
        }
        if (trigger != null) trigger.setDisable(true);
        status.setText("Synchronisation…");

        final Task<List<Incident>> task =
                new Task<>() {
                    @Override
                    protected List<Incident> call() throws Exception {
                        return api.listIncidents(selected.id());
                    }
                };
        task.setOnSucceeded(
                ev -> {
                    if (trigger != null) trigger.setDisable(false);
                    final List<Incident> items = task.getValue();
                    LocalStore.replaceIncidents(selected.id(), items);
                    table.setItems(FXCollections.observableArrayList(items));
                    status.setText(items.size() + " incident(s) synchronisé(s).");
                });
        task.setOnFailed(
                ev -> {
                    if (trigger != null) trigger.setDisable(false);
                    status.setText("Échec sync : " + task.getException().getMessage());
                    loadFromCache();
                });
        Thread.ofVirtual().start(task);
    }

    public void loadFromCache() {
        final Neighbourhood selected = neighbourhoodBox.getValue();
        if (selected == null) {
            table.setItems(FXCollections.observableArrayList());
            return;
        }
        final List<Incident> cached = LocalStore.loadIncidents(selected.id());
        table.setItems(FXCollections.observableArrayList(cached));
        status.setText(cached.size() + " incident(s) en cache local (H2).");
    }

    private void changeStatus(final Incident incident, final String newStatus) {
        if (AppSession.isOffline()) {
            LocalStore.queueStatusChange(incident.id(), newStatus, incident.updatedAt());
            status.setText("Hors ligne — changement mis en file, sera envoyé à la reconnexion.");
            loadFromCache();
            return;
        }
        final Task<Incident> task =
                new Task<>() {
                    @Override
                    protected Incident call() throws Exception {
                        return api.updateIncidentStatus(incident.id(), newStatus, incident.updatedAt());
                    }
                };
        task.setOnSucceeded(ev -> syncFromApi(null));
        task.setOnFailed(
                ev -> {
                    final Throwable err = task.getException();
                    if (err instanceof ApiException apiEx && apiEx.statusCode() == 409) {
                        status.setText("Conflit — l'incident a été modifié entre-temps, resynchronisation…");
                        syncFromApi(null);
                    } else {
                        status.setText("Échec : " + (err == null ? "inconnu" : err.getMessage()));
                    }
                });
        Thread.ofVirtual().start(task);
    }
}
