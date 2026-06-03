package com.vicinity.desktop.api.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.JsonNode;

@JsonIgnoreProperties(ignoreUnknown = true)
public record Neighbourhood(
        String id,
        String name,
        String description,
        JsonNode boundary,
        String createdAt,
        String updatedAt) {

    public String descriptionOrEmpty() {
        return description == null ? "" : description;
    }
}
