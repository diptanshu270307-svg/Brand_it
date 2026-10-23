import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .db import get_db
from .models import AuditEvent, Brand, Membership, User

ROLES = ("creator", "reviewer", "senior_reviewer", "brand_owner")
REVIEW_ROLES = ("reviewer", "senior_reviewer", "brand_owner")


def hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 120_000)
    return salt.hex() + "$" + digest.hex()


def verify_password(password: str, stored: str) -> bool:
    try:
        salt_hex, digest_hex = stored.split("$")
    except ValueError:
        return False
    candidate = hash_password(password, bytes.fromhex(salt_hex)).split("$")[1]
    return hmac.compare_digest(candidate, digest_hex)


def create_token(user: User) -> str:
    s = get_settings()
    exp = datetime.now(timezone.utc) + timedelta(minutes=s.token_ttl_minutes)
    return jwt.encode({"sub": str(user.id), "exp": exp}, s.secret_key, algorithm="HS256")


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer "):
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(header[7:], get_settings().secret_key, algorithms=["HS256"])
        user = db.get(User, int(payload["sub"]))
    except Exception:
        raise HTTPException(401, "Invalid or expired token")
    if not user:
        raise HTTPException(401, "Unknown user")
    return user


def membership_for(db: Session, user: User, brand_id: int) -> Membership:
    """Brand access check. Non-members get 404 so brand existence is not leaked."""
    m = db.scalar(select(Membership).where(Membership.user_id == user.id, Membership.brand_id == brand_id))
    if not m:
        raise HTTPException(404, "Brand not found")
    return m


def require_role(m: Membership, *roles: str) -> None:
    if m.role not in roles:
        raise HTTPException(403, f"Requires role: {', '.join(roles)} (you are {m.role})")


def get_brand(db: Session, brand_id: int) -> Brand:
    b = db.get(Brand, brand_id)
    if not b:
        raise HTTPException(404, "Brand not found")
    return b


def audit(db: Session, brand_id: int, user_id: int | None, action: str, draft_id: int | None = None,
          details: dict | None = None, seeded: bool = False) -> AuditEvent:
    """Record an audit event. `details` must not contain draft text (ids/counts/hashes only)."""
    ev = AuditEvent(brand_id=brand_id, draft_id=draft_id, user_id=user_id, action=action,
                    details=details or {}, seeded=seeded)
    db.add(ev)
    return ev
