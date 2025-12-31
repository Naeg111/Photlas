package com.photlas.backend.controller;

import com.photlas.backend.dto.SpotResponse;
import com.photlas.backend.service.SpotService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/v1/spots")
public class SpotController {

    private static final Logger logger = LoggerFactory.getLogger(SpotController.class);

    @Autowired
    private SpotService spotService;

    @GetMapping
    public ResponseEntity<List<SpotResponse>> getSpots(
            @RequestParam BigDecimal north,
            @RequestParam BigDecimal south,
            @RequestParam BigDecimal east,
            @RequestParam BigDecimal west,
            @RequestParam(required = false) List<Integer> subject_categories,
            @RequestParam(required = false) List<Integer> months,
            @RequestParam(required = false) List<String> times_of_day,
            @RequestParam(required = false) List<String> weathers) {

        logger.info("GET /api/v1/spots - north={}, south={}, east={}, west={}, subject_categories={}, months={}, times_of_day={}, weathers={}",
                north, south, east, west, subject_categories, months, times_of_day, weathers);

        // 範囲パラメータのバリデーション
        if (north == null || south == null || east == null || west == null) {
            logger.warn("Missing required bounds parameters");
            return ResponseEntity.badRequest().build();
        }

        List<SpotResponse> spots = spotService.getSpots(north, south, east, west, subject_categories, months, times_of_day, weathers);

        return ResponseEntity.ok(spots);
    }
}
