package com.photlas.backend.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Issue#106: IPアドレスからの国判定APIのレスポンスDTO
 * GET /api/v1/geo/my-country の戻り値
 */
@JsonInclude(JsonInclude.Include.ALWAYS)
public class GeoCountryResponse {

    @JsonProperty("countryCode")
    private String countryCode;

    public GeoCountryResponse() {
    }

    public GeoCountryResponse(String countryCode) {
        this.countryCode = countryCode;
    }

    public String getCountryCode() {
        return countryCode;
    }

    public void setCountryCode(String countryCode) {
        this.countryCode = countryCode;
    }
}
