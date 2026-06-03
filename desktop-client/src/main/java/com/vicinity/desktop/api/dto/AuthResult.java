package com.vicinity.desktop.api.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record AuthResult(String accessToken, String refreshToken, UserPublic user) {}
