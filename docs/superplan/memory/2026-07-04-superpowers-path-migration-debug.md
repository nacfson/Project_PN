# Debug Summary: superpowers Path Migration to superplan

**Date:** 2026-07-04
**Topic:** Resolving path mismatch between superpowers and superplan workflows

---

## 1. Problem Characterization

* **Symptom:** When running `/superplan` skills (like brainstorming or writing plans) inside `Project_PN`, files were created under `docs/superpowers/` (plural `specs/` and `plans/` folders) instead of `docs/superplan/` (singular `spec/` and `plan/` folders).
* **Root Cause:**
  1. The project's existing configuration and documentation (`docs/README.md`, `docs/GUIDE.md`) still referenced the old `superpowers` path.
  2. The project lacked a `CLAUDE.md` file in the root to instruct external agent systems (like Claude Code) to use the new `docs/superplan/` path.
  3. Consequently, during execution, agents read the project-level layout documentation, assumed the standard path was `docs/superpowers/`, and defaulted to writing files there.

---

## 2. Surgical Fix & Migration

1. **Created Target Folders:** Ensured `docs/superplan/spec/`, `docs/superplan/plan/`, `docs/superplan/memory/`, `docs/superplan/deprecated/`, and `docs/superplan/mockups/` exist.
2. **File Migration:** Migrated all existing design specs, implementation plans, and mockups from `docs/superpowers/` to their respective folders in `docs/superplan/`.
3. **Reference Updates:** Run a python script to replace all occurrences of `superpowers/specs/` and `superpowers/plans/` with `superplan/spec/` and `superplan/plan/` inside all markdown documentation.
4. **Documentation Sync:** Updated `docs/README.md` and `docs/GUIDE.md` to point to the new `docs/superplan/` layout.
5. **Claude Code Behavioral Guard:** Added `CLAUDE.md` to the project root of `Project_PN` to enforce the `superplan` workflow directories.
6. **Clean Up:** Removed the legacy `docs/superpowers/` directory.

---

## 3. Verification

* Confirmed `docs/superpowers/` is fully removed.
* Confirmed the validate script passes in the `superplan` workspace.
* Verified `docs/README.md`, `docs/GUIDE.md`, and `CLAUDE.md` contain correct path links.
