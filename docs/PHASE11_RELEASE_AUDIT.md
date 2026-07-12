# Phase 11 Release Audit

Release candidate: `1.0.0-rc.1`

## Phase 1-10 completion matrix

| Phase | Scope verified in source | Status | Evidence / limitation |
| --- | --- | --- | --- |
| 1 | Dashboard, Daily Entry, core CRUD, Supabase auth | Implemented | Static/unit/build and authenticated owner workflow pass. |
| 2 | Roles, multi-store foundation, Monthly Totals | Implemented | Store switching and monthly source precedence are tested. |
| 3 | Cash reconciliation and tender controls | Implemented | Calculation and authenticated save flows pass; employee cash access is enforced in UI/actions/RLS. |
| 4 | Fuel grades, delivery/tank reconciliation | Implemented | Fuel parser, calculation, and reporting tests pass. |
| 5 | Configurable margin settings | Implemented | Reports use product actual cost first, then current margin settings. |
| 6 | Smart Import review, rules, posting, rollback | Implemented | CSV/XLSX/readable PDF/image-only fallback/Sunoco tests pass; live posting and rollback reversal pass. OCR remains disabled. |
| 7 | Inventory, purchase orders, receiving, histories | Implemented | Live receipt, duplicate prevention, histories, shrink, sale deduction, and reversal pass. |
| 8 | Reports, exports, onboarding, responsive UI | Implemented | Live CSV/PDF/ZIP and mobile reporting suite passes. Electron packaging is checked separately. |
| 9 | End-of-Day Close | Implemented | Live close/reopen flow passes after migrations 011 and 012. |
| 10 | Bank matching, confidence, permissions, membership RLS | Implemented with one test limitation | Live schema/policies/grants and owner browser flow pass. Full automated multi-role runtime RLS still needs a non-empty service-role key. |

## Live Supabase result

- All 41 application tables and both inventory RPCs exist.
- Store thresholds, `daily_close_statuses`, bank-match columns, membership helpers, explicit grants, and membership policies are installed.
- Legacy `TRUNCATE`, `TRIGGER`, and `REFERENCES` privileges were removed from `anon` and `authenticated`.
- The live migration history records the Phase 11 release migration and focused hardening fixes.
- Migrations 013 and 014 add accurate lottery/deposit status fields, dedicated close/reopen RPCs, owner-only reopen enforcement, and scoped policy cleanup.
- Supabase performance advisor findings for uncovered foreign keys, duplicate indexes, and membership-policy init plans were remediated by migration 012. Remaining performance notices are unused-index informational notices on the low-traffic QA project.
- The security advisor retains five intentional warnings for membership-scoped `SECURITY DEFINER` helpers required by RLS. These helpers validate `auth.uid()` and reveal no cross-store data. Leaked-password protection remains a project-level Auth setting to enable before production.

## Calculation source of truth

- Application reporting is authoritative.
- Monthly Totals replace daily/POS rows for covered months.
- POS rows replace manual Daily Entry totals for the same date.
- Product actual profit replaces the corresponding category estimate.
- Remaining category revenue uses current `margin_settings`.
- Legacy generated estimates remain for compatibility and are marked as legacy in database comments.
- Reports retain actual, estimated, mixed, and partial-actual labels.

## Remaining limitations

- Password recovery code is complete, but production reset/verification email delivery requires manual acceptance with deployed redirect URLs.
- OCR is disabled; image-only PDFs return a manual-review row.
- Inventory can become negative when sales precede an opening count; negative values appear as low-stock exceptions.
- Member invitations are claimed by email on sign-in; the app does not send invitation email.
- `npm run test:rls-live` requires a non-empty `SUPABASE_SERVICE_ROLE_KEY`.
- Enable Supabase Auth leaked-password protection before production: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Vercel deployment and backup restore require deployment credentials. `desktop:pack` produced partial `win-unpacked` output but did not complete within seven minutes on this workstation; the builder processes were stopped cleanly, so desktop/NSIS packaging remains a release-workstation check.

## Manual owner acceptance

1. Rotate or remove any historical shared test account; configure QA credentials through secrets.
2. Verify Supabase Auth Site URL and redirect URLs for local, Vercel, and desktop origins.
3. Request password reset, follow the email, set a new password, and sign in.
4. Invite manager, employee, and accountant users and verify role-specific visibility and writes.
5. Complete a clean close and an override close; confirm only an owner can reopen.
6. Import a bank export and approve, reject, ignore, and manually link rows.
7. Receive a test PO and compare inventory, vendor-cost history, and price history.
8. Compare on-screen P&L with CSV, PDF, and Accountant ZIP for one closed month.
9. Confirm backups and perform a restore rehearsal in a disposable project.
10. Run all static, RLS, E2E, POS, report, and inventory suites before tagging `1.0.0`.

## Recommendation

Ready for owner acceptance testing as `1.0.0-rc.1`. Do not promote to `1.0.0` until password-email acceptance, full multi-role live RLS execution, backup restore rehearsal, and deployment-platform smoke tests are complete.
