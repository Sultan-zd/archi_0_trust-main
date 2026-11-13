package com.ztb.evcharge;

import com.ztb.evcharge.config.AppProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(AppProperties.class)
public class EvChargeApplication {

    public static void main(String[] args) {
        SpringApplication.run(EvChargeApplication.class, args);
    }
}
