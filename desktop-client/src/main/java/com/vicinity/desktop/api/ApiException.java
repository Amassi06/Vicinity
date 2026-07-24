package com.vicinity.desktop.api;

public final class ApiException extends Exception {

    private final int statusCode;

    public ApiException(final int statusCode, final String message) {
        super(message);
        this.statusCode = statusCode;
    }

    public int statusCode() {
        return statusCode;
    }

    /**
     * Vrai si l'erreur vient du réseau (backend injoignable) et non d'un refus
     * du serveur — dans ce cas l'action peut être mise en file hors-ligne.
     */
    public static boolean isNetwork(final Throwable err) {
        if (err instanceof ApiException apiEx) {
            return apiEx.statusCode() == 0;
        }
        return err instanceof java.io.IOException;
    }
}
