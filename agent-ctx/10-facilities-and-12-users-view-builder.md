# Work Record — Task 10-facilities-and-12-users

Agent: View Builder (Facility Mgmt + User Mgmt)
Task: Build two Super Admin views per PRD §12.

## Files Created
1. `src/views/facilities-view.tsx` — Pengurusan Kemudahan (Facility Management)
2. `src/views/users-view.tsx` — Pengurusan Pengguna & Peranan (User & Role Management)

## Key Decisions
- Used named export `FacilitiesView()` / `UsersView()` per spec ("Default export: `export function FacilitiesView()`"). Also added `export default` for safety.
- Wrapped both views in `<motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}>` per spec.
- Inline `tr(bm, en)` helper used for non-dictionary strings; `t()` for keys present in i18n.ts.
- Super-admin gating done client-side (server also enforces via RBAC) — non-admins see an amber access-denied card.
- Equipment parsed defensively: tries JSON array first, falls back to comma/semicolon split.
- Avatar color palette excludes indigo/blue per project rules.
- `useQuery({ enabled: isSuperAdmin })` on UsersView to prevent unauthenticated fetches.
- `enabled: false`-style guards on action buttons for self-deletion/suspension (matches server rule).
- Color picker: native `<input type="color">` plus a mono hex Input + preview swatch.
- Time inputs: `<Input type="time">` (browser-native).
- All mutations use `useMutation` + `useQueryClient` + `invalidateQueries` + sonner toast.
- Status cycle on facilities: ACTIVE→MAINTENANCE→INACTIVE→ACTIVE; INACTIVE branch opens AlertDialog.
- Soft delete semantics preserved (DELETE sets status=INACTIVE; UI shows the row with INACTIVE StatusBadge after refresh).

## Pre-existing issues NOT touched (out of task scope)
- `src/app/api/audit/route.ts` — no-assign-module-variable lint error
- `src/components/topbar.tsx` — react-hooks/set-state-in-effect
- `src/hooks/use-current-user.ts` — react-hooks/set-state-in-effect
- TS errors in prisma/seed.ts, examples/websocket/, skills/, src/app/api/feedback/route.ts, src/lib/auth.ts

## Verification
- tsc: 0 errors in new files
- lint: 0 errors in new files
- dev.log: clean compile after file writes
