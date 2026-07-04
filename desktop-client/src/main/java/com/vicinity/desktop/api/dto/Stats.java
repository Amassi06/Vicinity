package com.vicinity.desktop.api.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record Stats(
        String neighbourhoodId,
        int listings,
        int events,
        int polls,
        int incidents,
        int openIncidents) {}
