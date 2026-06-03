package com.vicinity.desktop.ui.tabs;

import com.vicinity.desktop.api.VicinityApiClient;
import com.vicinity.desktop.session.AppSession;
import javafx.geometry.Insets;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TextField;
import javafx.scene.layout.GridPane;
import javafx.scene.layout.VBox;
import javafx.concurrent.Task;

public final class WalletTab extends VBox {

    private final VicinityApiClient api;
    private final Label feedback = new Label();

    public WalletTab(final VicinityApiClient api) {
        this.api = api;
        getStyleClass().add("panel");
        setSpacing(12);
        setPadding(new Insets(16));
        build();
    }

    private void build() {
        final Label title = new Label("Crédit portefeuille (ADMIN)");
        title.getStyleClass().add("label-title");

        if (!AppSession.isAdmin()) {
            final Label warn = new Label("Réservé aux comptes ADMIN.");
            warn.getStyleClass().add("label-muted");
            getChildren().addAll(title, warn);
            return;
        }

        final TextField userId = new TextField();
        userId.setPromptText("UUID utilisateur");

        final TextField amount = new TextField("100");
        amount.setPromptText("Montant");

        final Button submit = new Button("Créditer (ADMIN_ADJUSTMENT)");
        submit.getStyleClass().add("button-primary");

        final GridPane grid = new GridPane();
        grid.setHgap(10);
        grid.setVgap(10);
        grid.add(new Label("Utilisateur"), 0, 0);
        grid.add(userId, 1, 0);
        grid.add(new Label("Points"), 0, 1);
        grid.add(amount, 1, 1);

        submit.setOnAction(
                e -> {
                    feedback.getStyleClass().removeAll("label-success", "label-error");
                    try {
                        final int pts = Integer.parseInt(amount.getText().trim());
                        if (pts < 1) {
                            throw new NumberFormatException();
                        }
                        runCredit(userId.getText().trim(), pts, submit);
                    } catch (NumberFormatException ex) {
                        feedback.getStyleClass().add("label-error");
                        feedback.setText("Montant invalide.");
                    }
                });

        getChildren().addAll(title, grid, submit, feedback);
    }

    private void runCredit(final String toUserId, final int pts, final Button btn) {
        if (toUserId.isBlank()) {
            feedback.getStyleClass().add("label-error");
            feedback.setText("UUID requis.");
            return;
        }
        btn.setDisable(true);
        feedback.setText("Envoi…");

        final Task<Void> task =
                new Task<>() {
                    @Override
                    protected Void call() throws Exception {
                        api.adminCreditWallet(toUserId, pts, "ADMIN_ADJUSTMENT");
                        return null;
                    }
                };

        task.setOnSucceeded(
                ev -> {
                    btn.setDisable(false);
                    feedback.getStyleClass().add("label-success");
                    feedback.setText("Points crédités.");
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
