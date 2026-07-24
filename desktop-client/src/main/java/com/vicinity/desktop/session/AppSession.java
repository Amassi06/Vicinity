package com.vicinity.desktop.session;

import com.vicinity.desktop.api.dto.MeResponse;
import com.vicinity.desktop.api.dto.UserPublic;
import com.vicinity.desktop.store.LocalStore;

public final class AppSession {

    private static String accessToken;
    private static String refreshToken;
    private static MeResponse currentUser;
    private static boolean offlineMode;
    private static String selectedNeighbourhoodId;

    private AppSession() {}

    public static void applyLogin(final UserPublic user, final String access, final String refresh) {
        accessToken = access;
        refreshToken = refresh;
        currentUser =
                new MeResponse(user.id(), user.email(), user.role(), user.mfaEnabled());
        offlineMode = false;
        LocalStore.saveSession(access, refresh, currentUser);
    }

    public static void applySsoToken(final String token, final MeResponse me) {
        accessToken = token;
        refreshToken = null;
        currentUser = me;
        offlineMode = false;
        LocalStore.saveSession(token, "", currentUser);
    }

    public static void applyTokens(final String access, final String refresh) {
        accessToken = access;
        refreshToken = refresh;
        LocalStore.saveSession(access, refresh == null ? "" : refresh, currentUser);
    }

    public static void updateUser(final MeResponse me) {
        currentUser = me;
        offlineMode = false;
        LocalStore.saveSession(
                accessToken, refreshToken == null ? "" : refreshToken, currentUser);
    }

    public static void restoreFromDisk() {
        final LocalStore.PersistedSession persisted = LocalStore.loadSession();
        if (persisted == null) {
            clear();
            return;
        }
        accessToken = persisted.accessToken();
        refreshToken =
                persisted.refreshToken() == null || persisted.refreshToken().isBlank()
                        ? null
                        : persisted.refreshToken();
        currentUser = persisted.user();
        offlineMode = false;
    }

    public static void markOffline() {
        offlineMode = true;
    }

    /** Rétablit le mode en ligne après un appel API réussi (le mode hors-ligne ne doit pas être définitif). */
    public static void markOnline() {
        offlineMode = false;
    }

    public static void clear() {
        accessToken = null;
        refreshToken = null;
        currentUser = null;
        offlineMode = false;
        LocalStore.clearSession();
    }

    public static String accessToken() {
        return accessToken;
    }

    public static String refreshToken() {
        return refreshToken;
    }

    public static MeResponse user() {
        return currentUser;
    }

    public static boolean isLoggedIn() {
        return accessToken != null && !accessToken.isBlank() && currentUser != null;
    }

    public static boolean isOffline() {
        return offlineMode;
    }

    public static boolean isAdmin() {
        return currentUser != null && "ADMIN".equals(currentUser.role());
    }

    public static String selectedNeighbourhoodId() {
        return selectedNeighbourhoodId;
    }

    public static void setSelectedNeighbourhoodId(final String id) {
        selectedNeighbourhoodId = id;
    }

}
