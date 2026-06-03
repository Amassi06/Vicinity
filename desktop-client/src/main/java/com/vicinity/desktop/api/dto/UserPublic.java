package com.vicinity.desktop.api.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record UserPublic(
        String id, String email, String displayName, String role, boolean mfaEnabled) {}
