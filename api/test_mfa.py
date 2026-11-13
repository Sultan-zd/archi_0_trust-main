import base64
import tempfile
import unittest
from pathlib import Path

import pyotp

from api.mfa import PENDING_TTL_SECONDS, MfaError, MfaService
from api.pdp import UserProfiles


class Clock:
    def __init__(self, t=1_700_000_000.0):
        self.t = t

    def __call__(self):
        return self.t


class MfaServiceTest(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.path = Path(self.dir.name) / "users.json"
        self.profiles = UserProfiles(self.path)
        self.profiles.set("alice", {"home_location": "Lyon"})
        self.clock = Clock()
        self.mfa = MfaService(self.profiles, now=self.clock)

    def tearDown(self):
        self.dir.cleanup()

    def code(self, secret, offset=0):
        return pyotp.TOTP(secret).at(self.clock.t + offset)

    def activate(self):
        secret = self.mfa.enroll("alice")["secret"]
        self.mfa.confirm("alice", self.code(secret))
        self.clock.t += 30
        return secret

    def test_enroll_returns_secret_uri_and_svg_qr(self):
        out = self.mfa.enroll("alice")
        self.assertIn(f"secret={out['secret']}", out["otpauth_uri"])
        self.assertTrue(out["otpauth_uri"].startswith("otpauth://totp/AI-ZTB:alice"))
        svg = base64.b64decode(out["qr_svg"].split(",", 1)[1])
        self.assertIn(b"<svg", svg)
        self.assertFalse(self.mfa.status("alice")["enabled"])
        self.assertTrue(self.mfa.status("alice")["pending"])

    def test_pending_secret_is_not_accepted_for_access(self):
        secret = self.mfa.enroll("alice")["secret"]
        self.assertFalse(self.mfa.verify("alice", self.code(secret)))

    def test_confirm_with_valid_code_activates(self):
        secret = self.activate()
        st = self.mfa.status("alice")
        self.assertTrue(st["enabled"])
        self.assertFalse(st["pending"])
        self.assertTrue(self.mfa.verify("alice", self.code(secret)))

    def test_confirm_with_wrong_code_fails(self):
        self.mfa.enroll("alice")
        with self.assertRaises(MfaError) as ctx:
            self.mfa.confirm("alice", "000000")
        self.assertEqual(ctx.exception.status, 400)
        self.assertFalse(self.mfa.status("alice")["enabled"])

    def test_confirm_after_expiry_fails(self):
        secret = self.mfa.enroll("alice")["secret"]
        self.clock.t += PENDING_TTL_SECONDS + 1
        with self.assertRaises(MfaError) as ctx:
            self.mfa.confirm("alice", self.code(secret))
        self.assertEqual(ctx.exception.status, 409)

    def test_secret_is_not_reissued_after_activation(self):
        self.activate()
        with self.assertRaises(MfaError) as ctx:
            self.mfa.enroll("alice")
        self.assertEqual(ctx.exception.status, 409)
        with self.assertRaises(MfaError):
            self.mfa.enroll("alice", "000000")

    def test_renewal_requires_current_code_and_keeps_old_secret_until_confirmed(self):
        old = self.activate()
        new = self.mfa.enroll("alice", self.code(old))["secret"]
        self.assertNotEqual(old, new)
        self.clock.t += 30
        self.assertTrue(self.mfa.verify("alice", self.code(old)))  # ancien secret toujours actif
        self.clock.t += 30
        self.mfa.confirm("alice", self.code(new))
        self.clock.t += 30
        self.assertFalse(self.mfa.verify("alice", self.code(old)))
        self.assertTrue(self.mfa.verify("alice", self.code(new)))

    def test_code_cannot_be_replayed(self):
        secret = self.activate()
        code = self.code(secret)
        self.assertTrue(self.mfa.verify("alice", code))
        self.assertFalse(self.mfa.verify("alice", code))

    def test_confirmation_code_cannot_be_reused_for_access(self):
        secret = self.mfa.enroll("alice")["secret"]
        code = self.code(secret)
        self.mfa.confirm("alice", code)
        self.assertFalse(self.mfa.verify("alice", code))

    def test_legacy_admin_created_secret_is_ignored(self):
        legacy = pyotp.random_base32()
        self.profiles.set("bob", {"home_location": "Paris", "totp_secret": legacy})
        self.assertFalse(self.mfa.verify("bob", self.code(legacy)))
        st = self.mfa.status("bob")
        self.assertFalse(st["enabled"])
        self.assertTrue(st["needs_reactivation"])

    def test_admin_reset_disables_mfa(self):
        secret = self.activate()
        self.mfa.reset("alice")
        self.assertFalse(self.mfa.status("alice")["enabled"])
        self.assertFalse(self.mfa.verify("alice", self.code(secret)))
        self.assertNotIn("totp_secret", self.profiles.get("alice"))

    def test_state_persists_on_disk(self):
        self.activate()
        reloaded = MfaService(UserProfiles(self.path), now=self.clock)
        self.assertTrue(reloaded.status("alice")["enabled"])


if __name__ == "__main__":
    unittest.main()
