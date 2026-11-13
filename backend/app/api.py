"""HTTP API. Every brand-scoped route calls membership_for() first (brand access check)."""
from datetime import date, datetime, timedelta
import secrets

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import insights as ins
from . import library as lib
from . import service as svc
from .analysis.evidence import evidence_state
from .config import get_settings
from .db import get_db
from .llm import privacy_notice
from .mail import get_mail_adapter
from .models import (
    AnalysisJob,
    AppNotification,
    AuditEvent,
    BenchmarkCache,
    Brand,
    BrandSetupProgress,
    Company,
    CompanyInvitation,
    CompanyMembership,
    Disposition,
    Draft,
    EvidenceRecord,
    Finding,
    GuidelineProposal,
    Membership,
    ReviewDecision,
    Rule,
    SourceDocument,
    User,
    utcnow,
)
from .security import (
    REVIEW_ROLES,
    ROLE_DESCRIPTIONS,
    audit,
    clear_auth_cookies,
    clear_failed_login,
    company_membership_for,
    consume_recovery_token,
    create_recovery_token,
    create_session,
    create_token,
    current_user,
    generate_csrf_token,
    get_session_cookie,
    hash_password,
    hash_token,
    is_login_throttled,
    is_recovery_throttled,
    membership_for,
    logout_request_sessions,
    record_failed_login,
    record_recovery_attempt,
    require_company_role,
    require_role,
    revoke_all_user_sessions,
    set_auth_cookies,
    validate_password_policy,
    verify_password,
)
from .throttling import check_rate_limit

router = APIRouter(prefix="/api")


# ------------------------------------------------------------------ auth / brands
class LoginIn(BaseModel):
    email: str
    password: str


class RegisterIn(BaseModel):
    name: str
    email: str
    password: str


class ForgotPasswordIn(BaseModel):
    email: str


class ResetPasswordIn(BaseModel):
    token: str
    new_password: str


class DemoSwitchIn(BaseModel):
    email: str


@router.post("/auth/register")
def register(body: RegisterIn, request: Request, response: Response, db: Session = Depends(get_db)):
    settings = get_settings()
    client_ip = request.client.host if request.client else "unknown"
    email = body.email.strip().lower()
    name = body.name.strip()

    check_rate_limit(
        f"signup:ip:{client_ip}", settings.auth_ip_max_failed_attempts,
        settings.auth_throttle_window_seconds,
        "Too many registration attempts. Please try again later.",
    )

    if not email or "@" not in email or "." not in email:
        raise HTTPException(422, "Please enter a valid email address.")
    validate_password_policy(body.password)
    if not name:
        raise HTTPException(422, "Name is required.")

    if settings.is_production and email.endswith(".demo"):
        raise HTTPException(403, "Demo accounts are disabled in production.")

    existing = db.scalar(select(User).where(User.email == email))
    if existing:
        raise HTTPException(400, "An account with this email already exists.")

    user = User(
        name=name,
        email=email,
        password_hash=hash_password(body.password),
    )
    db.add(user)
    db.flush()

    sess, raw_session_token, csrf_token = create_session(db, user.id)
    db.commit()
    set_auth_cookies(response, raw_session_token, csrf_token)

    return {
        "status": "registered",
        "token": raw_session_token,
        "csrf_token": csrf_token,
        "user": {"id": user.id, "name": user.name, "email": user.email},
    }


@router.post("/auth/login")
def login(body: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)):
    settings = get_settings()
    client_ip = request.client.host if request.client else "unknown"
    email = body.email.strip().lower()

    if is_login_throttled(client_ip, email):
        raise HTTPException(429, "Too many failed attempts. Please try again later.")

    if settings.is_production and email.endswith(".demo"):
        raise HTTPException(403, "Demo accounts are disabled in production.")

    user = db.scalar(select(User).where(User.email == email))
    is_valid, needs_rehash = verify_password(body.password, user.password_hash if user else None)
    if not user or not is_valid:
        record_failed_login(client_ip, email)
        raise HTTPException(401, "Invalid email or password")

    clear_failed_login(client_ip, email)

    # Automatically upgrade valid legacy hashes to maintained Argon2id
    if needs_rehash:
        user.password_hash = hash_password(body.password)
        db.commit()

    # Create server-stored revocable session and issue HttpOnly + CSRF cookies
    sess, raw_session_token, csrf_token = create_session(db, user.id)
    db.commit()
    set_auth_cookies(response, raw_session_token, csrf_token)

    return {
        "token": raw_session_token,
        "csrf_token": csrf_token,
        "user": {"id": user.id, "name": user.name, "email": user.email},
    }


