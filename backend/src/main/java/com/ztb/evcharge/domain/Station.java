package com.ztb.evcharge.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Une borne de recharge. La ville sert de "zone" pour le risque contextuel du PDP (zone habituelle de l'utilisateur). */
@Entity
@Table(name = "stations")
public class Station {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String code;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String city;

    @Column(nullable = false)
    private double powerKw;

    protected Station() {
    }

    public Station(String code, String name, String city, double powerKw) {
        this.code = code;
        this.name = name;
        this.city = city;
        this.powerKw = powerKw;
    }

    public Long getId() {
        return id;
    }

    public String getCode() {
        return code;
    }

    public String getName() {
        return name;
    }

    public String getCity() {
        return city;
    }

    public double getPowerKw() {
        return powerKw;
    }
}
