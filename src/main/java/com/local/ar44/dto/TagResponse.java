package com.local.ar44.dto;

import lombok.Data;

@Data
public class TagResponse {
    private Long id;
    private String name;

    public TagResponse() {
    }

    public TagResponse(Long id, String name) {
        this.id = id;
        this.name = name;
    }
}
