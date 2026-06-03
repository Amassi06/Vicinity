package com.vicinity.desktop.api.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record MeResponse(String sub, String email, String role, boolean mfa) {}
