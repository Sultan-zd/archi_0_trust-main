"""Activation de la MFA (TOTP) par l'utilisateur lui-meme.

Cycle de vie du secret, stocke dans le profil hors chaine (UserProfiles) :
  1. enroll()  : un secret "en attente" est genere et renvoye UNE fois (secret + URI otpauth + QR code)
                 au proprietaire du compte, identifie par son JWT ;
  2. confirm() : l'utilisateur saisit un premier code genere par son application ; s'il est valide,
                 le secret devient actif (mfa_enabled = True) et n'est plus jamais renvoye ;
  3. verify()  : verification d'un code lors d'une decision MFA (uniquement si la MFA est activee).

Renouvellement : un utilisateur deja active peut demander un nouveau secret en fournissant un code
valide de l'ancien. L'ancien secret reste actif tant que le nouveau n'est pas confirme.

Les profils crees avant cette fonctionnalite ont un "totp_secret" sans "mfa_enabled" : ce secret
(connu de l'admin dans l'ancienne version) est considere comme compromis et ignore. L'utilisateur
doit reactiver la MFA.
"""
import base64
import io
import time

import pyotp
import qrcode
import qrcode.image.svg

ISSUER = "AI-ZTB"
PENDING_TTL_SECONDS = 10 * 60


class MfaError(Exception):
    """Erreur metier, traduite en HTTP par api/main.py."""

    def __init__(self, status: int, detail: str):
        super().__init__(detail)
        self.status = status
        self.detail = detail


def qr_svg_data_uri(text: str) -> str:
    img = qrcode.make(text, image_factory=qrcode.image.svg.SvgPathImage, border=2, box_size=10)
    buf = io.BytesIO()
    img.save(buf)
    return "data:image/svg+xml;base64," + base64.b64encode(buf.getvalue()).decode()


class MfaService:
    def __init__(self, profiles, now=time.time):
        self.profiles = profiles
        self.now = now

    # ------------------------------------------------------------------ etat
    def enabled(self, user: str) -> bool:
        p = self.profiles.get(user)
        return bool(p.get("mfa_enabled") and p.get("totp_secret"))

    def status(self, user: str) -> dict:
        p = self.profiles.get(user)
        enabled = self.enabled(user)
        pending = self._pending(p) is not None
        return {
            "user": user,
            "enabled": enabled,
            "enabled_at": p.get("mfa_enabled_at") if enabled else None,
            "pending": pending,
            # Ancien secret (cree par l'admin, avant l'activation par QR code) : reactivation requise.
            "needs_reactivation": bool(not enabled and p.get("totp_secret")),
        }

    # ------------------------------------------------------------------ verification
    def verify(self, user: str, otp: str | None) -> bool:
        if not otp or not self.enabled(user):
            return False
        return self._check(self.profiles.get(user)["totp_secret"], otp, user, "active")

    # ------------------------------------------------------------------ activation
    def enroll(self, user: str, current_otp: str | None = None) -> dict:
        if self.enabled(user) and not self.verify(user, current_otp):
            raise MfaError(409, "MFA deja activee : saisissez un code valide de votre application actuelle pour la renouveler")
        secret = pyotp.random_base32()
        self.profiles.update(user, totp_pending={"secret": secret, "created_at": int(self.now())})
        uri = pyotp.TOTP(secret).provisioning_uri(name=user, issuer_name=ISSUER)
        return {
            "user": user,
            "issuer": ISSUER,
            "secret": secret,
            "otpauth_uri": uri,
            "qr_svg": qr_svg_data_uri(uri),
            "expires_in_seconds": PENDING_TTL_SECONDS,
        }

    def confirm(self, user: str, otp: str | None) -> dict:
        pending = self._pending(self.profiles.get(user))
        if pending is None:
            raise MfaError(409, "Aucune activation en cours (ou activation expiree) : relancez l'activation")
        if not otp or not self._check(pending["secret"], otp, user, "pending"):
            raise MfaError(400, "Code incorrect : verifiez l'heure de votre telephone et reessayez")
        self.profiles.update(
            user,
            totp_secret=pending["secret"],
            mfa_enabled=True,
            mfa_enabled_at=int(self.now()),
            totp_pending=None,
            # Le code de confirmation ne pourra pas etre reutilise pour une demande d'acces.
            totp_last_active_counter=self.profiles.get(user).get("totp_last_pending_counter"),
        )
        return self.status(user)

    def reset(self, user: str) -> dict:
        """Admin (perte du telephone) : desactive la MFA, l'utilisateur devra la reactiver."""
        self.profiles.update(user, totp_secret=None, mfa_enabled=False, mfa_enabled_at=None, totp_pending=None)
        return self.status(user)

    # ------------------------------------------------------------------ interne
    def _pending(self, profile: dict) -> dict | None:
        p = profile.get("totp_pending")
        if not p or self.now() - p.get("created_at", 0) > PENDING_TTL_SECONDS:
            return None
        return p

    def _check(self, secret: str, otp: str, user: str, kind: str) -> bool:
        otp = otp.strip().replace(" ", "")
        totp = pyotp.TOTP(secret)
        now = self.now()
        # Fenetre de +/- 30 s pour tolerer un leger decalage d'horloge du telephone.
        for step in (-1, 0, 1):
            t = now + step * totp.interval
            if totp.verify(otp, for_time=t):
                # Anti-rejeu : un code deja accepte (meme pas de 30 s) est refuse.
                counter = int(t // totp.interval)
                key = f"totp_last_{kind}_counter"
                last = self.profiles.get(user).get(key)
                if last is not None and counter <= last:
                    return False
                self.profiles.update(user, **{key: counter})
                return True
        return False
