# Production audit: 17 November 2026

Baseline: `main` at `14a3107a722e4f86bad781fa00b013c4eaf96a92`.

## Initial production evidence

- ACR build `cb86` succeeded. The baseline tag has digest `sha256:d43ce6990dc222122d218e5c2f46f076efe9f22f4957338d51fbe0f1be0aa7b9`.
- `az webapp sitecontainers list` reported that exact image in `cdc-api-prod` / `CDC-Prod-RG`, container `main`, target port `5000`. Runtime logs confirmed it was pulled and started.
- Container logs downloaded with `az webapp log download` and extracted using `tar -xf` show migration `20261115204500_readiness_passport_workspace` applied successfully at 2026-11-15 18:16:40 UTC. The next startup reported no pending migrations and listened on port 5000.
- Initial HTTP checks: courses `200`; passport/me and workspace-access `401`; readiness/my/summary incorrectly `404`.
- `cdc.org.ge` resolved to Vercel deployment `cdc-public-site-3mmn4ci13-iako-digitals-projects.vercel.app`. The next three production deployments had failed, leaving this older deployment live.
- The production CORS preflight allows `https://cdc.org.ge` and the Authorization header.

## Defects corrected

| Area | Correction |
| --- | --- |
| Workspace guard | Remove invalid JSX; wait for auth; recheck access for the current user and Studio; obtain admin access from the API. |
| Entitlements | Replace nonexistent `ToolSubscription` lookup with active, unrevoked `AccessGrant` records. Register both Studios for the existing 29 GEL subscription checkout and return flow. Reuse the same Studio rules in access probes and checkout. Preserve the existing 90-day matching-course window. |
| Navigation | Mount workspace cards on the dashboard; add its passport link; expose certificate verification links on both passport pages. |
| Readiness API | Add the summary route; require course access; restrict lecturer grading to managers and super administrators; record evaluator identity; validate grades. |
| Readiness scores | Derive attendance from lesson progress and assignment completion from approved required submissions. Remove camera/file-based mark inflation, fabricated faculty grades, and rounded-up eligibility. AI evaluation uses persisted text and faculty feedback through the existing provider service, with a per-user rate limit and validated output. Evidence hashes invalidate grades when work or prompts change. Legacy grades lacking provenance do not qualify. |
| Exam gate | Enforce the >=90% requirement in exam status, start and submit, as well as the frontend. |
| Studio work | Replace a nonexistent upload API with the actual upload-then-submit assignment flow, and refresh readiness after progress/submission changes. |
| Passport | Generate full UUID-based codes; resolve hyphenated UUIDs correctly; retain unambiguous legacy links; exclude banned/deactivated public identities. Use `CourseCertificate.verificationCode`, certified skills, completed training counts, and refreshed readiness records. |
| Classroom recordings | Upload actual browser video to private Azure Blob storage, persist recording metadata in PostgreSQL, and issue short-lived download URLs after classroom authorization. Restrict publication to assigned trainers/admins and screen monitoring to the appropriate viewer. Email a durable authenticated classroom link instead of a browser-local blob URL. |
| Resend | Handle resolved API errors as failures, report zero accepted recipients when unconfigured, deduplicate recipients, batch BCC recipients, escape HTML, and retain recordings when notification fails. A successful send means provider acceptance; it does not prove inbox delivery. |

## Verification

- `pnpm --dir Backend run build`
- `pnpm --dir Backend exec prisma validate`
- `pnpm --dir Backend exec jest --runInBand productionReadinessAudit.test.ts`: 25 tests.
- `pnpm --dir Frontend run build`: full Next.js build, including TypeScript and lint. Existing repository lint warnings remain.
- `pnpm --dir Frontend exec playwright test --config playwright.audit.config.ts`: 7 browser checks with API fixtures, covering both allowed/denied Studios, the anonymous return redirect, and private/public passport flows.

The regression suite mocks database/provider boundaries; it does not send production email, generate production grades, or create student records. Deployment verification must additionally check the final ACR image, runtime startup/migration logs, all four requested live HTTP statuses, and Vercel's production alias.

## Operational limits

- The additive migration `20261117170000_persist_classroom_recordings` adds readiness provenance fields and durable classroom recording metadata. Existing readiness scores without authenticated faculty provenance require a new faculty grade. AI grades require evaluation of the current evidence.
- AI evaluation reads submitted text and faculty feedback; it explicitly cannot inspect attachment/link content. Camera availability alone does not prove attendance. Attendance follows persisted LMS completion.
- Browser recording uploads are limited to 100 MB. Classroom screen frames remain transient in process memory; durable recording metadata survives restart.
- Historical application logs contain Gemini 429 quota, 503 availability and timeout errors after otherwise successful startups. Infrastructure health does not establish AI provider availability.
- Provider acceptance and mailbox delivery are different checks. Recipient inbox delivery requires a separately authorized test recipient or an actual session event; this audit does not email enrolled students as a smoke test.

## Release procedure

Push the tested fix commit to Azure Repos `main`, then run `scripts/deploy-prod.ps1` with that exact SHA and `-AcknowledgeStartupMigrations`. Deploy the same commit to Vercel project `cdc-public-site` (`prj_nLtJUVmvrlOAKcNlrUu7t1gLSC3L`) in team `team_fP05bFuhtFJzd0IjVWLvFAmE`. Keep the baseline image tag above available as the previous image; the new database migration is additive.
