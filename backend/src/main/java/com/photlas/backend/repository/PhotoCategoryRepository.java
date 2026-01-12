package com.photlas.backend.repository;

import com.photlas.backend.entity.PhotoCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PhotoCategoryRepository extends JpaRepository<PhotoCategory, PhotoCategory.PhotoCategoryId> {
}
