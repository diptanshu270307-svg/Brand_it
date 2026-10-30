# BrandLint Administrator & Permissions Guide

This guide defines the role hierarchy, security model, and administrative capabilities across BrandLint workspaces.

---

## 1. Role Hierarchy & Permissions Matrix

BrandLint enforces role-based access control (RBAC) at every API boundary. Each user belongs to a tenant-scoped company workspace with one of four defined roles:

| Capability / Action | Content Creator (`creator`) | Peer Reviewer (`reviewer`) | Senior Reviewer (`senior_reviewer`) | Workspace Owner (`brand_owner`) |
| :--- | :---: | :---: | :---: | :---: |
| **Create & edit own drafts** | Yes | Yes | Yes | Yes |
| **Run content check & view suggestions** | Yes | Yes | Yes | Yes |
| **Submit draft for review** | Yes | Yes | Yes | Yes |
| **View other authors' drafts** | No (own only) | Yes | Yes | Yes |
| **Approve standard drafts** | No | Yes (independent) | Yes (independent) | Yes (independent) |
| **Approve sensitive / escalated drafts** | No | No | Yes (independent) | Yes (independent) |
| **Register & edit approved facts** | No | Yes | Yes | Yes |
| **Upload guideline documents** | No | No | No | Yes |
| **Approve / activate extracted rules** | No | No | No | Yes |
| **Draft & simulate guideline proposals** | No | Yes | Yes | Yes |
| **Publish new rule versions** | No | No | No | Yes |
| **Revoke or expire evidence facts** | No | No | No | Yes |
| **Trigger manual Evidence Recall** | No | Yes | Yes | Yes |
| **Invite team members & manage roles** | No | No | No | Yes |
| **Update company settings & branding** | No | No | No | Yes |
| **View workspace usage & quota metrics**| No | No | No | Yes |

---

## 2. Core Governance Safeguards

### 2.1 Author / Reviewer Separation
To maintain regulatory and brand compliance:
- **No Self-Approvals**: An author can *never* approve their own draft (`HTTP 403 self_approval`).
- **Independent Peer Review**: Review requests are automatically assigned to an eligible independent teammate who did not author the submission.
- **Audit Trail**: Every approval attempt, rejection, and decision reason is permanently recorded in the immutable audit log.

### 2.2 Sensitive Content Escalation
- Drafts containing high-impact factual claims, significant statistical assertions, or contested wording are automatically escalated to **Senior Review** (`status: senior_review`).
- Peer reviewers (`reviewer`) cannot approve escalated drafts (`HTTP 403 senior_required`). Only a **Senior Reviewer** (`senior_reviewer`) or **Brand Owner** (`brand_owner`) who is not the author may provide sign-off.

### 2.3 Final Owner Safeguard
- A workspace requires at least one active **Brand Owner** at all times.
- Attempts to demote or remove the sole remaining owner of a company workspace are rejected with `HTTP 400 Bad Request`.

### 2.4 Multi-Tenant Workspace Isolation
- Each company workspace is strictly partitioned by `company_id` and `brand_id`.
- Members of Company A (e.g., Lumina Analytics) cannot view, modify, or query drafts, guidelines, evidence, or usage accounting belonging to Company B (e.g., Northwind Outfitters).
- Unauthorized cross-tenant requests return `HTTP 404 Not Found` to prevent tenancy or existence enumeration.

---

## 3. Team Member Management & Invitations

### 3.1 Inviting a Teammate
1. Navigate to **Team Settings** or **Company Setup**.
2. Click **Invite Teammate**.
3. Specify the teammate's work email and their assigned role (`creator`, `reviewer`, `senior_reviewer`, or `brand_owner`).
4. BrandLint generates a secure, cryptographically random token (`secrets.token_urlsafe(32)`) and sends an invitation link containing a URL fragment (`#invite-token=...`).

### 3.2 Token Lifecycle & Expiration
- **7-Day Expiry**: Invitations automatically expire 7 days after creation.
- **Single-Use**: Once accepted, the invitation token is permanently marked `accepted_at` and cannot be re-used.
- **Revocation**: Workspace Owners can revoke pending invitations at any time before acceptance via `DELETE /api/companies/{id}/invitations/{invitation_id}`.
- **Expired/Revoked Token Rejection**: Any inspection or acceptance attempt for an expired or revoked token is rejected with `HTTP 400 Bad Request`.

### 3.3 Dynamic Role Changes
- A Workspace Owner can change a member's role at any time via `PUT /api/companies/{id}/members/{user_id}`.
- Role adjustments take effect immediately across all brand memberships associated with that company workspace without requiring the user to re-authenticate.

---

## 4. Evidence Lifecycle & Persisted Recall

1. **Registration**: Evidence is registered with source document references, page numbers, exact verbatim quotes, and optional validity date windows (`valid_from`, `valid_until`).
2. **Dependency Tracking**: When a draft revision is approved, BrandLint automatically records immutable database foreign-key dependencies connecting the approved revision to the exact cited evidence IDs.
3. **Automatic Recall**: If an evidence fact is revoked (e.g., due to methodology changes) or expires past its `valid_until` date:
   - The persisted recall engine identifies all affected approved revisions.
   - Their current validity status transitions to `needs_revalidation`.
   - Historical approval records are preserved intact for compliance audits.
   - In-app notification alerts are delivered to reviewers and authors to review and re-certify the copy.

---

## 5. Guideline Versioning & Channel Conditions

- **Validated Data Rules**: Guideline rules and channel exemptions are stored and evaluated as structured data (JSON conditions), never executable code.
- **Pre-Publication Simulation**: Before activating a rule change, owners can simulate the proposed change against actual saved workspace drafts to preview eliminated findings and unchanged cases.
- **Owner-Gated Publication**: Only Workspace Owners can publish candidate proposals into active rules.
- **Version Isolation**: Previous rule versions (`v1`, `v2`, etc.) remain archived in the database; prior checked drafts retain their historical version pins.
