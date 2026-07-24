package com.vicinity.desktop.ui.tabs;

import com.vicinity.desktop.api.VicinityApiClient;
import com.vicinity.desktop.api.dto.Neighbourhood;
import com.vicinity.desktop.session.AppSession;
import com.vicinity.desktop.store.LocalStore;
import javafx.beans.property.SimpleStringProperty;
import javafx.collections.FXCollections;
import javafx.geometry.Insets;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TableColumn;
import javafx.scene.control.TableView;
import javafx.scene.control.TextArea;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;
import javafx.concurrent.Task;
import java.util.List;

public final class NeighbourhoodsTab extends BorderPane {

    private final VicinityApiClient api;
    private final Label status = new Label();
    private final TableView<Neighbourhood> table = new TableView<>();
    private final TextArea detail = new TextArea();
    private Runnable onSyncSucceeded;

    public NeighbourhoodsTab(final VicinityApiClient api) {
        this.api = api;
        build();
        loadFromCache();
    }

    /** Callback appelé après une synchro réussie (ex. rafraîchir le tableau de bord). */
    public void setOnSyncSucceeded(final Runnable callback) {
        this.onSyncSucceeded = callback;
    }

    private void build() {
        status.getStyleClass().add("label-muted");

        final TableColumn<Neighbourhood, String> colName =
                new TableColumn<>("Nom");
        colName.setCellValueFactory(c -> new SimpleStringProperty(c.getValue().name()));
        colName.setPrefWidth(180);

        final TableColumn<Neighbourhood, String> colId = new TableColumn<>("ID");
        colId.setCellValueFactory(c -> new SimpleStringProperty(c.getValue().id()));
        colId.setPrefWidth(260);

        final TableColumn<Neighbourhood, String> colDesc =
                new TableColumn<>("Description");
        colDesc.setCellValueFactory(
                c -> new SimpleStringProperty(c.getValue().descriptionOrEmpty()));
        colDesc.setPrefWidth(220);

        table.getColumns().addAll(colName, colId, colDesc);
        table.getSelectionModel()
                .selectedItemProperty()
                .addListener(
                        (obs, old, selected) -> {
                            if (selected == null) {
                                detail.clear();
                                return;
                            }
                            detail.setText(
                                    selected.name()
                                            + "\n\n"
                                            + selected.descriptionOrEmpty()
                                            + "\n\nboundary:\n"
                                            + (selected.boundary() == null
                                                    ? "(vide)"
                                                    : selected.boundary().toPrettyString()));
                        });

        detail.setEditable(false);
        detail.setWrapText(true);
        detail.getStyleClass().add("text-area-mono");

        final Button syncBtn = new Button("Synchroniser depuis l’API");
        syncBtn.getStyleClass().add("button-primary");
        syncBtn.setOnAction(e -> syncFromApi(syncBtn));

        final Button cacheBtn = new Button("Recharger le cache local");
        cacheBtn.getStyleClass().add("button-secondary");
        cacheBtn.setOnAction(e -> loadFromCache());

        final HBox actions = new HBox(10, syncBtn, cacheBtn);
        actions.setPadding(new Insets(0, 0, 8, 0));

        final VBox top = new VBox(8, new Label("Quartiers"), status, actions);
        top.getStyleClass().add("panel");
        top.setPadding(new Insets(16));

        final VBox center = new VBox(8, table, new Label("Détail"), detail);
        VBox.setVgrow(table, javafx.scene.layout.Priority.ALWAYS);
        VBox.setVgrow(detail, javafx.scene.layout.Priority.ALWAYS);
        center.setPadding(new Insets(0, 16, 16, 16));

        setTop(top);
        setCenter(center);
    }

    public void syncFromApi(final Button trigger) {
        // On tente toujours l'appel, même marqué hors-ligne : c'est le moyen
        // de se reconnecter quand le réseau/backend redevient disponible.
        trigger.setDisable(true);
        status.setText("Synchronisation…");

        final Task<List<Neighbourhood>> task =
                new Task<>() {
                    @Override
                    protected List<Neighbourhood> call() throws Exception {
                        return api.listNeighbourhoods();
                    }
                };

        task.setOnSucceeded(
                ev -> {
                    trigger.setDisable(false);
                    AppSession.markOnline();
                    final List<Neighbourhood> items = task.getValue();
                    LocalStore.replaceNeighbourhoods(items);
                    table.setItems(FXCollections.observableArrayList(items));
                    status.setText(items.size() + " quartier(s) synchronisé(s).");
                    if (onSyncSucceeded != null) {
                        onSyncSucceeded.run();
                    }
                });

        task.setOnFailed(
                ev -> {
                    trigger.setDisable(false);
                    status.setText("Échec sync : " + task.getException().getMessage());
                    loadFromCache();
                });

        Thread.ofVirtual().start(task);
    }

    public void loadFromCache() {
        final List<Neighbourhood> cached = LocalStore.loadNeighbourhoods();
        table.setItems(FXCollections.observableArrayList(cached));
        status.setText(cached.size() + " quartier(s) en cache local (H2).");
    }
}
