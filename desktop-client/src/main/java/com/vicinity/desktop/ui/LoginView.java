package com.vicinity.desktop.ui;

import com.vicinity.desktop.api.ApiException;
import com.vicinity.desktop.api.VicinityApiClient;
import com.vicinity.desktop.api.dto.AuthResult;
import com.vicinity.desktop.api.dto.MeResponse;
import com.vicinity.desktop.config.DesktopConfig;
import com.vicinity.desktop.session.AppSession;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.Hyperlink;
import javafx.scene.control.Label;
import javafx.scene.control.PasswordField;
import javafx.scene.control.TextField;
import javafx.scene.layout.GridPane;
import javafx.scene.layout.VBox;
import javafx.scene.text.Text;
import javafx.concurrent.Task;

public final class LoginView extends VBox {

    private final VicinityApiClient api;
    private final Runnable onSuccess;

    public LoginView(final VicinityApiClient api, final Runnable onSuccess) {
        this.api = api;
        this.onSuccess = onSuccess;
        getStyleClass().add("panel");
        setAlignment(Pos.CENTER);
        setSpacing(12);
        setPadding(new Insets(28));
        setMaxWidth(420);
        build();
    }

    private void build() {
        final DesktopConfig config = api.config();
        final Label title = new Label("Vicinity — Bureau admin");
        title.getStyleClass().add("label-title");

        final Text subtitle =
                new Text(
                        "Connexion à l’API "
                                + config.apiBaseUrl()
                                + (config.looksLikeWebDevServer()
                                        ? "\n⚠ Port 5173/5174 = front React, pas l’API !"
                                        : "")
                                + "\nSession locale : ~/.vicinity/");

        final TextField email = new TextField();
        email.setPromptText("email@exemple.fr");

        final PasswordField password = new PasswordField();
        password.setPromptText("Mot de passe");

        final TextField ssoToken = new TextField();
        ssoToken.setPromptText("Jeton SSO (optionnel, depuis le web admin)");

        final Label feedback = new Label();
        feedback.getStyleClass().add("label-error");
        feedback.setWrapText(true);

        final Button loginBtn = new Button("Se connecter");
        loginBtn.getStyleClass().add("button-primary");
        loginBtn.setDefaultButton(true);

        final Button ssoBtn = new Button("Utiliser le jeton SSO");
        ssoBtn.getStyleClass().add("button-secondary");

        final GridPane grid = new GridPane();
        grid.setHgap(10);
        grid.setVgap(10);
        grid.add(new Label("E-mail"), 0, 0);
        grid.add(email, 1, 0);
        grid.add(new Label("Mot de passe"), 0, 1);
        grid.add(password, 1, 1);
        grid.add(new Label("SSO"), 0, 2);
        grid.add(ssoToken, 1, 2);

        loginBtn.setOnAction(
                e ->
                        runAuthTask(
                                feedback,
                                loginBtn,
                                () -> {
                                    final AuthResult result =
                                            api.login(email.getText().trim(), password.getText());
                                    AppSession.applyLogin(
                                            result.user(),
                                            result.accessToken(),
                                            result.refreshToken());
                                    return null;
                                }));

        ssoBtn.setOnAction(
                e -> {
                    final String token = ssoToken.getText().trim();
                    if (token.isEmpty()) {
                        feedback.setText("Collez un jeton SSO émis depuis POST /auth/sso/issue.");
                        return;
                    }
                    runAuthTask(
                            feedback,
                            ssoBtn,
                            () -> {
                                AppSession.applyTokens(token, null);
                                final MeResponse me = api.me();
                                AppSession.applySsoToken(token, me);
                                return null;
                            });
                });

        final Hyperlink hint =
                new Hyperlink(
                        "Obtenir un jeton : connectez-vous sur le web admin, puis POST /auth/sso/issue");
        hint.setOnAction(
                ev ->
                        feedback.setText(
                                "Swagger : http://localhost:3000/docs → Authorize → /auth/sso/issue"));

        getChildren()
                .addAll(
                        title,
                        subtitle,
                        grid,
                        loginBtn,
                        ssoBtn,
                        hint,
                        feedback);
    }

    private void runAuthTask(
            final Label feedback,
            final Button trigger,
            final AuthAction action) {
        feedback.getStyleClass().removeAll("label-success");
        feedback.getStyleClass().add("label-error");
        feedback.setText("Connexion…");
        trigger.setDisable(true);

        final Task<Void> task =
                new Task<>() {
                    @Override
                    protected Void call() throws Exception {
                        action.run();
                        return null;
                    }
                };

        task.setOnSucceeded(
                ev -> {
                    trigger.setDisable(false);
                    feedback.getStyleClass().remove("label-error");
                    feedback.getStyleClass().add("label-success");
                    feedback.setText("Connecté.");
                    onSuccess.run();
                });

        task.setOnFailed(
                ev -> {
                    trigger.setDisable(false);
                    AppSession.clear();
                    final Throwable err = task.getException();
                    if (err instanceof ApiException apiErr) {
                        feedback.setText(apiErr.getMessage());
                    } else {
                        feedback.setText(
                                err == null
                                        ? "Erreur réseau"
                                        : err.getMessage() == null
                                                ? err.getClass().getSimpleName()
                                                : err.getMessage());
                    }
                });

        Thread.ofVirtual().start(task);
    }

    @FunctionalInterface
    private interface AuthAction {
        Void run() throws Exception;
    }
}
