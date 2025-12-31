package com.photlas.backend.repository;

import com.photlas.backend.entity.UserSnsLink;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface UserSnsLinkRepository extends JpaRepository<UserSnsLink, Long> {
    List<UserSnsLink> findByUserId(Long userId);
    void deleteByUserId(Long userId);
}
