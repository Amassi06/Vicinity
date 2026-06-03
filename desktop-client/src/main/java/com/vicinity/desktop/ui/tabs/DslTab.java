package com.vicinity.desktop.ui.tabs;

import com.vicinity.desktop.api.VicinityApiClient;
import com.vicinity.desktop.session.AppSession;
import javafx.geometry.Insets;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TextArea;
import javafx.scene.layout.VBox;
import javafx.concurrent.Task;

public final class DslTab extends VBox {

    private final VicinityApiClient api;
    private final TextArea input = new TextArea("status = published");
    private final TextArea output = new TextArea();
    private final Label feedback = new Label();

    public DslTab(final VicinityApiClient api) {
        this.api = api;
        getStyleClass().add("panel");
        setSpacing(12);
        setPadding(new Insets(16));
        build();
    }

    private void build() {
        final Label title = new Label("Compilateur DSL MongoDB");
        title.getStyleClass().add("label-title");

        if (!AppSession.canUseDsl()) {
            final Label warn = new Label("Réservé aux rôles MODERATOR et ADMIN.");
            warn.getStyleClass().add("label-muted");
            getChildren().addAll(title, warn);
            return;
        }

        input.setPrefRowCount(6);
        input.getStyleClass().add("text-area-mono");
        output.setEditable(false);
        output.setPrefRowCount(12);
        output.getStyleClass().add("text-area-mono");

        final Button compile = new Button("Compiler (POST /dsl/compile)");
        compile.getStyleClass().add("button-primary");
        compile.setOnAction(e -> runCompile(compile));

        getChildren().addAll(title, input, compile, feedback, output);
    }

    private void runCompile(final Button btn) {
        btn.setDisable(true);
        feedback.setText("Compilation…");
        output.clear();

        final Task<String> task =
                new Task<>() {
                    @Override
                    protected String call() throws Exception {
                        return api.compileDsl(input.getText()).toPrettyString();
                    }
                };

        task.setOnSucceeded(
                ev -> {
                    btn.setDisable(false);
                    feedback.getStyleClass().remove("label-error");
                    feedback.getStyleClass().add("label-success");
                    feedback.setText("OK");
                    output.setText(task.getValue());
                });
        task.setOnFailed(
                ev -> {
                    btn.setDisable(false);
                    feedback.getStyleClass().add("label-error");
                    feedback.setText(task.getException().getMessage());
                });
        Thread.ofVirtual().start(task);
    }
}
