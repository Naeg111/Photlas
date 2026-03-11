package com.photlas.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

/**
 * Photlas バックエンドアプリケーション
 * Spring Bootアプリケーションのエントリーポイント
 */
@SpringBootApplication
@EnableAsync
public class PhotlasBackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(PhotlasBackendApplication.class, args);
	}

}
