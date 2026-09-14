
package com.local.ar44.dto;

import java.util.List;

public class UpdateVideoRequest {
    private String title;
    private List<Long> creatorIds;
    private Integer sourceIndex;
    private List<String> creatorNames;
    private List<String> tags;
    private String comment;

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }

    public List<String> getTags() {
        return tags;
    }

    public void setTags(List<String> tags) {
        this.tags = tags;
    }


    public List<String> getCreatorNames() {
        return creatorNames;
    }
    public void setCreatorNames(List<String> creatorNames) {
        this.creatorNames = creatorNames;
    }
    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public List<Long> getCreatorIds() {
        return creatorIds;
    }

    public void setCreatorIds(List<Long> creatorIds) {
        this.creatorIds = creatorIds;
    }

    public Integer getSourceIndex() {
        return sourceIndex;
    }

    public void setSourceIndex(Integer sourceIndex) {
        this.sourceIndex = sourceIndex;
    }
}
