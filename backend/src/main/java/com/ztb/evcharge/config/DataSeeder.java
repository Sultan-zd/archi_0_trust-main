package com.ztb.evcharge.config;

import com.ztb.evcharge.domain.Station;
import com.ztb.evcharge.repo.StationRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * Cree trois bornes de demonstration au premier demarrage.
 * Les utilisateurs de demo (alice, bob, root, eve) ont Lyon (ou Paris pour bob) comme zone habituelle :
 * charger a Paris ou a Marseille avec alice ajoute 25 points de risque ("zone inhabituelle"). Ce n'est pas
 * encore un MFA (seuil de charge:start = 30), mais chaque refus passe ajoute 5 points : apres un refus, le MFA se declenche.
 */
@Component
public class DataSeeder implements ApplicationRunner {

    private final StationRepository stations;

    public DataSeeder(StationRepository stations) {
        this.stations = stations;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (stations.count() > 0) {
            return;
        }
        stations.save(new Station("A", "Borne A", "Lyon", 22.0));
        stations.save(new Station("B", "Borne B", "Paris", 50.0));
        stations.save(new Station("C", "Borne C", "Marseille", 7.4));
    }
}
