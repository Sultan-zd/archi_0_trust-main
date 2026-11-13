from math import asin, cos, radians, sin, sqrt

from api import settings

CITY_COORDINATES = {
    "lyon": (45.7640, 4.8357),
    "marseille": (43.2965, 5.3698),
    "paris": (48.8566, 2.3522),
}


def timestamp_error(timestamp_ms: int, now_ms: int) -> str | None:
    if timestamp_ms <= now_ms - settings.REQUEST_MAX_AGE_SECONDS * 1000:
        return "horodatage trop ancien"
    if timestamp_ms > now_ms + settings.REQUEST_MAX_FUTURE_SKEW_SECONDS * 1000:
        return "horodatage dans le futur"
    return None


def impossible_travel_risk(
    previous_location: str | None,
    previous_at_ms: int | None,
    location: str | None,
    now_ms: int,
) -> tuple[int, str | None]:
    if not previous_location or previous_at_ms is None or not location:
        return 0, None

    previous = CITY_COORDINATES.get(previous_location.strip().casefold())
    current = CITY_COORDINATES.get(location.strip().casefold())
    if previous is None or current is None or previous == current:
        return 0, None

    lat1, lon1 = map(radians, previous)
    lat2, lon2 = map(radians, current)
    delta_lat = lat2 - lat1
    delta_lon = lon2 - lon1
    haversine = sin(delta_lat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(delta_lon / 2) ** 2
    distance_km = 6371 * 2 * asin(sqrt(haversine))
    elapsed_hours = (now_ms - previous_at_ms) / 3_600_000
    speed_kmh = float("inf") if elapsed_hours <= 0 else distance_km / elapsed_hours

    if speed_kmh <= settings.MAX_TRAVEL_SPEED_KMH:
        return 0, None

    speed = "indéterminée" if speed_kmh == float("inf") else f"{speed_kmh:.0f} km/h"
    reason = (
        f"déplacement impossible ({previous_location} → {location}, "
        f"vitesse estimée {speed}, maximum {settings.MAX_TRAVEL_SPEED_KMH} km/h) "
        f"+{settings.CONTEXT_RISK_IMPOSSIBLE_TRAVEL}"
    )
    return settings.CONTEXT_RISK_IMPOSSIBLE_TRAVEL, reason
