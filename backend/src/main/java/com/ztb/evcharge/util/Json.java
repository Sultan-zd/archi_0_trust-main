package com.ztb.evcharge.util;

import java.util.List;
import java.util.Map;

/** Petits utilitaires pour lire les reponses JSON (Map / List) de FastAPI et de Keycloak sans planter. */
public final class Json {

    private Json() {
    }

    @SuppressWarnings("unchecked")
    public static Map<String, Object> map(Object o) {
        return o instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
    }

    @SuppressWarnings("unchecked")
    public static List<Object> list(Object o) {
        return o instanceof List<?> l ? (List<Object>) l : List.of();
    }

    public static String str(Object o) {
        return o == null ? null : String.valueOf(o);
    }

    public static int integer(Object o, int fallback) {
        return o instanceof Number n ? n.intValue() : fallback;
    }

    public static boolean bool(Object o) {
        return Boolean.TRUE.equals(o);
    }
}
