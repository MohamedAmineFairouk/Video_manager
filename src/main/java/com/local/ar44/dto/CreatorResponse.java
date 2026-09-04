package com.local.ar44.dto;

import lombok.Data;

@Data
public class CreatorResponse {
    private Long id;
    private String name;

    public CreatorResponse() {
    }

    public CreatorResponse(Long id, String name) {
        this.id = id;
        this.name = name;
    }
}
