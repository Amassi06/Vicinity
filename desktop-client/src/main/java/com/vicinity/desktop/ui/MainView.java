package com.vicinity.desktop.ui;

import com.vicinity.desktop.api.ApiException;
import com.vicinity.desktop.api.VicinityApiClient;
import com.vicinity.desktop.api.dto.MeResponse;
import com.vicinity.desktop.session.AppSession;
import com.vicinity.desktop.ui.ThemeSupport;
import com.vicinity.desktop.ui.tabs.HomeTab;
import com.vicinity.desktop.ui.tabs.IncidentsTab;
import com.vicinity.desktop.ui.tabs.NeighbourhoodsTab;
import com.vicinity.desktop.ui.tabs.WalletTab;
import com.vicinity.desktop.sync.SyncService;
import com.vicinity.desktop.update.UpdateChecker;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Alert;
import javafx.scene.control.Button;
import javafx.scene.control.ButtonType;
import javafx.scene.control.ColorPicker;
import javafx.scene.control.Label;
import javafx.scene.control.Spinner;
import javafx.scene.control.SpinnerValueFactory;
import javafx.scene.control.Tab;
import javafx.scene.control.TabPane;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.HBox;
import javafx.concurrent.Task;
import javafx.application.Platform;
import javafx.scene.paint.Color;
import com.vicinity.desktop.store.LocalStore;

public final class MainView extends BorderPane {

    private final VicinityApiClient api;
    private final Runnable onLogout;
    private final HomeTab homeTab;
    private final NeighbourhoodsTab neighbourhoodsTab;
    private final IncidentsTab incidentsTab;
    private final SyncService syncService;
    private final Label offlineBadge = new Label();
    private final Label themeBadge = new Label();

    public MainView(final VicinityApiClient api, final Runnable onLogout) {
        this.api = api;
        this.onLogout = onLogout;
        this.homeTab = new HomeTab(api);
        this.neighbourhoodsTab = new NeighbourhoodsTab(api);
        this.incidentsTab = new IncidentsTab(api);
        this.syncService = new SyncService(api);
        buildToolbar();
        buildTabs();
        // Après une synchro réussie : rafraîchir le tableau de bord et le
        // sélecteur de quartier des incidents, et masquer le badge hors-ligne.
        neighbourhoodsTab.setOnSyncSucceeded(
                () -> {
                    offlineBadge.setVisible(false);
                    homeTab.refreshStatic();
                    incidentsTab.reloadNeighbourhoods();
                });
    }

    public void onShown() {
        homeTab.refreshStatic();
        refreshSessionOnline();
        syncService.start();
        UpdateChecker.checkAndNotify(api);
    }

    public void onClosing() {
        syncService.stop();
    }

    private void buildToolbar() {
        final MeResponse user = AppSession.user();
        final Label who =
                new Label(
                        user == null
                                ? "—"
                                : user.email() + "  ·  " + user.role());
        who.getStyleClass().add("label-muted");

        offlineBadge.getStyleClass().add("label-error");
        offlineBadge.setVisible(AppSession.isOffline());

        themeBadge.getStyleClass().add("label-muted");
        themeBadge.setText("Thème : " + ThemeSupport.currentTheme());

        final Button themeBtn = new Button("Basculer thème");
        themeBtn.getStyleClass().add("button-secondary");
        themeBtn.setOnAction(
            e -> {
                final String next = ThemeSupport.toggle(getScene());
                themeBadge.setText("Thème : " + next);
            });

        final ColorPicker accentPicker = new ColorPicker();
        try {
            accentPicker.setValue(Color.web(LocalStore.loadSetting("accent_color", "#2563eb")));
        } catch (IllegalArgumentException ignored) {
            accentPicker.setValue(Color.web("#2563eb"));
        }
        accentPicker.setOnAction(
                e -> ThemeSupport.applyAccentColor(getScene(), toHex(accentPicker.getValue())));

        final Spinner<Double> fontSpinner =
                new Spinner<>(new SpinnerValueFactory.DoubleSpinnerValueFactory(0.8, 1.4, 1.0, 0.1));
        fontSpinner.setEditable(false);
        fontSpinner.setPrefWidth(80);
        try {
            fontSpinner.getValueFactory().setValue(
                    Double.parseDouble(LocalStore.loadSetting("font_scale", "1.0")));
        } catch (NumberFormatException ignored) {
            // garde 1.0
        }
        fontSpinner.valueProperty()
                .addListener((obs, old, val) -> ThemeSupport.applyFontScale(getScene(), val));

        final Button uninstallBtn = new Button("Désinstaller");
        uninstallBtn.getStyleClass().add("button-secondary");
        uninstallBtn.setOnAction(e -> confirmUninstall());

        final Button logoutBtn = new Button("Déconnexion");
        logoutBtn.getStyleClass().add("button-secondary");
        logoutBtn.setOnAction(
                e -> {
                    api.logoutRemote();
                    AppSession.clear();
                    onLogout.run();
                });

        final HBox bar =
                new HBox(
                        12,
                        who,
                        offlineBadge,
                        themeBadge,
                        themeBtn,
                        accentPicker,
                        fontSpinner,
                        uninstallBtn,
                        logoutBtn);
        bar.setAlignment(Pos.CENTER_LEFT);
        bar.getStyleClass().add("toolbar");
        bar.setPadding(new Insets(10, 16, 10, 16));
        HBox.setHgrow(who, javafx.scene.layout.Priority.ALWAYS);
        setTop(bar);
    }

