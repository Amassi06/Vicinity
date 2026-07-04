package com.vicinity.desktop.api.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public record Incident(
        @JsonProperty("_id") String id,
        String reporterId,
        String neighbourhoodId,
        String title,
        String description,
        String category,
        String status,
        String createdAt,
        String updatedAt) {}
