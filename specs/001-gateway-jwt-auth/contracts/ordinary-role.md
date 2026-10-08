# Contract: Ordinary Role Capabilities

**Normative refs**: AUTH-06 / AC-12; FR-009–FR-011

## Rules

1. Every verified `(issuer, subject)` gets **ordinary** access only by default.  
2. Capabilities MUST be explicitly declared. Missing declaration → fail closed (deploy or runtime).  
3. Deny by default: undeclared ops and other users’ private data.  
4. **No application-admin role** in this delivery — do not declare admin capabilities.

## Ordinary capabilities (this delivery)

Aligned with today’s authenticated learner surface:

| Capability ID | Allows |
|---------------|--------|
| `learning.read_own` | List/read own learning items, due reviews, optimization status |
| `learning.write_own` | Add/archive own learning items; submit own reviews; optimize own weights |
| `decks.manage_own` | CRUD own decks / membership within product rules |
| `profile.read_own` | `/api/auth/me`, linked providers, languages |
| `profile.write_own` | Update own profile/languages/settings within product rules |
| `merge.participate` | Existing explicit account-merge flows for the authenticated user (if retained) |

**Not ordinary**:
- Access to another user’s private learning data  
- Undeclared operations  
- Mutating global dictionary as a privileged override (unless already a normal product path)

## Authorization check (conceptual)

```text
identity = verified (iss, sub) → local user
if operation in ordinaryRole.capabilities AND resource is own → allow
else → deny
```

## Manifest alignment

When the platform project manifest requires `ordinaryRole.capabilities`, the list above is the Project PN declaration for this delivery. Empty/missing list must fail deploy or boot.
