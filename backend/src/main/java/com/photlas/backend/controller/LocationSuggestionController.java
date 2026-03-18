package com.photlas.backend.controller;

import com.photlas.backend.service.LocationSuggestionService;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Issue#65: 位置情報修正の指摘コントローラー（スタブ）
 */
@RestController
@RequestMapping("/api/v1")
public class LocationSuggestionController {

    private final LocationSuggestionService locationSuggestionService;

    public LocationSuggestionController(LocationSuggestionService locationSuggestionService) {
        this.locationSuggestionService = locationSuggestionService;
    }
}