    private void buildTabs() {
        final TabPane tabs = new TabPane();
        tabs.setTabClosingPolicy(TabPane.TabClosingPolicy.UNAVAILABLE);

        final Tab home = new Tab("Accueil", homeTab);
        final Tab hoods = new Tab("Quartiers", neighbourhoodsTab);
        final Tab incidents = new Tab("Incidents", incidentsTab);
        final Tab wallet = new Tab("Portefeuille", new WalletTab(api));

        tabs.getTabs().addAll(home, hoods, incidents, wallet);
        setCenter(tabs);
    }

    private void refreshSessionOnline() {
        final Task<MeResponse> task =
                new Task<>() {
                    @Override
                    protected MeResponse call() throws Exception {
                        return api.me();
                    }
                };

        task.setOnSucceeded(
                ev -> {
                    offlineBadge.setVisible(false);
                    AppSession.updateUser(task.getValue());
                    homeTab.refreshStatic();
                });

        task.setOnFailed(
                ev -> {
                    final Throwable err = task.getException();
                    if (err instanceof ApiException apiErr && apiErr.statusCode() == 401) {
                        // Session expirée (refresh impossible) : retour à la connexion
                        // plutôt qu'un mode hors-ligne dont on ne sort jamais.
                        AppSession.clear();
                        onLogout.run();
                        return;
                    }
                    AppSession.markOffline();
                    offlineBadge.setVisible(true);
                    offlineBadge.setText("Hors ligne — cache local");
                    homeTab.refreshStatic();
                });

        Thread.ofVirtual().start(task);
    }

    private static String toHex(final Color c) {
        return String.format(
                "#%02x%02x%02x",
                (int) Math.round(c.getRed() * 255),
                (int) Math.round(c.getGreen() * 255),
                (int) Math.round(c.getBlue() * 255));
    }

    /**
     * Désinstallation depuis l'UI : révoque la session, supprime les données
     * locales (~/.vicinity) et quitte l'application. Ne supprime pas le
     * fichier .jar lui-même (hors de portée d'une JVM en cours d'exécution).
     */
    private void confirmUninstall() {
        final Alert confirm = new Alert(Alert.AlertType.CONFIRMATION);
        confirm.setTitle("Désinstaller Vicinity");
        confirm.setHeaderText("Désinstaller l'application ?");
        confirm.setContentText(
                "Cela supprime la session et toutes les données locales (~/.vicinity). "
                        + "L'application se fermera ensuite.");
        confirm.showAndWait().filter(bt -> bt == ButtonType.OK).ifPresent(bt -> {
            syncService.stop();
            api.logoutRemote();
            AppSession.clear();
            try {
                LocalStore.wipeAllLocalData();
            } catch (java.io.IOException ignored) {
                // best effort
            }
            Platform.exit();
            System.exit(0);
        });
    }
}
