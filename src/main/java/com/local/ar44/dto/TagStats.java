package com.local.ar44.dto;

import lombok.Data;

@Data
public class TagStats {
    private String tag;
    private Long count;

    public TagStats(String tag, Long count) {
        this.tag = tag;
        this.count = count;
    }
}
