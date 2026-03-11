package com.photlas.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Photlas バックエンドアプリケーション
 * Spring Bootアプリケーションのエントリーポイント
 */
@SpringBootApplication
@EnableAsync
@EnableScheduling
public class PhotlasBackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(PhotlasBackendApplication.class, args);
	}

}
