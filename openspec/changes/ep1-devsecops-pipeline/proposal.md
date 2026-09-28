# Proposal: EP1 CI DevSecOps Pipeline

## Intent
Deliver strict EP1 PR/push CI with reproducible checks, test/build evidence, and fail-closed controls using course mechanics: jobs, `needs`, cache/artifact separation, visible pass/fail.

## Scope

### In Scope
- Required `Repository baseline checks`; absent manifests are `not_applicable`, never passed.
- Post-manifest Node: committed `package.json`/`package-lock.json`, `npm ci`, and scripts.
- Python `apps/intelligence-service/`: `pyproject.toml`/`uv.lock`, pinned Python/uv, frozen sync/run for Ruff, mypy, pytest.
- Native Actions PostgreSQL: ephemeral credentials; deterministic migration, seed, test, teardown. Compose validates images and later full-system smoke.
- SAST, dependency/image/secret scanning, `.env.example` schema validation, pinned least-privilege actions, timeouts/concurrency, and 30-day SHA/run evidence.

### Out of Scope
- CD, staging, Terraform, diagrams, business logic, image publishing, and PRs #7–#14 integration/correction.

## Capabilities

### New Capabilities
- `ci-devsecops-pipeline`: EP1 quality, security, evidence, and fail-closed controls.

### Modified Capabilities
None; `openspec/specs/` is empty.

## Approach
**Immediate scaffold:** preserve baseline on `main`/`develop`; discover capabilities; converge critical jobs. Conditional jobs are never required directly.

**Post-manifest activation:** frontend: `npm run lint`, `npm run typecheck`, `npm test -- --watch=false`, `npm run build`; backend: `npm run lint`, `npm run typecheck`, `npm test -- --runInBand`, `npm run build`. Scripts are truth: missing means absent capability, never success. When stable, require the gate on `develop`, then `main` after develop-flow validation.

Variables: `PG_USER`, `PG_DATABASE`, `PG_PORT`, `BACKEND_PORT`, `FRONTEND_PORT`, `CORS_ORIGIN`, `JWT_EXPIRA`, `NODE_VERSION`, `PYTHON_VERSION`. Secrets: `PG_PASSWORD`, `JWT_SECRET`; GitHub-managed `GITHUB_TOKEN` has least privilege. Examples are fictitious. HIGH/CRITICAL and any secret block; MEDIUM/LOW warn. Exceptions are narrow, reviewed, justified, expiring allowlists.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `.github/workflows/` | New/Modified | Jobs, gate, evidence |
| Apps, locks, `.env.example`, Docker/Compose | Dependency | Post-manifest contracts |
| GitHub settings | Modified later | Values and staged protection |

## Risks

| Risk | Mitigation |
|---|---|
| False green/blocked scaffold | `not_applicable`; baseline required |
| Sensitive evidence | Never upload secrets, `.env`, dumps, images, dependencies, sensitive data |
| Unstable gate | Stage develop before main |

## Rollback Plan
Disable required `CI critical gate`, revert its work unit, restore baseline-only protection, and delete generated evidence only.

## Dependencies
- Teammate integration supplies manifests, locks, scripts, migrations/seeds, Docker/Compose, and environment schema; this change does not alter PRs #7–#14.
- Tracker: [#15](https://github.com/TheVillegas/StockAware/issues/15).

## Success Criteria
- [ ] Scaffold PR/push runs baseline and records absent stacks as `not_applicable`.
- [ ] With manifests, every stated Node/Python command, PostgreSQL lifecycle, and Compose validation produces 30-day safe SHA/run evidence.
- [ ] A controlled test, HIGH/CRITICAL dependency/image finding, or any secret fails the gate; MEDIUM/LOW warn.
- [ ] `CI critical gate` is proven stable on develop before main; no conditional internal job is required directly.
- [ ] No excluded work is introduced.
