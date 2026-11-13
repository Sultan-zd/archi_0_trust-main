package com.ztb.evcharge.repo;

import com.ztb.evcharge.domain.ChargeSession;
import com.ztb.evcharge.domain.ChargeStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ChargeSessionRepository extends JpaRepository<ChargeSession, Long> {

    List<ChargeSession> findByUsernameOrderByStartedAtDesc(String username);

    List<ChargeSession> findTop100ByOrderByStartedAtDesc();

    Optional<ChargeSession> findFirstByUsernameAndStationIdAndStatusOrderByStartedAtDesc(
            String username, Long stationId, ChargeStatus status);

    boolean existsByStationIdAndStatus(Long stationId, ChargeStatus status);

    Optional<ChargeSession> findFirstByStationIdAndStatus(Long stationId, ChargeStatus status);

    long countByStatus(ChargeStatus status);

    @Query("select s.decision, count(s) from ChargeSession s where s.decision is not null group by s.decision")
    List<Object[]> countByDecision();
}
