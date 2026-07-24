package com.vicinity.desktop.store;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vicinity.desktop.api.dto.Incident;
import com.vicinity.desktop.api.dto.MeResponse;
import com.vicinity.desktop.api.dto.Neighbourhood;
import com.vicinity.desktop.api.dto.Stats;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public final class LocalStore {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static volatile String jdbcUrl;

    private LocalStore() {}

    public static synchronized void init() throws SQLException {
        if (jdbcUrl != null) {
            return;
        }
        final Path dir = Path.of(System.getProperty("user.home"), ".vicinity", "data");
        try {
            Files.createDirectories(dir);
        } catch (java.io.IOException e) {
            throw new SQLException("Impossible de créer " + dir, e);
        }
        jdbcUrl = "jdbc:h2:" + dir.resolve("vicinity-desktop").toAbsolutePath();
        try (Connection conn = connection(); Statement st = conn.createStatement()) {
            st.execute(
                    """
                    CREATE TABLE IF NOT EXISTS app_session (
                      id INT PRIMARY KEY,
                      access_token CLOB NOT NULL,
                      refresh_token CLOB,
                      user_json CLOB NOT NULL,
                      updated_at TIMESTAMP NOT NULL
                    )
                    """);
            st.execute(
                    """
                    CREATE TABLE IF NOT EXISTS neighbourhoods_cache (
                      id VARCHAR(36) PRIMARY KEY,
                      name VARCHAR(200) NOT NULL,
                      description CLOB,
                      payload_json CLOB NOT NULL,
                      synced_at TIMESTAMP NOT NULL
                    )
                    """);
                        st.execute(
                                        """
                                        CREATE TABLE IF NOT EXISTS app_settings (
                                            setting_key VARCHAR(120) PRIMARY KEY,
                                            setting_value CLOB NOT NULL,
                                            updated_at TIMESTAMP NOT NULL
                                        )
                                        """);
            st.execute(
                    """
                    CREATE TABLE IF NOT EXISTS incidents_cache (
                      id VARCHAR(36) PRIMARY KEY,
                      neighbourhood_id VARCHAR(36) NOT NULL,
                      status VARCHAR(20) NOT NULL,
                      payload_json CLOB NOT NULL,
                      remote_updated_at VARCHAR(60),
                      synced_at TIMESTAMP NOT NULL
                    )
                    """);
            st.execute(
                    """
                    CREATE TABLE IF NOT EXISTS incident_outbox (
                      id VARCHAR(36) PRIMARY KEY,
                      incident_id VARCHAR(36) NOT NULL,
                      new_status VARCHAR(20) NOT NULL,
                      base_updated_at VARCHAR(60),
                      queued_at TIMESTAMP NOT NULL
                    )
                    """);
            st.execute(
                    """
                    CREATE TABLE IF NOT EXISTS stats_cache (
                      neighbourhood_id VARCHAR(36) PRIMARY KEY,
                      payload_json CLOB NOT NULL,
                      synced_at TIMESTAMP NOT NULL
                    )
                    """);
        }
    }

    public static void saveSession(
            final String accessToken, final String refreshToken, final MeResponse user) {
        try (Connection conn = connection();
                PreparedStatement ps =
                        conn.prepareStatement(
                                """
                                MERGE INTO app_session (id, access_token, refresh_token, user_json, updated_at)
                                KEY (id)
                                VALUES (1, ?, ?, ?, CURRENT_TIMESTAMP)
                                """)) {
            ps.setString(1, accessToken);
            ps.setString(2, refreshToken);
            ps.setString(3, MAPPER.writeValueAsString(user));
            ps.executeUpdate();
        } catch (Exception e) {
            throw new IllegalStateException("Impossible de sauvegarder la session", e);
        }
    }

    public static PersistedSession loadSession() {
        try (Connection conn = connection();
                PreparedStatement ps =
                        conn.prepareStatement(
                                "SELECT access_token, refresh_token, user_json FROM app_session WHERE id = 1");
                ResultSet rs = ps.executeQuery()) {
            if (!rs.next()) {
                return null;
            }
            final MeResponse user = MAPPER.readValue(rs.getString("user_json"), MeResponse.class);
            return new PersistedSession(
                    rs.getString("access_token"),
                    rs.getString("refresh_token"),
                    user);
        } catch (Exception e) {
            return null;
        }
    }

    public static void clearSession() {
        try (Connection conn = connection();
                Statement st = conn.createStatement()) {
            st.executeUpdate("DELETE FROM app_session");
        } catch (SQLException e) {
            throw new IllegalStateException("Impossible d'effacer la session", e);
        }
    }

    public static void saveSetting(final String key, final String value) {
        try (Connection conn = connection();
                PreparedStatement ps =
                        conn.prepareStatement(
                                """
                                MERGE INTO app_settings (setting_key, setting_value, updated_at)
                                KEY (setting_key)
                                VALUES (?, ?, CURRENT_TIMESTAMP)
                                """)) {
            ps.setString(1, key);
            ps.setString(2, value);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new IllegalStateException("Impossible de sauvegarder le paramètre " + key, e);
        }
    }

    public static String loadSetting(final String key, final String defaultValue) {
        try (Connection conn = connection();
                PreparedStatement ps =
                        conn.prepareStatement(
                                "SELECT setting_value FROM app_settings WHERE setting_key = ?")) {
            ps.setString(1, key);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    final String value = rs.getString("setting_value");
                    return value == null || value.isBlank() ? defaultValue : value;
                }
            }
        } catch (SQLException e) {
            throw new IllegalStateException("Impossible de lire le paramètre " + key, e);
        }
        return defaultValue;
    }

    public static String loadThemeMode() {
        return loadSetting("theme_mode", "light");
    }

    public static void saveThemeMode(final String themeMode) {
        saveSetting("theme_mode", themeMode == null || themeMode.isBlank() ? "light" : themeMode);
    }

    public static void replaceNeighbourhoods(final List<Neighbourhood> items) {
        try (Connection conn = connection()) {
            conn.setAutoCommit(false);
            try (Statement clear = conn.createStatement()) {
                clear.executeUpdate("DELETE FROM neighbourhoods_cache");
            }
            try (PreparedStatement ps =
                    conn.prepareStatement(
                            """
                            INSERT INTO neighbourhoods_cache
                              (id, name, description, payload_json, synced_at)
                            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                            """)) {
                for (final Neighbourhood n : items) {
                    ps.setString(1, n.id());
                    ps.setString(2, n.name());
                    ps.setString(3, n.description());
                    ps.setString(4, MAPPER.writeValueAsString(n));
                    ps.addBatch();
                }
                ps.executeBatch();
            }
            conn.commit();
        } catch (Exception e) {
            throw new IllegalStateException("Impossible de mettre en cache les quartiers", e);
        }
    }

    public static List<Neighbourhood> loadNeighbourhoods() {
        final List<Neighbourhood> out = new ArrayList<>();
        try (Connection conn = connection();
                PreparedStatement ps =
                        conn.prepareStatement(
                                """
                                SELECT payload_json FROM neighbourhoods_cache
                                ORDER BY name
                                """);
                ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                out.add(MAPPER.readValue(rs.getString("payload_json"), Neighbourhood.class));
            }
        } catch (Exception e) {
            throw new IllegalStateException("Impossible de lire le cache quartiers", e);
        }
        return out;
    }

    public static Optional<Instant> lastNeighbourhoodSync() {
        try (Connection conn = connection();
                PreparedStatement ps =
                        conn.prepareStatement(
                                "SELECT MAX(synced_at) AS t FROM neighbourhoods_cache");
                ResultSet rs = ps.executeQuery()) {
            if (rs.next() && rs.getTimestamp("t") != null) {
                return Optional.of(rs.getTimestamp("t").toInstant());
            }
        } catch (SQLException e) {
            throw new IllegalStateException(e);
        }
        return Optional.empty();
    }

    public static void replaceIncidents(final String neighbourhoodId, final List<Incident> items) {
        try (Connection conn = connection()) {
            conn.setAutoCommit(false);
            try (PreparedStatement clear =
                    conn.prepareStatement("DELETE FROM incidents_cache WHERE neighbourhood_id = ?")) {
                clear.setString(1, neighbourhoodId);
                clear.executeUpdate();
            }
            try (PreparedStatement ps =
                    conn.prepareStatement(
                            """
                            INSERT INTO incidents_cache
                              (id, neighbourhood_id, status, payload_json, remote_updated_at, synced_at)
                            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                            """)) {
                for (final Incident i : items) {
                    ps.setString(1, i.id());
                    ps.setString(2, neighbourhoodId);
                    ps.setString(3, i.status());
                    ps.setString(4, MAPPER.writeValueAsString(i));
                    ps.setString(5, i.updatedAt());
                    ps.addBatch();
                }
                ps.executeBatch();
            }
            conn.commit();
        } catch (Exception e) {
            throw new IllegalStateException("Impossible de mettre en cache les incidents", e);
        }
    }

    public static List<Incident> loadIncidents(final String neighbourhoodId) {
        final List<Incident> out = new ArrayList<>();
        try (Connection conn = connection();
                PreparedStatement ps =
                        conn.prepareStatement(
                                """
                                SELECT payload_json FROM incidents_cache
                                WHERE neighbourhood_id = ?
                                ORDER BY synced_at DESC
                                """)) {
            ps.setString(1, neighbourhoodId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    out.add(MAPPER.readValue(rs.getString("payload_json"), Incident.class));
                }
            }
        } catch (Exception e) {
            throw new IllegalStateException("Impossible de lire le cache incidents", e);
        }
        return out;
    }

    /** Ajout hors-ligne : file d'attente d'un changement de statut à rejouer à la prochaine sync. */
    public static void queueStatusChange(
            final String incidentId, final String newStatus, final String baseUpdatedAt) {
        try (Connection conn = connection();
                PreparedStatement ps =
                        conn.prepareStatement(
                                """
                                INSERT INTO incident_outbox
                                  (id, incident_id, new_status, base_updated_at, queued_at)
                                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                                """)) {
            ps.setString(1, java.util.UUID.randomUUID().toString());
            ps.setString(2, incidentId);
            ps.setString(3, newStatus);
            ps.setString(4, baseUpdatedAt);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new IllegalStateException("Impossible de mettre en file l'action hors-ligne", e);
        }
    }

    /**
     * Reflète immédiatement dans le cache un changement de statut mis en file
     * hors-ligne, pour que l'UI affiche le nouveau statut sans attendre la
     * synchro (le serveur reste la source de vérité au prochain pull).
     */
    public static void applyLocalStatusChange(final String incidentId, final String newStatus) {
        try (Connection conn = connection()) {
            final String payload;
            try (PreparedStatement select =
                    conn.prepareStatement("SELECT payload_json FROM incidents_cache WHERE id = ?")) {
                select.setString(1, incidentId);
                try (ResultSet rs = select.executeQuery()) {
                    if (!rs.next()) {
                        return;
                    }
                    payload = rs.getString("payload_json");
                }
            }
            final var node = (com.fasterxml.jackson.databind.node.ObjectNode) MAPPER.readTree(payload);
            node.put("status", newStatus);
            try (PreparedStatement update =
                    conn.prepareStatement(
                            "UPDATE incidents_cache SET status = ?, payload_json = ? WHERE id = ?")) {
                update.setString(1, newStatus);
                update.setString(2, MAPPER.writeValueAsString(node));
                update.setString(3, incidentId);
                update.executeUpdate();
            }
        } catch (Exception e) {
            throw new IllegalStateException("Impossible d'appliquer le changement local", e);
        }
    }

    public static List<OutboxEntry> loadOutbox() {
        final List<OutboxEntry> out = new ArrayList<>();
        try (Connection conn = connection();
                PreparedStatement ps =
                        conn.prepareStatement(
                                "SELECT id, incident_id, new_status, base_updated_at FROM incident_outbox");
                ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                out.add(
                        new OutboxEntry(
                                rs.getString("id"),
                                rs.getString("incident_id"),
                                rs.getString("new_status"),
                                rs.getString("base_updated_at")));
            }
        } catch (SQLException e) {
            throw new IllegalStateException("Impossible de lire la file hors-ligne", e);
        }
        return out;
    }

    public static void clearOutboxEntry(final String id) {
        try (Connection conn = connection();
                PreparedStatement ps =
                        conn.prepareStatement("DELETE FROM incident_outbox WHERE id = ?")) {
            ps.setString(1, id);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new IllegalStateException("Impossible de vider la file hors-ligne", e);
        }
    }

    public static void saveStats(final String neighbourhoodId, final Stats stats) {
        try (Connection conn = connection();
                PreparedStatement ps =
                        conn.prepareStatement(
                                """
                                MERGE INTO stats_cache (neighbourhood_id, payload_json, synced_at)
                                KEY (neighbourhood_id)
                                VALUES (?, ?, CURRENT_TIMESTAMP)
                                """)) {
            ps.setString(1, neighbourhoodId);
            ps.setString(2, MAPPER.writeValueAsString(stats));
            ps.executeUpdate();
        } catch (Exception e) {
            throw new IllegalStateException("Impossible de mettre en cache les statistiques", e);
        }
    }

    public static Optional<Stats> loadStats(final String neighbourhoodId) {
        try (Connection conn = connection();
                PreparedStatement ps =
                        conn.prepareStatement(
                                "SELECT payload_json FROM stats_cache WHERE neighbourhood_id = ?")) {
            ps.setString(1, neighbourhoodId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(MAPPER.readValue(rs.getString("payload_json"), Stats.class));
                }
            }
        } catch (Exception e) {
            throw new IllegalStateException("Impossible de lire le cache statistiques", e);
        }
        return Optional.empty();
    }

    /** Supprime toutes les données locales (répertoire H2) — utilisé par la désinstallation. */
    public static void wipeAllLocalData() throws java.io.IOException {
        final Path dir = Path.of(System.getProperty("user.home"), ".vicinity");
        jdbcUrl = null;
        if (!Files.exists(dir)) {
            return;
        }
        try (var walk = Files.walk(dir)) {
            walk.sorted(java.util.Comparator.reverseOrder()).forEach(p -> {
                try {
                    Files.deleteIfExists(p);
                } catch (java.io.IOException ignored) {
                    // best effort
                }
            });
        }
    }

    public record OutboxEntry(String id, String incidentId, String newStatus, String baseUpdatedAt) {}

    private static Connection connection() throws SQLException {
        if (jdbcUrl == null) {
            throw new IllegalStateException("LocalStore.init() non appelé");
        }
        return DriverManager.getConnection(jdbcUrl, "sa", "");
    }

    public record PersistedSession(String accessToken, String refreshToken, MeResponse user) {}
}
