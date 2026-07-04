package com.vicinity.desktop;

import com.vicinity.desktop.api.VicinityApiClient;
import com.vicinity.desktop.config.DesktopConfig;
import com.vicinity.desktop.session.AppSession;
import com.vicinity.desktop.store.LocalStore;
import com.vicinity.desktop.ui.LoginView;
import com.vicinity.desktop.ui.MainView;
import com.vicinity.desktop.ui.ThemeSupport;
import javafx.application.Application;
import javafx.application.Platform;
import javafx.scene.Scene;
import javafx.scene.layout.StackPane;
import javafx.stage.Stage;

/**
 * Client bureau Vicinity — admin / modérateur avec cache H2 hors-ligne.
 */
public final class VicinityApp extends Application {

    private DesktopConfig config;
    private VicinityApiClient api;
    private Stage primaryStage;
    private MainView mainView;

    @Override
    public void start(final Stage stage) {
        this.primaryStage = stage;
        try {
            LocalStore.init();
        } catch (Exception e) {
            showFatal(stage, "Base locale H2 : " + e.getMessage());
            return;
        }

        AppSession.restoreFromDisk();
        config = DesktopConfig.load();
        api = new VicinityApiClient(config);

        primaryStage.setTitle("Vicinity — Bureau admin");
        primaryStage.setMinWidth(900);
        primaryStage.setMinHeight(620);

        if (AppSession.isLoggedIn()) {
            showMain();
        } else {
            showLogin();
        }
    }

    private void showLogin() {
        final LoginView login = new LoginView(api, this::showMain);
        final StackPane root = new StackPane(login);
        applyScene(root);
    }

    private void showMain() {
        mainView = new MainView(api, this::showLogin);
        applyScene(mainView);
        mainView.onShown();
    }

    private void applyScene(final javafx.scene.Parent root) {
        final Scene scene = new Scene(root, 960, 640);
        ThemeSupport.apply(scene, LocalStore.loadThemeMode());
        ThemeSupport.applyAccentColor(scene, LocalStore.loadSetting("accent_color", "#2563eb"));
        try {
            ThemeSupport.applyFontScale(
                    scene, Double.parseDouble(LocalStore.loadSetting("font_scale", "1.0")));
        } catch (NumberFormatException ignored) {
            // garde la taille par défaut
        }
        primaryStage.setScene(scene);
        primaryStage.show();
    }

    @Override
    public void stop() {
        if (mainView != null) {
            mainView.onClosing();
        }
    }

    private void showFatal(final Stage stage, final String message) {
        Platform.runLater(
                () -> {
                    final var alert = new javafx.scene.control.Alert(
                            javafx.scene.control.Alert.AlertType.ERROR);
                    alert.setTitle("Vicinity");
                    alert.setHeaderText("Démarrage impossible");
                    alert.setContentText(message);
                    alert.showAndWait();
                    Platform.exit();
                });
    }

    public static void main(final String[] args) {
        launch(args);
    }
}