@router.post("/auth/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    logout_request_sessions(request, db)
    clear_auth_cookies(response)
    return {"status": "logged_out"}


@router.post("/auth/forgot-password")
def forgot_password(body: ForgotPasswordIn, request: Request, db: Session = Depends(get_db)):
    settings = get_settings()
    client_ip = request.client.host if request.client else "unknown"
    email = body.email.strip().lower()

    if is_recovery_throttled(client_ip, email):
        raise HTTPException(429, "Too many recovery attempts. Please try again later.")

    record_recovery_attempt(client_ip, email)

    user = db.scalar(select(User).where(User.email == email))
    if user:
        raw_token = create_recovery_token(db, user.id)
        # Token is placed in URL fragment so it stays on client and never reaches web server access logs
        reset_url = f"{settings.public_base_url.rstrip('/')}/#reset-token={raw_token}"
        mail_adapter = get_mail_adapter()
        mail_adapter.send_recovery_email(user.email, reset_url)

    # Generic response: avoids leaking whether email exists (OWASP Account Enumeration prevention)
    return {
        "status": "ok",
        "message": "If that email is registered, recovery instructions have been sent.",
    }


@router.post("/auth/reset-password")
def reset_password(body: ResetPasswordIn, response: Response, db: Session = Depends(get_db)):
    pwd = body.new_password
    validate_password_policy(pwd)

    user_id = consume_recovery_token(db, body.token)
    if not user_id:
        raise HTTPException(400, "Invalid or expired recovery token.")

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(400, "User not found.")

    # Hash new password with Argon2id
    user.password_hash = hash_password(pwd)
    db.commit()

    # Invalidate all existing sessions after password reset
    revoke_all_user_sessions(db, user_id, reason="password_reset")
    clear_auth_cookies(response)

    return {"status": "ok", "message": "Password updated successfully. Please sign in with your new password."}


@router.post("/auth/demo-switch")
def demo_switch(body: DemoSwitchIn, response: Response, db: Session = Depends(get_db)):
    settings = get_settings()
    if not settings.allow_demo_personas:
        raise HTTPException(403, "Persona switching is disabled in production.")

    email = body.email.strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    if not user:
        raise HTTPException(404, "Demo persona not found.")

    sess, raw_session_token, csrf_token = create_session(db, user.id)
    db.commit()
    set_auth_cookies(response, raw_session_token, csrf_token)

    return {
        "token": raw_session_token,
        "csrf_token": csrf_token,
        "user": {"id": user.id, "name": user.name, "email": user.email},
    }


@router.get("/auth/session")
def get_session_info(request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    session_cookie = get_session_cookie(request)
    if not session_cookie and request.headers.get("authorization", "").lower().startswith("bearer "):
        session_cookie = request.headers.get("authorization", "")[7:].strip()
    csrf = generate_csrf_token(session_cookie) if session_cookie else ""
    return {
        "authenticated": True,
        "csrf_token": csrf,
        "user": {"id": user.id, "name": user.name, "email": user.email},
    }


@router.get("/system/mode")
def system_mode():
    s = get_settings()
    return {
        "mode": s.app_mode,
        "is_production": s.is_production,
        "is_demo": s.is_demo,
        "allow_reset": s.is_isolated_demo_db() and not s.is_production,
        "allow_persona_switch": s.is_demo,
    }


@router.get("/me")
def me(request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    # 1. Company workspaces the user belongs to
    cms = db.scalars(select(CompanyMembership).where(CompanyMembership.user_id == user.id)).all()
    companies = []
    for cm in cms:
        comp = db.get(Company, cm.company_id)
        if comp:
            comp_brands = db.scalars(select(Brand).where(Brand.company_id == comp.id)).all()
            companies.append({
                "id": comp.id,
                "name": comp.name,
                "slug": comp.slug,
                "role": cm.role,
                "role_label": ROLE_DESCRIPTIONS.get(cm.role, {}).get("label", cm.role),
                "created_at": comp.created_at.isoformat(),
                "settings": comp.settings,
                "brands": [
                    {
                        "id": b.id,
                        "name": b.name,
                        "description": b.description,
                        "role": cm.role,
                        "protected_terms": b.protected_terms,
                    }
                    for b in comp_brands
                ],
            })

    # 2. Direct brand memberships (for backward compatibility)
    ms = db.scalars(select(Membership).where(Membership.user_id == user.id)).all()
    brands = []
    for m in ms:
        b = db.get(Brand, m.brand_id)
        if b:
            brands.append({
                "id": b.id,
                "name": b.name,
                "description": b.description,
                "role": m.role,
                "company_id": b.company_id,
                "protected_terms": b.protected_terms,
            })

    session_cookie = get_session_cookie(request)
    if not session_cookie and request.headers.get("authorization", "").lower().startswith("bearer "):
        session_cookie = request.headers.get("authorization", "")[7:].strip()
    csrf = generate_csrf_token(session_cookie) if session_cookie else ""
    return {
        "user": {"id": user.id, "name": user.name, "email": user.email},
        "companies": companies,
        "brands": brands,
        "roles": ROLE_DESCRIPTIONS,
        "privacy": privacy_notice(),
        "csrf_token": csrf,
    }


@router.get("/roles")
def list_roles():
    """Explain workspace roles and permissions in plain language."""
    return ROLE_DESCRIPTIONS


# ------------------------------------------------------------------ company workspaces & team admin
class CompanyUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    settings: dict | None = None


class CompanyCreateIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    brand_name: str | None = Field(default=None, max_length=200)


class InviteIn(BaseModel):
    email: str
    role: str


class RoleUpdateIn(BaseModel):
    role: str


class AcceptInviteIn(BaseModel):
    token: str
    name: str | None = None
    password: str | None = None


@router.get("/companies")
def list_companies(user: User = Depends(current_user), db: Session = Depends(get_db)):
    """List all company workspaces the authenticated user belongs to (for workspace switcher)."""
    cms = db.scalars(select(CompanyMembership).where(CompanyMembership.user_id == user.id)).all()
    result = []
    for cm in cms:
        comp = db.get(Company, cm.company_id)
        if comp:
            brands = db.scalars(select(Brand).where(Brand.company_id == comp.id)).all()
            result.append({
                "id": comp.id,
                "name": comp.name,
                "slug": comp.slug,
                "role": cm.role,
                "role_label": ROLE_DESCRIPTIONS.get(cm.role, {}).get("label", cm.role),
                "created_at": comp.created_at.isoformat(),
                "settings": comp.settings,
                "brands": [
                    {"id": b.id, "name": b.name, "description": b.description, "role": cm.role, "protected_terms": b.protected_terms}
                    for b in brands
                ],
            })
    return result


@router.post("/companies")
def create_company(body: CompanyCreateIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Create a new company workspace and default brand. The creator becomes Brand Owner."""
    clean_name = body.name.strip()
    import re
    base_slug = re.sub(r"[^a-z0-9]+", "-", clean_name.lower()).strip("-") or f"company-{secrets.token_hex(4)}"
    slug = base_slug
    suffix = 1
    while db.scalar(select(Company).where(Company.slug == slug)):
        slug = f"{base_slug}-{suffix}"
        suffix += 1

    company = Company(name=clean_name, slug=slug, settings={"plan": "enterprise"})
    db.add(company)
    db.flush()

    cm = CompanyMembership(company_id=company.id, user_id=user.id, role="brand_owner")
    db.add(cm)
    db.flush()

    b_name = body.brand_name.strip() if body.brand_name and body.brand_name.strip() else clean_name
    brand = Brand(company_id=company.id, name=b_name, description=f"Default brand for {clean_name}")
    db.add(brand)
    db.flush()

    bm = Membership(brand_id=brand.id, user_id=user.id, role="brand_owner")
    db.add(bm)

    setup = BrandSetupProgress(brand_id=brand.id, company_id=company.id, current_step="guidelines")
    db.add(setup)
    db.commit()

    return {
        "company": {"id": company.id, "name": company.name, "slug": company.slug},
        "brand": {"id": brand.id, "name": brand.name},
    }


@router.get("/companies/{company_id}")
def get_company(company_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    cm = company_membership_for(db, user, company_id)
    comp = db.get(Company, company_id)
    brands = db.scalars(select(Brand).where(Brand.company_id == comp.id)).all()
    members_count = db.scalar(
        select(func.count(CompanyMembership.id)).where(CompanyMembership.company_id == company_id)
    ) or 0
    return {
        "id": comp.id,
        "name": comp.name,
        "slug": comp.slug,
        "created_at": comp.created_at.isoformat(),
        "settings": comp.settings,
        "my_role": cm.role,
        "members_count": members_count,
        "brands": [
            {"id": b.id, "name": b.name, "description": b.description, "role": cm.role, "protected_terms": b.protected_terms}
            for b in brands
        ],
    }


@router.put("/companies/{company_id}")
def update_company(company_id: int, body: CompanyUpdateIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    cm = company_membership_for(db, user, company_id)
    require_company_role(cm, "brand_owner")
    comp = db.get(Company, company_id)
    if body.name:
        comp.name = body.name.strip()
    if body.settings is not None:
        comp.settings = {**comp.settings, **body.settings}
    db.commit()
    return {"id": comp.id, "name": comp.name, "slug": comp.slug, "settings": comp.settings}


@router.get("/companies/{company_id}/members")
def list_company_members(company_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    company_membership_for(db, user, company_id)
    cms = db.scalars(
        select(CompanyMembership)
        .where(CompanyMembership.company_id == company_id)
        .order_by(CompanyMembership.id)
    ).all()
    members = []
    for m in cms:
        u = db.get(User, m.user_id)
        if u:
            role_meta = ROLE_DESCRIPTIONS.get(m.role, {})
            members.append({
                "id": m.id,
                "user_id": u.id,
                "name": u.name,
                "email": u.email,
                "role": m.role,
                "role_label": role_meta.get("label", m.role),
                "role_description": role_meta.get("description", ""),
                "created_at": m.created_at.isoformat(),
            })
    return members


@router.put("/companies/{company_id}/members/{target_user_id}")
def update_member_role(
    company_id: int,
    target_user_id: int,
    body: RoleUpdateIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    cm = company_membership_for(db, user, company_id)
    require_company_role(cm, "brand_owner")
    if body.role not in ROLE_DESCRIPTIONS:
        raise HTTPException(422, f"Invalid role '{body.role}'. Must be one of: {', '.join(ROLE_DESCRIPTIONS.keys())}")

    target_cm = db.scalar(
        select(CompanyMembership).where(
            CompanyMembership.company_id == company_id,
            CompanyMembership.user_id == target_user_id,
        )
    )
    if not target_cm:
        raise HTTPException(404, "Member not found in this company workspace")

    # Final owner protection
    if target_cm.role == "brand_owner" and body.role != "brand_owner":
        owner_count = (
            db.scalar(
                select(func.count(CompanyMembership.id)).where(
                    CompanyMembership.company_id == company_id,
                    CompanyMembership.role == "brand_owner",
                )
            )
            or 0
        )
        if owner_count <= 1:
            raise HTTPException(400, "Cannot demote the final owner of the company workspace.")

    target_cm.role = body.role
    # Synchronize brand memberships in this company immediately
    brands = db.scalars(select(Brand).where(Brand.company_id == company_id)).all()
    for b in brands:
        bm = db.scalar(select(Membership).where(Membership.brand_id == b.id, Membership.user_id == target_user_id))
        if bm:
            bm.role = body.role
    db.commit()
    return {"status": "ok", "user_id": target_user_id, "role": body.role}


@router.delete("/companies/{company_id}/members/{target_user_id}")
def remove_member(
    company_id: int,
    target_user_id: int,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    cm = company_membership_for(db, user, company_id)
    require_company_role(cm, "brand_owner")

    target_cm = db.scalar(
        select(CompanyMembership).where(
            CompanyMembership.company_id == company_id,
            CompanyMembership.user_id == target_user_id,
        )
    )
    if not target_cm:
        raise HTTPException(404, "Member not found in this company workspace")

    # Final owner protection
    if target_cm.role == "brand_owner":
        owner_count = (
            db.scalar(
                select(func.count(CompanyMembership.id)).where(
                    CompanyMembership.company_id == company_id,
                    CompanyMembership.role == "brand_owner",
                )
            )
            or 0
        )
        if owner_count <= 1:
            raise HTTPException(400, "Cannot remove the final owner of the company workspace.")

    db.delete(target_cm)
    # Remove all brand memberships for this company
    brands = db.scalars(select(Brand).where(Brand.company_id == company_id)).all()
    for b in brands:
        bm = db.scalar(select(Membership).where(Membership.brand_id == b.id, Membership.user_id == target_user_id))
        if bm:
            db.delete(bm)
    db.commit()
    return {"status": "removed", "user_id": target_user_id}


@router.post("/companies/{company_id}/invitations")
def create_invitation(
    company_id: int,
    body: InviteIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    cm = company_membership_for(db, user, company_id)
    require_company_role(cm, "brand_owner")

    email = body.email.strip().lower()
    if "@" not in email or "." not in email:
        raise HTTPException(422, "Please enter a valid email address.")
    if body.role not in ROLE_DESCRIPTIONS:
        raise HTTPException(422, f"Invalid role '{body.role}'. Must be one of: {', '.join(ROLE_DESCRIPTIONS.keys())}")

    comp = db.get(Company, company_id)

    # Check if already a member
    existing_user = db.scalar(select(User).where(User.email == email))
    if existing_user:
        existing_cm = db.scalar(
            select(CompanyMembership).where(
                CompanyMembership.company_id == company_id,
                CompanyMembership.user_id == existing_user.id,
            )
        )
        if existing_cm:
            raise HTTPException(400, f"{email} is already a member of this workspace.")

    # Invalidate previous active invitation if any
    now = utcnow()
    active_inv = db.scalar(
        select(CompanyInvitation).where(
            CompanyInvitation.company_id == company_id,
            CompanyInvitation.email == email,
            CompanyInvitation.accepted_at.is_(None),
            CompanyInvitation.revoked_at.is_(None),
            CompanyInvitation.expires_at > now,
        )
    )
    if active_inv:
        active_inv.revoked_at = now

    raw_token = secrets.token_urlsafe(32)
    token_h = hash_token(raw_token)
    expires_at = now + timedelta(days=7)

    inv = CompanyInvitation(
        company_id=company_id,
        email=email,
        role=body.role,
        token_hash=token_h,
        invited_by_id=user.id,
        created_at=now,
        expires_at=expires_at,
    )
    db.add(inv)
    db.commit()

    settings = get_settings()
    invite_url = f"{settings.public_base_url.rstrip('/')}/#invite-token={raw_token}"
    role_label = ROLE_DESCRIPTIONS[body.role]["label"]
    mail_adapter = get_mail_adapter()
    mail_adapter.send_invitation_email(email, comp.name, role_label, invite_url)

    return {
        "id": inv.id,
        "email": inv.email,
        "role": inv.role,
        "role_label": role_label,
        "expires_at": inv.expires_at.isoformat(),
        "invite_url": invite_url,
        "token": raw_token,
    }


@router.get("/companies/{company_id}/invitations")
def list_company_invitations(
    company_id: int,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    cm = company_membership_for(db, user, company_id)
    require_company_role(cm, "brand_owner")
    invs = db.scalars(
        select(CompanyInvitation)
        .where(CompanyInvitation.company_id == company_id)
        .order_by(CompanyInvitation.id.desc())
    ).all()
    now = utcnow()
    result = []
    for inv in invs:
        if inv.accepted_at:
            status = "accepted"
        elif inv.revoked_at:
            status = "revoked"
        elif now > inv.expires_at:
            status = "expired"
        else:
            status = "pending"
        result.append({
            "id": inv.id,
            "email": inv.email,
            "role": inv.role,
            "role_label": ROLE_DESCRIPTIONS.get(inv.role, {}).get("label", inv.role),
            "created_at": inv.created_at.isoformat(),
            "expires_at": inv.expires_at.isoformat(),
            "accepted_at": inv.accepted_at.isoformat() if inv.accepted_at else None,
            "revoked_at": inv.revoked_at.isoformat() if inv.revoked_at else None,
            "status": status,
        })
    return result


@router.delete("/companies/{company_id}/invitations/{invitation_id}")
def revoke_invitation(
    company_id: int,
    invitation_id: int,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    cm = company_membership_for(db, user, company_id)
    require_company_role(cm, "brand_owner")
    inv = db.get(CompanyInvitation, invitation_id)
    if not inv or inv.company_id != company_id:
        raise HTTPException(404, "Invitation not found")
    if inv.accepted_at:
        raise HTTPException(400, "Cannot revoke an invitation that has already been accepted.")
    inv.revoked_at = utcnow()
    db.commit()
    return {"status": "revoked", "id": invitation_id}


@router.get("/invitations/{token}")
def inspect_invitation(token: str, db: Session = Depends(get_db)):
    """Inspect invitation token details without accepting (for frontend preview modal)."""
    token_h = hash_token(token)
    inv = db.scalar(select(CompanyInvitation).where(CompanyInvitation.token_hash == token_h))
    if not inv:
        raise HTTPException(404, "Invitation not found or invalid.")
    now = utcnow()
    if inv.revoked_at:
        raise HTTPException(400, "This invitation has been revoked.")
    if inv.accepted_at:
        raise HTTPException(400, "This invitation has already been used.")
    if now > inv.expires_at:
        raise HTTPException(400, "This invitation has expired.")

    comp = db.get(Company, inv.company_id)
    role_info = ROLE_DESCRIPTIONS.get(inv.role, {})
    return {
        "email": inv.email,
        "company_name": comp.name if comp else "Unknown Workspace",
        "role": inv.role,
        "role_label": role_info.get("label", inv.role),
        "role_description": role_info.get("description", ""),
        "permissions": role_info.get("permissions", []),
        "expires_at": inv.expires_at.isoformat(),
    }


@router.post("/invitations/accept")
def accept_invitation(
    body: AcceptInviteIn,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    token_h = hash_token(body.token)
    inv = db.scalar(select(CompanyInvitation).where(CompanyInvitation.token_hash == token_h))
    if not inv:
        raise HTTPException(404, "Invitation not found or invalid.")
    now = utcnow()
    if inv.revoked_at:
        raise HTTPException(400, "This invitation has been revoked.")
    if inv.accepted_at:
        raise HTTPException(400, "This invitation has already been accepted and cannot be reused.")
    if now > inv.expires_at:
        raise HTTPException(400, "This invitation has expired.")

    # Determine user: currently authenticated user or new account
    user = None
    try:
        user = current_user(request, db)
    except Exception:
        user = None

    if not user:
        user = db.scalar(select(User).where(User.email == inv.email.strip().lower()))
        if not user:
            if not body.password or len(body.password) < 8:
                raise HTTPException(422, "A password with at least 8 characters is required to accept this invitation.")
            user_name = body.name.strip() if body.name else inv.email.split("@")[0].capitalize()
            user = User(
                name=user_name,
                email=inv.email.strip().lower(),
                password_hash=hash_password(body.password),
            )
            db.add(user)
            db.flush()

    # Create company membership
    existing_cm = db.scalar(
        select(CompanyMembership).where(
            CompanyMembership.company_id == inv.company_id,
            CompanyMembership.user_id == user.id,
        )
    )
    if not existing_cm:
        cm = CompanyMembership(company_id=inv.company_id, user_id=user.id, role=inv.role)
        db.add(cm)

    # Grant membership on company brands
    brands = db.scalars(select(Brand).where(Brand.company_id == inv.company_id)).all()
    for b in brands:
        existing_bm = db.scalar(select(Membership).where(Membership.brand_id == b.id, Membership.user_id == user.id))
        if not existing_bm:
            bm = Membership(brand_id=b.id, user_id=user.id, role=inv.role)
            db.add(bm)

    inv.accepted_at = now
    db.commit()

    # Issue session cookie
    sess, raw_session_token, csrf_token = create_session(db, user.id)
    db.commit()
    set_auth_cookies(response, raw_session_token, csrf_token)

    comp = db.get(Company, inv.company_id)
    return {
        "status": "accepted",
        "company": {"id": comp.id, "name": comp.name, "slug": comp.slug},
        "role": inv.role,
        "user": {"id": user.id, "name": user.name, "email": user.email},
        "token": raw_session_token,
        "csrf_token": csrf_token,
    }


@router.get("/privacy")
def privacy():
    return privacy_notice()


# ------------------------------------------------------------------ brand library
def rule_view(r: Rule) -> dict:
    d = r.source_document
    return {"id": r.id, "key": r.key, "version": r.version, "ref": r.ref, "status": r.status, "title": r.title,
            "category": r.category, "severity": r.severity, "text": r.text, "sensitive": r.sensitive,
            "matchers": len(r.matchers or []), "banned": [m.get("message") for m in (r.matchers or [])][:3],
            "source": ({"document_id": d.id, "title": d.title, "version": d.version, "page": r.source_page} if d else None),
            "excerpt": r.source_excerpt}


def doc_view(d: SourceDocument, with_pages: bool = False) -> dict:
    v = {"id": d.id, "kind": d.kind, "title": d.title, "version": d.version, "pages": len(d.pages),
         "expires_on": d.expires_on.isoformat() if d.expires_on else None, "suspicious": d.suspicious,
         "suspicious_notes": d.suspicious_notes, "seeded": d.seeded, "created_at": d.created_at.isoformat()}
    if with_pages:
        v["page_text"] = d.pages
    return v


# ------------------------------------------------------------------ guided setup & onboarding
class SkipStepIn(BaseModel):
    step: str


def compute_brand_setup(db: Session, brand: Brand, user: User, m: Membership) -> dict:
    progress = db.scalar(select(BrandSetupProgress).where(BrandSetupProgress.brand_id == brand.id))
    if not progress:
        progress = BrandSetupProgress(brand_id=brand.id, company_id=brand.company_id)
        db.add(progress)
        db.flush()

    step_brand_completed = True

    guidelines_count = db.scalar(
        select(func.count(SourceDocument.id)).where(
            SourceDocument.brand_id == brand.id,
            SourceDocument.kind == "guideline",
        )
    ) or 0
    step_guidelines_completed = guidelines_count > 0

    active_rules_count = db.scalar(
        select(func.count(Rule.id)).where(
            Rule.brand_id == brand.id,
            Rule.status == "active",
        )
    ) or 0
    proposed_rules_count = db.scalar(
        select(func.count(Rule.id)).where(
            Rule.brand_id == brand.id,
            Rule.status == "proposed",
        )
    ) or 0
    step_rules_completed = active_rules_count > 0

    approved_evidence_count = db.scalar(
        select(func.count(EvidenceRecord.id)).where(
            EvidenceRecord.brand_id == brand.id,
            EvidenceRecord.status == "approved",
        )
    ) or 0
    pending_evidence_count = db.scalar(
        select(func.count(EvidenceRecord.id)).where(
            EvidenceRecord.brand_id == brand.id,
            EvidenceRecord.status == "pending",
        )
    ) or 0
    step_evidence_completed = approved_evidence_count > 0

    members_count = db.scalar(
        select(func.count(CompanyMembership.id)).where(
            CompanyMembership.company_id == brand.company_id,
        )
    ) or 1
    invitations_count = db.scalar(
        select(func.count(CompanyInvitation.id)).where(
            CompanyInvitation.company_id == brand.company_id,
        )
    ) or 0
    step_invite_completed = bool(members_count > 1 or invitations_count > 0 or progress.skipped_invite)

    live_drafts_count = db.scalar(
        select(func.count(Draft.id)).where(
            Draft.brand_id == brand.id,
            Draft.seeded.is_(False),
        )
    ) or 0
    step_draft_completed = live_drafts_count > 0

    steps = [
        {
            "id": "brand",
            "title": "Company & brand workspace",
            "description": "Tenant organization and brand identity configured.",
            "completed": step_brand_completed,
            "status": "completed",
            "required_role": "brand_owner",
            "can_execute": m.role == "brand_owner",
            "action_label": "View workspace",
        },
        {
            "id": "guidelines",
            "title": "Upload brand guidelines",
            "description": "Upload a PDF or text file with your brand tone and guidelines.",
            "completed": step_guidelines_completed,
            "status": "completed" if step_guidelines_completed else "current" if step_brand_completed else "pending",
            "required_role": "brand_owner",
            "can_execute": m.role == "brand_owner",
            "count": guidelines_count,
            "action_label": "Upload guidelines",
        },
        {
            "id": "rules",
            "title": "Inspect & approve rules",
            "description": "Review rules extracted from guidelines. An owner must approve them before activation.",
            "completed": step_rules_completed,
            "status": "completed" if step_rules_completed else "current" if step_guidelines_completed else "pending",
            "required_role": "brand_owner",
            "can_execute": m.role == "brand_owner",
            "proposed_count": proposed_rules_count,
            "active_count": active_rules_count,
            "action_label": "Inspect rules",
        },
        {
            "id": "evidence",
            "title": "Register an approved fact",
            "description": "Register an Evidence Passport backed by an exact quote from your source document.",
            "completed": step_evidence_completed,
            "status": "completed" if step_evidence_completed else "current" if step_rules_completed else "pending",
            "required_role": "brand_owner",
            "can_execute": m.role in ("brand_owner", "senior_reviewer", "reviewer"),
            "approved_count": approved_evidence_count,
            "pending_count": pending_evidence_count,
            "action_label": "Register fact",
        },
        {
            "id": "invite",
            "title": "Invite a teammate",
            "description": "Invite creators or reviewers to your company workspace (or skip to continue).",
            "completed": step_invite_completed,
            "skipped": progress.skipped_invite,
            "optional": True,
            "status": "completed" if step_invite_completed else "current" if step_evidence_completed else "pending",
            "required_role": "brand_owner",
            "can_execute": m.role == "brand_owner",
            "members_count": members_count,
            "invitations_count": invitations_count,
            "action_label": "Invite teammate",
        },
        {
            "id": "first_draft",
            "title": "Check your first draft",
            "description": "Paste content to verify claims and tone against approved brand rules.",
            "completed": step_draft_completed,
            "status": "completed" if step_draft_completed else "current" if step_invite_completed else "pending",
            "required_role": "creator",
            "can_execute": True,
            "count": live_drafts_count,
            "action_label": "Check content",
        },
    ]

    completed_count = sum(1 for s in steps if s["completed"])
    is_completed = completed_count == len(steps)
    if is_completed and not progress.completed_at:
        progress.completed_at = utcnow()

    current_step_name = "completed"
    for s in steps:
        if not s["completed"]:
            current_step_name = s["id"]
            break
    progress.current_step = current_step_name

    pending_approvals_count = db.scalar(
        select(func.count(Draft.id)).where(
            Draft.brand_id == brand.id,
            Draft.status.in_(("in_review", "senior_review")),
        )
    ) or 0

    if m.role == "creator":
        if active_rules_count == 0:
            role_task = {
                "key": "waiting_rules",
                "title": "Waiting for brand rules",
                "description": "Your Brand Owner needs to inspect and approve the extracted brand rules before content checks can run.",
                "can_act": False,
                "action_label": "View brand rules",
                "target": "library",
            }
        elif live_drafts_count == 0:
            role_task = {
                "key": "check_first_draft",
                "title": "Check your first draft",
                "description": "Your brand rules and approved facts are active. Paste promotional copy to run your first content check.",
                "can_act": True,
                "action_label": "Check content",
                "target": "review",
            }
        else:
            role_task = {
                "key": "create_content",
                "title": "Ready for content checks",
                "description": "Create and check new content against your company's active brand rules.",
                "can_act": True,
                "action_label": "Check content",
                "target": "review",
            }
    elif m.role in ("reviewer", "senior_reviewer"):
        if pending_approvals_count > 0:
            role_task = {
                "key": "review_pending",
                "title": f"{pending_approvals_count} draft(s) waiting for review",
                "description": "Teammates have submitted content waiting for independent review and approval.",
                "can_act": True,
                "action_label": "Review now",
                "target": "queue",
            }
        elif active_rules_count == 0:
            role_task = {
                "key": "waiting_rules",
                "title": "Waiting for brand rules",
                "description": "Brand Owner approval is required to activate brand guidelines.",
                "can_act": False,
                "action_label": "View brand rules",
                "target": "library",
            }
        else:
            role_task = {
                "key": "queue_clear",
                "title": "Review queue is clear",
                "description": "No drafts currently waiting for review. You can check fresh content or view approved facts.",
                "can_act": True,
                "action_label": "Check content",
                "target": "review",
            }
    else:  # brand_owner
        if not step_guidelines_completed:
            role_task = {
                "key": "upload_guidelines",
                "title": "Upload brand guidelines",
                "description": "Upload a PDF or paste guideline text so BrandLint can extract brand rules.",
                "can_act": True,
                "action_label": "Upload guidelines",
                "target": "guidelines",
            }
        elif not step_rules_completed:
            role_task = {
                "key": "inspect_rules",
                "title": f"Inspect {proposed_rules_count} proposed rule(s)",
                "description": "Guidelines uploaded! Inspect the extracted rules and approve them to activate.",
                "can_act": True,
                "action_label": "Inspect rules",
                "target": "rules",
            }
        elif not step_evidence_completed:
            role_task = {
                "key": "register_evidence",
                "title": "Register an approved fact",
                "description": "Anchor promotional claims with a verified source quote in your Approved Facts.",
                "can_act": True,
                "action_label": "Register fact",
                "target": "evidence",
            }
        elif not step_invite_completed:
            role_task = {
                "key": "invite_teammate",
                "title": "Invite a teammate",
                "description": "Invite creators or reviewers to collaborate, or skip to continue setup.",
                "can_act": True,
                "action_label": "Invite teammate",
                "target": "invite",
            }
        elif not step_draft_completed:
            role_task = {
                "key": "check_first_draft",
                "title": "Check your first draft",
                "description": "Paste content to verify claims and tone against your active rules.",
                "can_act": True,
                "action_label": "Check content",
                "target": "review",
            }
        else:
            role_task = {
                "key": "setup_complete",
                "title": "Setup complete",
                "description": "Your brand workspace is fully configured and ready for live promotional governance.",
                "can_act": True,
                "action_label": "Check content",
                "target": "review",
            }

    progress_pct = round((completed_count / len(steps)) * 100)
    db.commit()

    return {
        "brand_id": brand.id,
        "company_id": brand.company_id,
        "current_step": current_step_name,
        "is_completed": is_completed,
        "completed_count": completed_count,
        "total_steps": len(steps),
        "progress_pct": progress_pct,
        "dismissed": progress.dismissed,
        "skipped_invite": progress.skipped_invite,
        "steps": steps,
        "role_task": role_task,
        "stats": {
            "guidelines_count": guidelines_count,
            "proposed_rules_count": proposed_rules_count,
            "active_rules_count": active_rules_count,
            "approved_evidence_count": approved_evidence_count,
            "pending_evidence_count": pending_evidence_count,
            "members_count": members_count,
            "invitations_count": invitations_count,
            "live_drafts_count": live_drafts_count,
            "pending_approvals_count": pending_approvals_count,
        },
    }


@router.get("/brands/{brand_id}/setup")
def get_brand_setup(brand_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Retrieve resumable, role-aware setup and onboarding progress for the brand workspace."""
    m = membership_for(db, user, brand_id)
    brand = db.get(Brand, brand_id)
    if not brand:
        raise HTTPException(404, "Brand not found")
    return compute_brand_setup(db, brand, user, m)


@router.post("/brands/{brand_id}/setup/skip-step")
def skip_setup_step(brand_id: int, body: SkipStepIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Skip an optional setup step (such as inviting teammates) so onboarding can proceed."""
    m = membership_for(db, user, brand_id)
    require_role(m, "brand_owner")
    brand = db.get(Brand, brand_id)
    if not brand:
        raise HTTPException(404, "Brand not found")

    progress = db.scalar(select(BrandSetupProgress).where(BrandSetupProgress.brand_id == brand_id))
    if not progress:
        progress = BrandSetupProgress(brand_id=brand_id, company_id=brand.company_id)
        db.add(progress)

    if body.step == "invite":
        progress.skipped_invite = True
    progress.updated_at = utcnow()
    db.commit()
    return compute_brand_setup(db, brand, user, m)


@router.post("/brands/{brand_id}/setup/dismiss")
def dismiss_setup(brand_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Dismiss setup progress card from the home screen."""
    m = membership_for(db, user, brand_id)
    brand = db.get(Brand, brand_id)
    if not brand:
        raise HTTPException(404, "Brand not found")
    progress = db.scalar(select(BrandSetupProgress).where(BrandSetupProgress.brand_id == brand_id))
    if progress:
        progress.dismissed = True
        progress.updated_at = utcnow()
        db.commit()
    return {"ok": True, "dismissed": True}


@router.post("/brands/{brand_id}/setup/resume")
def resume_setup(brand_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Reopen or un-dismiss setup progress card on the home screen."""
    m = membership_for(db, user, brand_id)
    brand = db.get(Brand, brand_id)
    if not brand:
        raise HTTPException(404, "Brand not found")
    progress = db.scalar(select(BrandSetupProgress).where(BrandSetupProgress.brand_id == brand_id))
    if progress:
        progress.dismissed = False
        progress.updated_at = utcnow()
        db.commit()
    return compute_brand_setup(db, brand, user, m)


@router.get("/brands/{brand_id}/library")
def library(brand_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    membership_for(db, user, brand_id)
    rules = db.scalars(select(Rule).where(Rule.brand_id == brand_id, Rule.status.in_(("active", "proposed")))
                       .order_by(Rule.status, Rule.key))
    docs = db.scalars(select(SourceDocument).where(SourceDocument.brand_id == brand_id).order_by(SourceDocument.id.desc()))
    return {"rules": [rule_view(r) for r in rules], "documents": [doc_view(d) for d in docs]}


@router.get("/brands/{brand_id}/documents/{doc_id}")
def get_document(brand_id: int, doc_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    membership_for(db, user, brand_id)
    d = db.get(SourceDocument, doc_id)
    if not d or d.brand_id != brand_id:
        raise HTTPException(404, "Document not found")
    return doc_view(d, with_pages=True)


@router.post("/brands/{brand_id}/documents")
async def upload_document(brand_id: int, kind: str = Form("guideline"), title: str = Form(...), text: str = Form(""),
                          expires_on: str = Form(""), file: UploadFile | None = File(None),
                          user: User = Depends(current_user), db: Session = Depends(get_db)):
    m = membership_for(db, user, brand_id)
    require_role(m, "brand_owner")
    if kind not in ("guideline", "evidence"):
        raise HTTPException(422, "kind must be guideline or evidence")
    brand = db.get(Brand, brand_id)
    if not brand:
        raise HTTPException(404, "Brand not found")

    settings = get_settings()
    from .throttling import check_upload_quota
    check_upload_quota(brand.company_id, db)

    file_data = None
    file_name = None

    if file is not None and file.filename:
        file_name = file.filename
        file_data = await lib.read_bounded_upload(file, settings.max_upload_size_bytes)
        _, pages = lib.parse_and_validate_document(file.filename, file_data, file.content_type)
    elif text.strip():
        clean_text = text.strip()
        if len(clean_text) > settings.max_pasted_text_chars:
            raise HTTPException(413, f"Pasted text exceeds maximum limit of {settings.max_pasted_text_chars} characters.")
        pages = [p.strip() for p in clean_text.split("\f")] if "\f" in clean_text else [clean_text]
    else:
        raise HTTPException(422, "Provide a PDF file or paste text")

    exp = None
    if expires_on.strip():
        try:
            exp = date.fromisoformat(expires_on.strip())
        except ValueError:
            raise HTTPException(422, "expires_on must be YYYY-MM-DD")

    upload_bytes = len(file_data) if file_data else len(clean_text.encode("utf-8"))
    if brand.company_id:
        from .usage import check_workspace_limits, record_workspace_usage
        check_workspace_limits(db, brand.company_id, "storage", upload_bytes)

    doc = lib.ingest_document(
        db, brand, user, kind, title.strip()[:300], pages, exp,
        file_data=file_data, file_name=file_name
    )
    if brand.company_id:
        record_workspace_usage(db, brand.company_id, "storage", upload_bytes)

    proposed, notes = ([], [])
    if kind == "guideline":
        proposed, notes = lib.propose_rules(db, brand, doc, user)
    db.commit()
    return {"document": doc_view(doc), "proposed_rules": [rule_view(r) for r in proposed], "notes": notes}


@router.get("/brands/{brand_id}/documents/{document_id}/download")
def download_document(brand_id: int, document_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Securely download original uploaded document with strict tenant authorization."""
    membership_for(db, user, brand_id)
    doc = db.get(SourceDocument, document_id)
    if not doc or doc.brand_id != brand_id:
        raise HTTPException(404, "Document not found")
    if not doc.storage_path:
        raise HTTPException(404, "Original document file is not stored")

    file_path = lib.get_stored_document_path(doc.storage_path)
    safe_fn = doc.file_name or f"{doc.title}.pdf"
    return FileResponse(
        path=file_path,
        filename=safe_fn,
        media_type="application/octet-stream",
        headers={"X-Content-Type-Options": "nosniff"},
    )


@router.post("/brands/{brand_id}/rules/{rule_id}/approve")
def approve_rule(brand_id: int, rule_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_role(membership_for(db, user, brand_id), "brand_owner")
    r = db.get(Rule, rule_id)
    if not r or r.brand_id != brand_id:
        raise HTTPException(404, "Rule not found")
    lib.activate_rule(db, r, user)
    svc.process_evidence_recall(db, brand_id)
    db.commit()
    return rule_view(r)


@router.post("/brands/{brand_id}/rules/{rule_id}/reject")
def reject_rule(brand_id: int, rule_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_role(membership_for(db, user, brand_id), "brand_owner")
    r = db.get(Rule, rule_id)
    if not r or r.brand_id != brand_id:
        raise HTTPException(404, "Rule not found")
    if r.status != "proposed":
        raise HTTPException(409, f"Rule is '{r.status}', not proposed")
    r.status = "rejected"
    audit(db, brand_id, user.id, "rule_rejected", None, {"rule": r.key})
    db.commit()
    return rule_view(r)


# ------------------------------------------------------------------ evidence vault
def evidence_view(e: EvidenceRecord) -> dict:
    from .service import passport

    p = passport(e)
    p["keywords"] = e.keywords
    p["valid_until_record"] = e.valid_until.isoformat() if e.valid_until else None
    p["source_expires_on"] = e.source_document.expires_on.isoformat() if e.source_document.expires_on else None
    return p


@router.get("/brands/{brand_id}/evidence")
def list_evidence(brand_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    membership_for(db, user, brand_id)
    rows = db.scalars(select(EvidenceRecord).where(EvidenceRecord.brand_id == brand_id).order_by(EvidenceRecord.id))
    return [evidence_view(e) for e in rows]


class EvidenceIn(BaseModel):
    claim_text: str = Field(min_length=5, max_length=600)
    excerpt: str = Field(min_length=5, max_length=1500)
    document_id: int
    page: int = 1
    owner: str = Field(min_length=2, max_length=120)
    valid_from: date | None = None
    valid_until: date | None = None
    keywords: list[str] = []


@router.post("/brands/{brand_id}/evidence")
def add_evidence(brand_id: int, body: EvidenceIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    m = membership_for(db, user, brand_id)
    require_role(m, "brand_owner", "senior_reviewer", "reviewer")
    brand = db.get(Brand, brand_id)
    e = lib.create_evidence(db, brand, user, body.claim_text, body.excerpt, body.document_id, body.page, body.owner,
                            body.valid_from, body.valid_until, body.keywords)
    db.commit()
    return evidence_view(e)


@router.post("/brands/{brand_id}/evidence/{evidence_id}/{decision}")
def decide_evidence(brand_id: int, evidence_id: int, decision: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_role(membership_for(db, user, brand_id), "brand_owner")
    if decision not in ("approve", "reject"):
        raise HTTPException(404, "Not found")
    e = db.get(EvidenceRecord, evidence_id)
    if not e or e.brand_id != brand_id:
        raise HTTPException(404, "Evidence not found")
    e.status = "approved" if decision == "approve" else "rejected"
    e.approved_by = user.id
    audit(db, brand_id, user.id, f"evidence_{decision}d", None, {"evidence": e.id})
    if decision == "reject":
        svc.process_evidence_recall(db, brand_id)
    db.commit()
    return evidence_view(e)


# ------------------------------------------------------------------ drafts
class DraftIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    channel: str = Field(default="", max_length=60)
    text: str = Field(min_length=1, max_length=100000)
    audience: str = Field(default="", max_length=300)
    purpose: str = Field(default="", max_length=300)
    cta: str = Field(default="", max_length=300)


class DraftEdit(BaseModel):
    text: str = Field(min_length=1, max_length=100000)
    audience: str = Field(default="", max_length=300)
    purpose: str = Field(default="", max_length=300)
    cta: str = Field(default="", max_length=300)
    title: str | None = None


@router.get("/brands/{brand_id}/drafts")
def list_drafts(brand_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    m = membership_for(db, user, brand_id)
    q = select(Draft).where(Draft.brand_id == brand_id).order_by(Draft.id.desc())
    if m.role == "creator":
        q = q.where(Draft.author_id == user.id)
    return [svc.draft_summary(db, d) for d in db.scalars(q)]


@router.post("/brands/{brand_id}/drafts")
def create_draft(brand_id: int, body: DraftIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    m = membership_for(db, user, brand_id)
    brand = db.get(Brand, brand_id)
    if brand and brand.company_id:
        from .usage import check_workspace_limits, record_workspace_usage
        check_workspace_limits(db, brand.company_id, "draft")

    settings = get_settings()
    if len(body.text) > settings.max_draft_text_chars:
        raise HTTPException(413, f"Draft text exceeds maximum limit of {settings.max_draft_text_chars} characters.")
    d = Draft(brand_id=brand_id, author_id=user.id, title=body.title.strip(), channel=body.channel.strip())
    db.add(d)
    db.flush()
    svc.create_revision(db, d, user, body.text, body.audience, body.purpose, body.cta, "Initial draft")
    if brand and brand.company_id:
        record_workspace_usage(db, brand.company_id, "draft", 1)
    audit(db, brand_id, user.id, "draft_created", d.id, {})
    db.commit()
    return svc.draft_detail(db, d, m)


@router.get("/brands/{brand_id}/drafts/{draft_id}")
def get_draft(brand_id: int, draft_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    m = membership_for(db, user, brand_id)
    return svc.draft_detail(db, svc.get_draft(db, brand_id, draft_id, m), m)


@router.put("/brands/{brand_id}/drafts/{draft_id}")
def edit_draft(brand_id: int, draft_id: int, body: DraftEdit, user: User = Depends(current_user), db: Session = Depends(get_db)):
    m = membership_for(db, user, brand_id)
    d = svc.get_draft(db, brand_id, draft_id, m)
    if d.author_id != user.id:
        raise HTTPException(403, "Only the author can edit a draft")
    settings = get_settings()
    if len(body.text) > settings.max_draft_text_chars:
        raise HTTPException(413, f"Draft text exceeds maximum limit of {settings.max_draft_text_chars} characters.")
    rev = svc.current_revision(db, d)
    if (body.text, body.audience, body.purpose, body.cta) == (rev.text, rev.audience, rev.purpose, rev.cta):
        return svc.draft_detail(db, d, m)  # no change -> no new revision
    if body.title:
        d.title = body.title.strip()
    svc.create_revision(db, d, user, body.text, body.audience, body.purpose, body.cta, "Edited by author")
    db.commit()
    return svc.draft_detail(db, d, m)


@router.post("/brands/{brand_id}/drafts/{draft_id}/check")
async def check_draft(request: Request, brand_id: int, draft_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    m = membership_for(db, user, brand_id)
    d = svc.get_draft(db, brand_id, draft_id, m)
    if d.status == "approved":
        raise HTTPException(409, "Approved drafts are locked. Edit the draft to create a new revision.")

    idempotency_key = request.headers.get("Idempotency-Key") or request.query_params.get("idempotency_key")
    rev = svc.current_revision(db, d)

    from .jobs import create_or_get_job, run_job_execution
    job, is_new = create_or_get_job(db, brand_id, draft_id, rev.id, user, idempotency_key=idempotency_key)
    if not is_new and job.status == "completed":
        # Deduplicated idempotent request
        db.commit()
        return svc.draft_detail(db, d, m)

    from .throttling import check_ai_quota, ai_concurrency_limiter
    brand = db.get(Brand, brand_id)
    check_ai_quota(brand.company_id if brand else None, user.id, db)

    async with ai_concurrency_limiter.acquire():
        run_job_execution(db, job, triggered_by="manual")

    db.commit()
    return svc.draft_detail(db, d, m)


@router.post("/brands/{brand_id}/drafts/{draft_id}/jobs")
async def submit_analysis_job(
    request: Request,
    brand_id: int,
    draft_id: int,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Submits a durable, tenant-scoped analysis job with bounded retries and idempotency."""
    m = membership_for(db, user, brand_id)
    d = svc.get_draft(db, brand_id, draft_id, m)
    if d.status == "approved":
        raise HTTPException(409, "Approved drafts are locked. Edit the draft to create a new revision.")

    idempotency_key = request.headers.get("Idempotency-Key") or request.query_params.get("idempotency_key")
    rev = svc.current_revision(db, d)

    from .jobs import create_or_get_job, run_job_execution
    job, is_new = create_or_get_job(db, brand_id, draft_id, rev.id, user, idempotency_key=idempotency_key)

    if is_new or job.status in ("pending", "failed"):
        from .throttling import check_ai_quota, ai_concurrency_limiter
        brand = db.get(Brand, brand_id)
        check_ai_quota(brand.company_id if brand else None, user.id, db)
        async with ai_concurrency_limiter.acquire():
            run_job_execution(db, job, triggered_by="manual")

    db.commit()
    db.refresh(job)
    return {
        "job_id": job.job_id,
        "brand_id": job.brand_id,
        "draft_id": job.draft_id,
        "revision_id": job.revision_id,
        "status": job.status,
        "stage": job.stage,
        "progress_pct": job.progress_pct,
        "retry_count": job.retry_count,
        "max_retries": job.max_retries,
        "error_message": job.error_message,
        "error_code": job.error_code,
        "stale_result_prevented": job.stale_result_prevented,
        "created_at": job.created_at.isoformat(),
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
    }


@router.get("/brands/{brand_id}/jobs/{job_id}")
def get_analysis_job(
    brand_id: int,
    job_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Retrieves real progress, stage, and failure details for an analysis job."""
    membership_for(db, user, brand_id)
    job = db.scalar(
        select(AnalysisJob).where(
            AnalysisJob.brand_id == brand_id,
            AnalysisJob.job_id == job_id,
        )
    )
    if not job:
        raise HTTPException(404, "Analysis job not found")
    return {
        "job_id": job.job_id,
        "brand_id": job.brand_id,
        "draft_id": job.draft_id,
        "revision_id": job.revision_id,
        "status": job.status,
        "stage": job.stage,
        "progress_pct": job.progress_pct,
        "retry_count": job.retry_count,
        "max_retries": job.max_retries,
        "error_message": job.error_message,
        "error_code": job.error_code,
        "stale_result_prevented": job.stale_result_prevented,
        "created_at": job.created_at.isoformat(),
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        "cancelled_at": job.cancelled_at.isoformat() if job.cancelled_at else None,
    }


@router.get("/brands/{brand_id}/drafts/{draft_id}/jobs")
def list_draft_analysis_jobs(
    brand_id: int,
    draft_id: int,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Lists durable analysis jobs for a specific draft."""
    m = membership_for(db, user, brand_id)
    svc.get_draft(db, brand_id, draft_id, m)
    jobs = list(
        db.scalars(
            select(AnalysisJob)
            .where(AnalysisJob.brand_id == brand_id, AnalysisJob.draft_id == draft_id)
            .order_by(AnalysisJob.id.desc())
            .limit(20)
        )
    )
    return [
        {
            "job_id": j.job_id,
            "revision_id": j.revision_id,
            "status": j.status,
            "stage": j.stage,
            "progress_pct": j.progress_pct,
            "retry_count": j.retry_count,
            "created_at": j.created_at.isoformat(),
            "completed_at": j.completed_at.isoformat() if j.completed_at else None,
            "cancelled_at": j.cancelled_at.isoformat() if j.cancelled_at else None,
            "stale_result_prevented": j.stale_result_prevented,
        }
        for j in jobs
    ]


@router.post("/brands/{brand_id}/jobs/{job_id}/cancel")
def cancel_analysis_job(
    brand_id: int,
    job_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Cancels a pending or running analysis job."""
    membership_for(db, user, brand_id)
    from .jobs import cancel_job
    job = cancel_job(db, brand_id, job_id)
    return {
        "job_id": job.job_id,
        "status": job.status,
        "stage": job.stage,
        "cancelled_at": job.cancelled_at.isoformat() if job.cancelled_at else None,
    }


@router.get("/brands/{brand_id}/usage")
def get_brand_usage(
    brand_id: int,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Retrieves server-side usage accounting and limit capacity for a brand workspace."""
    membership_for(db, user, brand_id)
    brand = db.get(Brand, brand_id)
    if not brand or not brand.company_id:
        raise HTTPException(404, "Company workspace not found for brand")
    from .usage import get_workspace_usage_summary
    return get_workspace_usage_summary(db, brand.company_id)


@router.get("/companies/{company_id}/usage")
def get_company_usage(
    company_id: int,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Retrieves server-side usage accounting and limit capacity for a company."""
    company_membership_for(db, user, company_id)
    from .usage import get_workspace_usage_summary
    return get_workspace_usage_summary(db, company_id)


def _finding(db: Session, d: Draft, finding_id: int) -> Finding:
    f = db.get(Finding, finding_id)
    if not f or f.draft_id != d.id:
        raise HTTPException(404, "Finding not found")
    return f


class AcceptIn(BaseModel):
    confirm_protected: bool = False


class RejectIn(BaseModel):
    reason: str = Field(default="", max_length=1000)


@router.post("/brands/{brand_id}/drafts/{draft_id}/findings/{finding_id}/accept")
def accept_finding(brand_id: int, draft_id: int, finding_id: int, body: AcceptIn, user: User = Depends(current_user),
                   db: Session = Depends(get_db)):
    m = membership_for(db, user, brand_id)
    d = svc.get_draft(db, brand_id, draft_id, m)
    svc.accept_fix(db, d, user, _finding(db, d, finding_id), body.confirm_protected)
    db.commit()
    return svc.draft_detail(db, d, m)


@router.post("/brands/{brand_id}/drafts/{draft_id}/findings/{finding_id}/reject")
def reject_finding(brand_id: int, draft_id: int, finding_id: int, body: RejectIn, user: User = Depends(current_user),
                   db: Session = Depends(get_db)):
    m = membership_for(db, user, brand_id)
    d = svc.get_draft(db, brand_id, draft_id, m)
    svc.dispose(db, d, user, m, _finding(db, d, finding_id), "rejected", body.reason)
    db.commit()
    return svc.draft_detail(db, d, m)


@router.post("/brands/{brand_id}/drafts/{draft_id}/submit")
def submit_draft(brand_id: int, draft_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    m = membership_for(db, user, brand_id)
    d = svc.get_draft(db, brand_id, draft_id, m)
    svc.submit(db, d, user, m)
    db.commit()
    return svc.draft_detail(db, d, m)


class ApproveIn(BaseModel):
    revision_id: int
    comment: str = Field(default="", max_length=2000)


class ReasonIn(BaseModel):
    reason: str = Field(default="", max_length=2000)


@router.post("/brands/{brand_id}/drafts/{draft_id}/approve")
def approve_draft(brand_id: int, draft_id: int, body: ApproveIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    m = membership_for(db, user, brand_id)
    d = svc.get_draft(db, brand_id, draft_id, m)
    svc.approve(db, d, user, m, body.revision_id, body.comment)
    db.commit()
    return svc.draft_detail(db, d, m)


@router.post("/brands/{brand_id}/drafts/{draft_id}/request-changes")
def request_changes(brand_id: int, draft_id: int, body: ReasonIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    m = membership_for(db, user, brand_id)
    d = svc.get_draft(db, brand_id, draft_id, m)
    svc.request_changes(db, d, user, m, body.reason)
    db.commit()
    return svc.draft_detail(db, d, m)


class CommentIn(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


@router.post("/brands/{brand_id}/drafts/{draft_id}/comments")
def add_comment(brand_id: int, draft_id: int, body: CommentIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    m = membership_for(db, user, brand_id)
    d = svc.get_draft(db, brand_id, draft_id, m)
    db.add(ReviewDecision(draft_id=d.id, revision_id=d.current_revision_id, user_id=user.id, kind="comment", body=body.body.strip()))
    audit(db, brand_id, user.id, "comment_added", d.id, {"chars": len(body.body)})
    db.commit()
    return history(brand_id, draft_id, user, db)


@router.get("/brands/{brand_id}/drafts/{draft_id}/history")
def history(brand_id: int, draft_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    m = membership_for(db, user, brand_id)
    d = svc.get_draft(db, brand_id, draft_id, m)
    decisions = db.scalars(select(ReviewDecision).where(ReviewDecision.draft_id == d.id).order_by(ReviewDecision.id))
    events = db.scalars(select(AuditEvent).where(AuditEvent.draft_id == d.id).order_by(AuditEvent.id))
    return {
        "decisions": [{"id": x.id, "kind": x.kind, "body": x.body, "by": x.user.name, "route": x.route,
                       "revision_id": x.revision_id, "at": x.created_at.isoformat(), "seeded": x.seeded} for x in decisions],
        "audit": [{"id": a.id, "action": a.action, "by": a.user.name if a.user else "system", "details": a.details,
                   "at": a.created_at.isoformat(), "seeded": a.seeded} for a in events],
    }


@router.get("/brands/{brand_id}/queue")
def queue(brand_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Creators see their own drafts; reviewers see what is waiting for them (senior route only for senior reviewers)."""
    m = membership_for(db, user, brand_id)
    drafts = list(db.scalars(select(Draft).where(Draft.brand_id == brand_id).order_by(Draft.updated_at.desc())))
    if m.role == "creator":
        drafts = [d for d in drafts if d.author_id == user.id]
    out = []
    for d in drafts:
        s = svc.draft_summary(db, d)
        s["actionable"] = (m.role in REVIEW_ROLES and d.author_id != user.id and
                           ((d.status == "in_review") or (d.status == "senior_review" and m.role == "senior_reviewer"))) or (d.status == "needs_revalidation")
        out.append(s)
    return out


@router.get("/brands/{brand_id}/drafts/{draft_id}/eligible-reviewers")
def draft_eligible_reviewers(brand_id: int, draft_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    m = membership_for(db, user, brand_id)
    d = svc.get_draft(db, brand_id, draft_id, m)
    return svc.get_eligible_reviewers(db, brand_id, d.author_id, d.route)


class ReopenIn(BaseModel):
    reason: str = Field(default="", max_length=2000)


@router.post("/brands/{brand_id}/drafts/{draft_id}/reopen")
def reopen_draft_endpoint(brand_id: int, draft_id: int, body: ReopenIn | None = None, user: User = Depends(current_user), db: Session = Depends(get_db)):
    m = membership_for(db, user, brand_id)
    d = svc.get_draft(db, brand_id, draft_id, m)
    reason = body.reason if body else ""
    svc.reopen_draft(db, d, user, m, reason)
    return svc.draft_detail(db, d, m)


@router.post("/brands/{brand_id}/drafts/{draft_id}/recheck")
def recheck_draft_endpoint(brand_id: int, draft_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    m = membership_for(db, user, brand_id)
    d = svc.get_draft(db, brand_id, draft_id, m)
    svc.recheck_draft(db, d, user)
    return svc.draft_detail(db, d, m)


class RecallProcessIn(BaseModel):
    as_of: str | None = None


@router.post("/brands/{brand_id}/recall/process")
def process_recall_endpoint(brand_id: int, body: RecallProcessIn | None = None, as_of: str | None = None, user: User = Depends(current_user), db: Session = Depends(get_db)):
    m = membership_for(db, user, brand_id)
    require_role(m, *REVIEW_ROLES)
    as_of_str = (body.as_of if body and body.as_of else as_of)
    parsed_date = None
    if as_of_str:
        try:
            parsed_date = date.fromisoformat(as_of_str)
        except ValueError:
            raise HTTPException(400, "Invalid as_of date format. Expected YYYY-MM-DD.")
    affected = svc.process_evidence_recall(db, brand_id, as_of=parsed_date)
    return {
        "affected_count": len(affected),
        "affected": affected,
        "as_of": (parsed_date or date.today()).isoformat(),
    }


@router.get("/brands/{brand_id}/recall/alerts")
def get_recall_alerts(brand_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    m = membership_for(db, user, brand_id)
    recalled_drafts = list(db.scalars(
        select(Draft).where(Draft.brand_id == brand_id, Draft.validity_status == "needs_revalidation").order_by(Draft.updated_at.desc())
    ))
    return [{
        "draft_id": d.id,
        "title": d.title,
        "author_id": d.author_id,
        "author_name": d.author.name if d.author else "Unknown",
        "recall_reason": d.recall_reason,
        "updated_at": d.updated_at.isoformat(),
        "approved_revision_id": d.approved_revision_id,
    } for d in recalled_drafts]


@router.get("/brands/{brand_id}/notifications")
def get_notifications(brand_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    membership_for(db, user, brand_id)
    notifs = list(db.scalars(
        select(AppNotification)
        .where(AppNotification.brand_id == brand_id, (AppNotification.user_id == user.id) | (AppNotification.user_id.is_(None)))
        .order_by(AppNotification.created_at.desc())
        .limit(50)
    ))
    return [{
        "id": n.id,
        "kind": n.kind,
        "title": n.title,
        "body": n.body,
        "draft_id": n.draft_id,
        "is_read": n.is_read,
        "created_at": n.created_at.isoformat(),
    } for n in notifs]


@router.post("/brands/{brand_id}/notifications/{notification_id}/read")
def mark_notification_read(brand_id: int, notification_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    membership_for(db, user, brand_id)
    notif = db.get(AppNotification, notification_id)
    if not notif or notif.brand_id != brand_id:
        raise HTTPException(404, "Notification not found")
    notif.is_read = True
    db.commit()
    return {"status": "ok", "id": notification_id}



# ------------------------------------------------------------------ insights / guideline health
@router.get("/brands/{brand_id}/insights")
def insights(brand_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    membership_for(db, user, brand_id)
    return ins.insights(db, brand_id)


@router.post("/brands/{brand_id}/health/{rule_key}/suggest")
def suggest_wording(brand_id: int, rule_key: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_role(membership_for(db, user, brand_id), "brand_owner", "senior_reviewer", "reviewer")
    p = ins.suggest_clearer_wording(db, brand_id, rule_key, user)
    db.commit()
    return ins.proposal_view(p)


class SimulateRuleIn(BaseModel):
    proposed_text: str = Field(..., min_length=5, max_length=2000)
    channel_conditions: list[dict] = Field(default_factory=list)
    proposed_matchers: list[dict] | None = None


@router.post("/brands/{brand_id}/health/{rule_key}/simulate")
def simulate_rule(brand_id: int, rule_key: str, body: SimulateRuleIn,
                  user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Evaluate candidate rule wording and channel conditions against real saved drafts."""
    require_role(membership_for(db, user, brand_id), "brand_owner", "senior_reviewer", "reviewer")
    return ins.simulate_proposal_evaluation(
        db, brand_id, rule_key, body.proposed_text, body.channel_conditions, body.proposed_matchers
    )


class DecideIn(BaseModel):
    edited_text: str | None = Field(default=None, max_length=1500)
    channel_conditions: list[dict] | None = None
    proposed_matchers: list[dict] | None = None


@router.post("/brands/{brand_id}/proposals/{proposal_id}/{decision}")
def decide_proposal(brand_id: int, proposal_id: int, decision: str, body: DecideIn | None = None,
                    user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_role(membership_for(db, user, brand_id), "brand_owner")
    if decision not in ("approve", "reject"):
        raise HTTPException(404, "Not found")
    p = ins.decide_proposal(
        db, brand_id, proposal_id, user, decision == "approve",
        body.edited_text if body else None,
        body.channel_conditions if body else None,
        body.proposed_matchers if body else None,
    )
    db.commit()
    return ins.proposal_view(p)


@router.post("/brands/{brand_id}/benchmark/run")
@router.post("/brands/{brand_id}/evaluation/run")
def run_benchmark_job(brand_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Restricted explicit job action to run the expensive evaluation benchmark."""
    m = membership_for(db, user, brand_id)
    # Restricted: creators cannot trigger expensive benchmark sweeps
    require_role(m, "reviewer", "senior_reviewer", "brand_owner")

    brand = db.get(Brand, brand_id)
    from .throttling import check_benchmark_quota
    check_benchmark_quota(brand.company_id if brand else None, db)

    from .evaluation import run_benchmark
    result = run_benchmark(db, brand_id, user)

    # Persist in BenchmarkCache
    cache_entry = BenchmarkCache(
        brand_id=brand_id,
        company_id=brand.company_id if brand else None,
        run_by_id=user.id,
        result_json=result,
    )
    db.add(cache_entry)
    db.commit()
    return result


@router.get("/brands/{brand_id}/benchmark")
@router.get("/brands/{brand_id}/evaluation")
def get_cached_benchmark(brand_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Read the cached benchmark result without re-running expensive model sweeps."""
    membership_for(db, user, brand_id)
    cached = db.scalar(
        select(BenchmarkCache)
        .where(BenchmarkCache.brand_id == brand_id)
        .order_by(BenchmarkCache.created_at.desc())
    )
    if not cached:
        raise HTTPException(404, "No cached benchmark results found. An authorized reviewer or owner must trigger a benchmark run first.")
    return cached.result_json


_AD_PLACEMENTS: list[dict] = [
    {"key": "linkedin_feed", "channel": "LinkedIn Sponsored Feed", "target_ratio": "1.91:1 · 1:1 · 4:5",
     "lo": 0.78, "hi": 1.95, "center": 1.0, "rules_channel": "LinkedIn", "story": False},
    {"key": "instagram_feed", "channel": "Instagram / Meta Feed (1:1 · 4:5)", "target_ratio": "1:1 or 4:5",
     "lo": 0.78, "hi": 1.05, "center": 0.9, "rules_channel": "Instagram", "story": False},
    {"key": "story_reel", "channel": "Instagram / TikTok Story & Reel (9:16)", "target_ratio": "9:16 Vertical",
     "lo": 0.5, "hi": 0.66, "center": 0.5625, "rules_channel": "Instagram", "story": True},
    {"key": "display_hero", "channel": "Website Hero / Display Banner (16:9)", "target_ratio": "16:9 Landscape",
     "lo": 1.5, "hi": 2.4, "center": 1.78, "rules_channel": "Landing Page", "story": False},
    {"key": "youtube_thumb", "channel": "YouTube Thumbnail / X Post (16:9)", "target_ratio": "16:9 Landscape",
     "lo": 1.6, "hi": 1.95, "center": 1.78, "rules_channel": "Social", "story": False},
    {"key": "pinterest_pin", "channel": "Pinterest Pin (2:3)", "target_ratio": "2:3 Vertical",
     "lo": 0.62, "hi": 0.72, "center": 0.667, "rules_channel": "Social", "story": False},
    {"key": "leaderboard", "channel": "Web Leaderboard Banner (728×90)", "target_ratio": "≈8:1 Ultra-wide",
     "lo": 5.0, "hi": 12.0, "center": 8.09, "rules_channel": "Display", "story": False},
    {"key": "medium_rect", "channel": "Medium Rectangle (300×250)", "target_ratio": "6:5",
     "lo": 1.1, "hi": 1.3, "center": 1.2, "rules_channel": "Display", "story": False},
    {"key": "skyscraper", "channel": "Wide Skyscraper (160×600)", "target_ratio": "≈1:4 Ultra-tall",
     "lo": 0.15, "hi": 0.4, "center": 0.267, "rules_channel": "Display", "story": False},
    {"key": "print_poster", "channel": "Print / Poster / Packaging", "target_ratio": "Any size",
     "lo": 0.1, "hi": 12.0, "center": 0.707, "rules_channel": "Print", "story": False},
]

# Legacy channel labels sent by older clients / preset creatives.
_AD_PLACEMENT_ALIASES = {
    "linkedin": "linkedin_feed",
    "instagram feed": "instagram_feed",
    "meta feed": "instagram_feed",
    "instagram": "story_reel",
    "landing page": "display_hero",
    "display": "display_hero",
}

_COMMON_RATIOS = [
    ("9:16 Full-Screen Story / Reel", 0.5625), ("2:3 Portrait / Pinterest", 0.6667), ("3:4 Portrait", 0.75),
    ("4:5 Vertical Feed", 0.8), ("1:1 Square", 1.0), ("6:5 Medium Rectangle", 1.2), ("5:4 Landscape", 1.25),
    ("4:3 Landscape", 1.3333), ("3:2 Landscape", 1.5), ("16:9 Widescreen", 1.7778), ("1.91:1 Link / Feed Banner", 1.91),
    ("2:1 Panorama", 2.0), ("21:9 Ultra-wide", 2.3333), ("3:1 Header Banner", 3.0), ("728×90 Leaderboard", 8.09),
    ("1:4 Skyscraper", 0.2667), ("A-series Print (1:√2)", 0.7071),
]


def _ad_ratio_label(w: int, h: int) -> str:
    import math as _math
    ratio = w / h
    best_label, best_dist = None, 9.0
    for label, r in _COMMON_RATIOS:
        dist = abs(_math.log(ratio / r))
        if dist < best_dist:
            best_label, best_dist = label, dist
    if best_label and best_dist <= 0.04:
        return f"{best_label} · {w}×{h}px"
    return f"Custom {round(ratio, 2)}:1 · {w}×{h}px"


def _ad_placement_ratio_score(spec: dict, ratio: float) -> int:
    import math as _math
    if spec["key"] == "print_poster":
        return 88
    if spec["lo"] <= ratio <= spec["hi"]:
        return 94
    edge = spec["lo"] if ratio < spec["lo"] else spec["hi"]
    return max(40, round(92 - abs(_math.log(ratio / edge)) * 70))


def _resolve_ad_placement(channel: str | None, ratio: float) -> dict:
    raw = (channel or "").strip()
    key = raw.lower()
    if key in ("", "auto", "auto-detect"):
        candidates = [p for p in _AD_PLACEMENTS if p["key"] != "print_poster"]
        return max(candidates, key=lambda p: (_ad_placement_ratio_score(p, ratio), -abs(ratio - p["center"])))
    for p in _AD_PLACEMENTS:
        if key == p["key"] or key == p["channel"].lower():
            return p
    alias = _AD_PLACEMENT_ALIASES.get(key)
    if alias:
        return next(p for p in _AD_PLACEMENTS if p["key"] == alias)
    for p in _AD_PLACEMENTS:
        if key and key in p["channel"].lower():
            return p
    # Unknown custom channel: score as a generic social/display placement but keep its name for rule matching.
    return {**_AD_PLACEMENTS[0], "key": "custom", "channel": raw[:80], "rules_channel": raw[:80]}


class AdScanIn(BaseModel):
    title: str = Field(default="Ad Creative Scan", max_length=200)
    channel: str = Field(default="LinkedIn", max_length=80)
    extracted_text: str = Field(default="", max_length=10000)
    cta_text: str = Field(default="", max_length=300)
    image_data_url: str | None = Field(default=None, max_length=14_000_000)
    image_width: int = Field(default=1080, ge=1, le=12000)
    image_height: int = Field(default=1350, ge=1, le=12000)
    contrast_ratio: float = Field(default=7.2, ge=1.0, le=21.0)
    text_coverage_pct: float = Field(default=16.5, ge=0.0, le=100.0)
    top_zone_busy: bool = Field(default=False)
    bottom_zone_busy: bool = Field(default=False)
    focal_balance_pct: float = Field(default=88.0, ge=0.0, le=100.0)


@router.post("/brands/{brand_id}/ad-scan")
def scan_ad_creative(
    brand_id: int,
    body: AdScanIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Scan an advertisement image for text/claim compliance, visual hierarchy, safe-zone collisions, and channel placement fit."""
    import base64 as _b64
    from .analysis.evidence import effective_expiry, retrieve_candidates
    from .analysis.pipeline import detect_claims, doc_ref, resolve_claim, run_matchers
    from .analysis.text import content_tokens

    membership_for(db, user, brand_id)
    brand = db.get(Brand, brand_id)
    if not brand:
        raise HTTPException(404, "Brand not found")

    text = (body.extracted_text or "").strip()
    ocr_used = False

    # 1) Optional Gemini Multimodal OCR if an uploaded image has no extracted text yet.
    #    The frontend normalises most formats (SVG, GIF, BMP, AVIF, TIFF, ICO…) to JPEG/PNG;
    #    HEIC/HEIF photos that the browser cannot decode are forwarded as-is for OCR.
    if not text and body.image_data_url and "," in body.image_data_url:
        try:
            header, b64_payload = body.image_data_url.split(",", 1)
            declared = header[5:].split(";", 1)[0].strip().lower() if header.startswith("data:") else ""
            mime_aliases = {"image/jpg": "image/jpeg", "image/pjpeg": "image/jpeg", "image/x-png": "image/png"}
            mime = mime_aliases.get(declared, declared)
            ocr_supported = {"image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"}
            if mime in ocr_supported:
                raw_bytes = _b64.b64decode(b64_payload)
                pages = lib.ocr_with_gemini(raw_bytes, mime)
                if pages:
                    text = "\n".join(pages).strip()
                    ocr_used = True
        except Exception:
            pass

    suspicious_notes = lib.scan_suspicious([text]) if text else []

    # Resolve the target placement (supports explicit keys, legacy labels and "auto" best-fit by aspect ratio)
    w = max(body.image_width, 1)
    h = max(body.image_height, 1)
    ratio = round(w / h, 3)
    placement = _resolve_ad_placement(body.channel, ratio)
    rules_channel = placement["rules_channel"]

    # 2) Run deterministic Brand Rules + Claim & Evidence Passport verification on the ad's text
    rules = list(db.scalars(select(Rule).where(Rule.brand_id == brand_id, Rule.status == "active")))
    evidence_all = list(db.scalars(select(EvidenceRecord).where(EvidenceRecord.brand_id == brand_id)))
    today = date.today()
    current_evidence = [e for e in evidence_all if evidence_state(e, today) == "current"]
    stop = {t for term in (brand.protected_terms or []) for t in content_tokens(term)}

    rule_hits = run_matchers(text, rules, channel=rules_channel) if text else []
    claims = detect_claims(text) if text else []

    text_findings = []
    rewritten_text = text

    for idx, hit in enumerate(rule_hits, start=1):
        replacement = hit.replacement
        text_findings.append({
            "id": f"R-{idx}",
            "kind": "rule",
            "severity": hit.severity,
            "code": hit.rule.ref if hit.rule else "RULE",
            "category": hit.category,
            "quote": hit.quote,
            "explanation": hit.explanation,
            "source_ref": hit.source_ref,
            "suggestion": replacement,
            "evidence_status": None,
            "passport_ref": None,
            "dimensions": {},
        })
        if replacement and hit.quote in rewritten_text:
            rewritten_text = rewritten_text.replace(hit.quote, replacement, 1)

    for idx, c in enumerate(claims, start=1):
        cands = retrieve_candidates(c.quote, evidence_all, stop, db=db, brand_id=brand_id)
        notes_buf: list[str] = []
        status, ev, expl, dims, _uncert = resolve_claim(c, cands, None, today, notes_buf)
        # If deterministic dimensions & tokens are all supported by a current passport, mark supported
        if ev and evidence_state(ev, today) == "current" and dims and all(v.get("status") == "supported" for v in dims.values()):
            status = "supported"
            expl = f"Verified against {ev.ref} ({ev.source_document.title}, p.{ev.page})."

        suggested_fix = None
        if status != "supported":
            chosen_ev = ev if (ev and evidence_state(ev, today) == "current") else (current_evidence[0] if current_evidence else None)
            if chosen_ev:
                suggested_fix = f"{chosen_ev.claim_text} ({chosen_ev.ref}, p.{chosen_ev.page})"
                if c.quote in rewritten_text:
                    rewritten_text = rewritten_text.replace(c.quote, suggested_fix, 1)

        text_findings.append({
            "id": f"C-{idx}",
            "kind": "claim",
            "severity": "info" if status == "supported" else "critical",
            "code": ev.ref if ev else "CLAIM-UNBACKED",
            "category": "claims",
            "quote": c.quote,
            "explanation": expl or (f"Supported by {ev.ref}: “{ev.excerpt}”" if ev else "Unverified promotional claim."),
            "source_ref": f"{ev.source_document.title} v{ev.source_document.version}, p.{ev.page}" if ev and ev.source_document else "Evidence Vault",
            "suggestion": suggested_fix,
            "evidence_status": status,
            "passport_ref": ev.ref if ev else None,
            "dimensions": dims or {},
        })

    # 3) Compute Ad Placement, Aspect Ratio, Safe-Zone, and Contrast Telemetry
    detected_ratio_label = _ad_ratio_label(w, h)

    blocking_text_issues = [f for f in text_findings if f["severity"] in ("high", "critical") and f.get("evidence_status") != "supported"]
    minor_text_issues = [f for f in text_findings if f["severity"] in ("low", "medium")]

    text_compliance_score = max(15, 100 - len(blocking_text_issues) * 32 - len(minor_text_issues) * 12)
    if not text:
        text_compliance_score = 60

    # Contrast score (WCAG AA requires >= 4.5:1 for normal text, >= 3.0:1 for large display headlines)
    if body.contrast_ratio >= 7.0:
        contrast_score = 98
        contrast_status = "pass"
        contrast_note = f"WCAG AAA contrast ({body.contrast_ratio:.1f}:1) — headline and body copy are crisp against the background."
    elif body.contrast_ratio >= 4.5:
        contrast_score = 88
        contrast_status = "pass"
        contrast_note = f"WCAG AA contrast ({body.contrast_ratio:.1f}:1) — legible across mobile and desktop displays."
    elif body.contrast_ratio >= 3.2:
        contrast_score = 68
        contrast_status = "warning"
        contrast_note = f"Borderline contrast ({body.contrast_ratio:.1f}:1) — large headline is readable, but small footnote/disclaimer text may wash out."
    else:
        contrast_score = 42
        contrast_status = "blocking"
        contrast_note = f"Low contrast ({body.contrast_ratio:.1f}:1) — ad copy blends into background imagery. Add a dark scrim or high-contrast backing."

    # Text density score (Meta/LinkedIn best practice: < 20% text area)
    if 6.0 <= body.text_coverage_pct <= 22.0:
        density_score = 95
        density_status = "pass"
        density_note = f"Optimal text-to-image density ({body.text_coverage_pct:.1f}% ≤ 20% threshold) — high visual thumb-stop impact."
    elif body.text_coverage_pct <= 30.0:
        density_score = 74
        density_status = "warning"
        density_note = f"Moderate text density ({body.text_coverage_pct:.1f}%) — consider trimming secondary copy by 15% for cleaner visual breathing room."
    else:
        density_score = 52
        density_status = "warning"
        density_note = f"Heavy text overlay ({body.text_coverage_pct:.1f}%) — ad visual is overcrowded, reducing feed engagement."

    # Safe-zone check
    safe_zone_collision = body.top_zone_busy or body.bottom_zone_busy
    if not safe_zone_collision:
        safe_zone_score = 96
        safe_zone_status = "pass"
        safe_zone_note = "Top 14% header and bottom 20% platform UI overlay zones are clear of critical copy."
    else:
        safe_zone_score = 64
        safe_zone_status = "warning"
        zone_names = []
        if body.top_zone_busy:
            zone_names.append("top 14% header bar")
        if body.bottom_zone_busy:
            zone_names.append("bottom 20% caption/CTA overlay")
        safe_zone_note = f"Visual elements detected inside the {' and '.join(zone_names)} — may collide with Instagram/LinkedIn platform chrome."

    # Source citation footnote check when claims are present
    has_citation = any(k in text.lower() for k in ("ev-", "study", "p.", "soc 2", "n="))
    if not claims or has_citation:
        footnote_status = "pass"
        footnote_note = "Source citation / substantiation reference is present on the creative."
    else:
        footnote_status = "warning"
        footnote_note = "Promotional metric detected without a visible '*Source: EV-1 (2025 Study, p.2)' footnote in the lower margin."

    layout_score = round((contrast_score * 0.35) + (density_score * 0.30) + (safe_zone_score * 0.35))

    # Channel suitability matrix — every supported placement is scored against the creative's real aspect ratio
    def _placement_row(spec: dict) -> dict:
        score = _ad_placement_ratio_score(spec, ratio)
        if spec.get("story") and safe_zone_collision:
            score = min(score, 72)
        in_range = spec["lo"] <= ratio <= spec["hi"]
        if blocking_text_issues:
            status = "blocked"
        elif in_range and not (spec.get("story") and safe_zone_collision):
            status = "optimal"
        elif in_range:
            status = "needs_tuning"
        else:
            status = "needs_crop"
        if spec.get("story"):
            verdict_text = "Keep headline and CTA between 14%–80% vertical height so profile, caption & CTA overlays do not cover copy."
        elif in_range:
            verdict_text = f"Native {spec['target_ratio']} fit — no cropping or letterboxing required."
        elif ratio < spec["lo"]:
            verdict_text = f"Creative is taller than {spec['target_ratio']} — it will be cropped top/bottom or pillar-boxed. Export a wider variant."
        else:
            verdict_text = f"Creative is wider than {spec['target_ratio']} — it will be cropped left/right or letter-boxed. Export a taller variant."
        if blocking_text_issues:
            verdict_text = "Resolve blocking claim/copy issues before launch. " + verdict_text
        return {
            "key": spec["key"],
            "channel": spec["channel"],
            "target_ratio": spec["target_ratio"],
            "score": score,
            "status": status,
            "placement_verdict": verdict_text,
        }

    channel_suitability = [_placement_row(p) for p in _AD_PLACEMENTS]
    if placement["key"] == "custom":
        channel_suitability.insert(0, {**_placement_row(placement), "key": "custom"})
    channel_suitability.sort(key=lambda c: (c["key"] != placement["key"], -c["score"]))

    matched_ch = next((c for c in channel_suitability if c["key"] == placement["key"]), channel_suitability[0])
    placement_fit_score = matched_ch["score"]
    recommended = max(
        (c for c in channel_suitability if c["key"] not in ("print_poster", "custom")),
        key=lambda c: c["score"],
    )

    overall_score = round(
        (text_compliance_score * 0.45)
        + (layout_score * 0.30)
        + (placement_fit_score * 0.25)
    )

    if blocking_text_issues or contrast_status == "blocking":
        verdict = "blocked"
    elif overall_score >= 84 and not safe_zone_collision:
        verdict = "ready"
    else:
        verdict = "needs_tuning"

    layout_checks = [
        {
            "id": "claim_copy",
            "title": "Ad Copy & Claim Substantiation",
            "status": (
                "warning"
                if not text
                else ("blocking" if blocking_text_issues else ("warning" if minor_text_issues else "pass"))
            ),
            "metric": (
                "Copy Pending"
                if not text
                else (f"{len(blocking_text_issues)} Blocker(s)" if blocking_text_issues else "Verified ✓")
            ),
            "detail": (
                "No readable copy was extracted from this image automatically. Paste ad copy or configure Gemini Vision OCR to audit rules and claims."
                if not text
                else (
                    blocking_text_issues[0]["explanation"]
                    if blocking_text_issues
                    else "All promotional claims and brand terms on the creative match active rules and Evidence Passports."
                )
            ),
        },
        {
            "id": "safe_zones",
            "title": "Platform UI Safe-Zone Clearance",
            "status": safe_zone_status,
            "metric": "Clear (14%–80% Y)" if not safe_zone_collision else "Margin Overlap",
            "detail": safe_zone_note,
        },
        {
            "id": "contrast",
            "title": "WCAG Typography Contrast & Legibility",
            "status": contrast_status,
            "metric": f"{body.contrast_ratio:.1f} : 1",
            "detail": contrast_note,
        },
        {
            "id": "density",
            "title": "Text-to-Image Density & Visual Air",
            "status": density_status,
            "metric": f"{body.text_coverage_pct:.1f}% Area",
            "detail": density_note,
        },
        {
            "id": "aspect_placement",
            "title": f"Placement Fit ({placement['channel']})",
            "status": "pass" if placement_fit_score >= 85 else "warning",
            "metric": detected_ratio_label.split(" ")[0],
            "detail": f"{detected_ratio_label}. {matched_ch['placement_verdict']}",
        },
        {
            "id": "footnote",
            "title": "Evidence Footnote & CTA Hierarchy",
            "status": footnote_status,
            "metric": "Cited" if footnote_status == "pass" else "Missing Citation",
            "detail": footnote_note,
        },
    ]

    ocr_note = ""
    if not text and body.image_data_url:
        s_cfg = lib.get_settings()
        if s_cfg.llm_provider.lower() != "gemini" or not s_cfg.gemini_api_key:
            ocr_note = "Automatic image OCR requires Gemini Vision (current backend provider is Local Mock). Enter image copy below to check claims."
        else:
            ocr_note = "No readable text was detected in this creative. Enter copy manually if your graphic contains stylized typography."

    return {
        "overall_score": overall_score,
        "verdict": verdict,
        "ocr_used": ocr_used,
        "ocr_note": ocr_note,
        "suspicious_notes": suspicious_notes,
        "scores": {
            "text_compliance": text_compliance_score,
            "layout_composition": layout_score,
            "placement_fit": placement_fit_score,
            "contrast_legibility": contrast_score,
        },
        "image_meta": {
            "width": w,
            "height": h,
            "aspect_ratio": ratio,
            "aspect_label": detected_ratio_label,
            "contrast_ratio": round(body.contrast_ratio, 1),
            "text_coverage_pct": round(body.text_coverage_pct, 1),
            "focal_balance_pct": round(body.focal_balance_pct, 1),
        },
        "extracted_text": text,
        "rewritten_text": rewritten_text,
        "text_findings": text_findings,
        "layout_checks": layout_checks,
        "channel_suitability": channel_suitability,
        "placement": {"key": placement["key"], "channel": placement["channel"], "target_ratio": placement["target_ratio"]},
        "recommended_placement": {"key": recommended["key"], "channel": recommended["channel"], "score": recommended["score"]},
    }


@router.post("/demo/reset")
def reset_demo(request: Request, db: Session = Depends(get_db)):
    settings = get_settings()
    # Route is removed / completely non-existent in production
    if settings.is_production:
        raise HTTPException(404, "Endpoint not found")

    if not settings.is_isolated_demo_db():
        raise HTTPException(403, "Database reset is only permitted on an isolated demo database.")

    user = current_user(request, db)
    owner_membership = db.scalar(
        select(Membership).where(Membership.user_id == user.id, Membership.role == "brand_owner")
    )
    if not owner_membership:
        raise HTTPException(403, "Database reset requires Brand Owner permissions.")

    from .seed import reset_and_seed

    reset_and_seed()
    return {"status": "reset"}

