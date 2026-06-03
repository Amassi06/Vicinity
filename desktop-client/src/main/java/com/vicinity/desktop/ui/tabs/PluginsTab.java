package com.vicinity.desktop.ui.tabs;

import com.fasterxml.jackson.databind.JsonNode;
import com.vicinity.desktop.api.VicinityApiClient;
import javafx.geometry.Insets;
import javafx.scene.control.Label;
import javafx.scene.control.TextArea;
import javafx.scene.layout.VBox;
import javafx.concurrent.Task;

public final class PluginsTab extends VBox {

    private final VicinityApiClient api;
    private final TextArea output = new TextArea();

    public PluginsTab(final VicinityApiClient api) {
        this.api = api;
        getStyleClass().add("panel");
        setPadding(new Insets(16));
        output.setEditable(false);
        output.setPrefRowCount(16);
        getChildren().addAll(new Label("Plugins enregistrés (API)"), output);
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
}
