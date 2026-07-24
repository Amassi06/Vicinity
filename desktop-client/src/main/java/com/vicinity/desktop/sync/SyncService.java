package com.vicinity.desktop.sync;

import com.vicinity.desktop.api.ApiException;
import com.vicinity.desktop.api.VicinityApiClient;
import com.vicinity.desktop.api.dto.Incident;
import com.vicinity.desktop.api.dto.Neighbourhood;
import com.vicinity.desktop.session.AppSession;
import com.vicinity.desktop.store.LocalStore;
import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Synchronisation automatique dès qu'une connexion est disponible : au
 * démarrage puis toutes les 5 minutes, resynchronise quartiers/incidents/
 * statistiques et rejoue la file d'attente hors-ligne (incident_outbox) avec
 * une résolution de conflit optimiste (comparaison updatedAt côté serveur).
 */
public final class SyncService {

    private final VicinityApiClient api;
    private ScheduledExecutorService executor;
    private Runnable onTickCompleted;

    public SyncService(final VicinityApiClient api) {
        this.api = api;
    }

    /** Callback UI (thread JavaFX) après chaque tentative de synchro, réussie ou non. */
    public void setOnTickCompleted(final Runnable callback) {
        this.onTickCompleted = callback;
    }

    public void start() {
        if (executor != null) {
            return;
        }
        executor = Executors.newSingleThreadScheduledExecutor(r -> {
            final Thread t = new Thread(r, "vicinity-sync");
            t.setDaemon(true);
            return t;
        });
        executor.scheduleWithFixedDelay(this::tick, 0, 5, TimeUnit.MINUTES);
    }

    public void stop() {
        if (executor != null) {
            executor.shutdownNow();
            executor = null;
        }
    }

    private void tick() {
        // Pas de garde isOffline() : on tente à chaque tick, c'est ce qui
        // permet de repasser en ligne quand le backend redevient joignable.
        try {
            // La file d'abord : le pull écraserait le cache avec l'état serveur
            // avant que les changements locaux en attente n'y soient poussés.
            flushOutbox();

            final List<Neighbourhood> neighbourhoods = api.listNeighbourhoods();
            AppSession.markOnline();
            LocalStore.replaceNeighbourhoods(neighbourhoods);

            for (final Neighbourhood n : neighbourhoods) {
                final List<Incident> incidents = api.listIncidents(n.id());
                LocalStore.replaceIncidents(n.id(), incidents);
                LocalStore.saveStats(n.id(), api.getStats(n.id()));
            }
        } catch (Exception e) {
            // best effort ; la prochaine synchro réessaiera
            if (ApiException.isNetwork(e)) {
                AppSession.markOffline();
            }
        } finally {
            if (onTickCompleted != null) {
                javafx.application.Platform.runLater(onTickCompleted);
            }
        }
    }

    private void flushOutbox() {
        for (final LocalStore.OutboxEntry entry : LocalStore.loadOutbox()) {
            try {
                api.updateIncidentStatus(entry.incidentId(), entry.newStatus(), entry.baseUpdatedAt());
                LocalStore.clearOutboxEntry(entry.id());
            } catch (ApiException e) {
                if (e.statusCode() == 409) {
                    // conflit : quelqu'un d'autre a modifié l'incident, on abandonne ce changement
                    LocalStore.clearOutboxEntry(entry.id());
                }
                // sinon (réseau/erreur), on retentera au prochain tick
            } catch (Exception ignored) {
                // on retentera au prochain tick
            }
        }
    }
}
