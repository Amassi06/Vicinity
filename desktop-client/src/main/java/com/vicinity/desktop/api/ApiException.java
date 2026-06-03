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
}
