package com.ztb.evcharge.repo;

import com.ztb.evcharge.domain.Station;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StationRepository extends JpaRepository<Station, Long> {
}
