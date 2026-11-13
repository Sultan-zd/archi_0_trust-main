import unittest

from api.request_security import impossible_travel_risk, timestamp_error


class RequestSecurityTest(unittest.TestCase):
    def test_timestamp_accepts_the_window_and_rejects_old_or_future_requests(self):
        now_ms = 1_000_000

        self.assertIsNone(timestamp_error(now_ms - 29_999, now_ms))
        self.assertEqual(timestamp_error(now_ms - 30_000, now_ms), "horodatage trop ancien")
        self.assertIsNone(timestamp_error(now_ms + 5_000, now_ms))
        self.assertEqual(timestamp_error(now_ms + 5_001, now_ms), "horodatage dans le futur")

    def test_impossible_travel_adds_context_risk_for_lyon_to_marseille_in_five_minutes(self):
        risk, reason = impossible_travel_risk(
            "Lyon",
            1_000_000,
            "Marseille",
            1_000_000 + 5 * 60 * 1000,
        )

        self.assertEqual(risk, 50)
        self.assertIn("Lyon → Marseille", reason)
        self.assertIn("maximum 150 km/h", reason)

    def test_impossible_travel_ignores_plausible_or_unknown_locations(self):
        plausible_risk, plausible_reason = impossible_travel_risk(
            "Lyon",
            1_000_000,
            "Marseille",
            1_000_000 + 3 * 60 * 60 * 1000,
        )
        unknown_risk, unknown_reason = impossible_travel_risk(
            "Lyon",
            1_000_000,
            "Unknown City",
            1_000_000 + 60_000,
        )

        self.assertEqual((plausible_risk, plausible_reason), (0, None))
        self.assertEqual((unknown_risk, unknown_reason), (0, None))


if __name__ == "__main__":
    unittest.main()
