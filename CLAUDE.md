# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend (`backend/`)
```bash
npm run dev              # nodemon server.js — local dev server (reads backend/.env)
npm start                # node server.js — production start
npm run seed             # node seed.js — upserts 3 seeded users: devin/1234 (ADMIN), paresh/5678 (MANAGER), manish/7411 (SALES)
npm test                 # jest --forceExit — runs backend/__tests__/api.test.js (Prisma is fully mocked, no real DB needed)
npx jest -t "test name"  # run a single test by name
npx prisma db push       # apply schema.prisma changes to the DB — this project has no tracked migrations/ dir, always use db push for local dev
npx prisma generate      # regenerate Prisma Client after schema changes
node scripts/backfillPermissions.js   # idempotent — backfills UserPagePermission rows for any user that has none
```

### Frontend (`frontend/`)
```bash
npm run dev       # vite — dev server at :5173
npm run build     # vite build — PRODUCTION MODE BY DEFAULT: loads .env.production, which points VITE_API_BASE at the live server (116.74.77.22). Loads .env, .env.local, .env.[mode], .env.[mode].local in that order (later overrides earlier).
npm run lint      # eslint .
npx cap sync android   # copy dist/ into the Android project after a build
```

To build a debug APK against a specific backend (e.g. local, for emulator testing), don't use the default `npm run build` — it always resolves to production. Instead create a scoped env file and pass `--mode`:
```bash
# e.g. frontend/.env.emulator.local (gitignored via the *.local pattern):
#   VITE_API_BASE=http://10.0.2.2:3001   (10.0.2.2 is the Android emulator's alias for the host machine)
#   VITE_SOCKET_URL=http://10.0.2.2:3001
npx vite build --mode emulator
npx cap sync android
cd android && ./gradlew assembleDebug   # requires JAVA_HOME set to a JDK 21 (some Capacitor plugins need it; JDK 17 fails)
```
`frontend/android/local.properties` (`sdk.dir=...`) and `frontend/android/app/google-services.json` are machine-local / secret and are not committed — regenerate/copy them per machine. There is no release keystore in this repo (`frontend/key.properties` doesn't exist), so release builds fall back to a debug-signed APK — see `deploy.py`'s `assembleRelease`→`assembleDebug` fallback logic for the canonical build sequence this project uses.

## Architecture

### Stack
React 19 + Vite frontend, wrapped in Capacitor for the Android app (package `com.mivoxspas.ordermanager`); Express 5 + Prisma 5 + PostgreSQL backend; Socket.IO for realtime order sync; Firebase Cloud Messaging for push notifications on Android.

### Backend layering
Routes (`backend/routes/*.js`) → services (`backend/services/*.js`, plain Prisma-calling functions, no framework coupling) → Prisma. Routes handle validation (`express-validator`), auth/permission middleware, `req.auditLog(...)` calls, and `io.emit(...)` for realtime UI push — business logic and DB access lives in services. `backend/server.js` wires everything together; `io` is stashed on the Express app via `app.set('io', io)` so route handlers can reach it via `req.app.get('io')`.

### Auth
JWT signed in `routes/auth.js`, verified by `middleware/authUtils.js`'s `authMiddleware` — checks the `auth_token` httpOnly cookie first, falls back to `Authorization: Bearer <token>` header (the Bearer path is what the Capacitor app uses, since cookies aren't reliable in a native WebView; it also bypasses CSRF — see `server.js`'s CSRF middleware, which skips `csrfProtection` whenever a Bearer header is present). `authMiddleware` sets `req.user` directly from the JWT payload (`{id, username, role, iat, exp}`) — **not** re-fetched from the DB except to check `isActive`, so role changes don't take effect until the token expires or the user re-logs in (this is a known, accepted staleness — see the permission system below for how it's mitigated for permissions specifically).

### Per-page permission system
Beyond the 3 roles (`ADMIN`/`MANAGER`/`SALES`, stored as a plain `String` on `User`, not a Prisma enum), each user has independent view/edit/delete rights per page, stored in `UserPagePermission` (`userId`, `page`, `canView`, `canEdit`, `canDelete`; unique on `[userId, page]`). Page keys: `sales, customers, status, delivered, report, dashboard, items` (7 keys — note `users` is deliberately **not** one of them, see below). Defaults per role live in `backend/services/permissionDefaults.js`, applied transactionally when a user is created (`backend/services/userService.js`) — mirrored client-side in `frontend/src/UserManagement.jsx`'s `ROLE_DEFAULTS` for the create-form preview (keep both in sync if defaults change).

Enforcement: `backend/middleware/pagePermission.js`'s `requirePagePermission(pages, level)` — `pages` can be a single key or an array (array = union: any one qualifying page is enough). `role === 'ADMIN'` always passes, as a safety net against a misconfigured permission row locking out admins. The union form exists because `sales`, `status`, and `delivered` pages all call the *same* order-mutation endpoints (`PUT /:id/status`, `DELETE /:id`, `PUT /:id` in `routes/orders.js`) — there's no clean 1:1 page↔endpoint mapping for orders the way there is for customers/items, so the deliberate design is "edit rights on any one order-touching page grants the mutation," rather than trying to thread a spoofable "which page" hint through the API.

**Hard exception**: the `users` page (user management itself) is never stored as a `UserPagePermission` row for anyone and is never customizable — access is hardcoded `requireRole(['ADMIN'])` server-side (`routes/users.js`) and `role === 'ADMIN'` client-side, so nobody can ever be granted rights to manage other users' access via the permission system.

Frontend mirror: `frontend/src/apiUtils.js` exports `getPermissions()`/`canViewPage()`/`canEditPage()`/`canDeletePage()`, reading a `STORAGE_KEYS.USER_PERMISSIONS` snapshot in localStorage that's refetched from `GET /api/users/me/permissions` on every app mount (`App.jsx`) and again right after login (`Login.jsx` — needed because login navigates client-side, so `App.jsx`'s mount-only effect won't re-run). `ProtectedRoute` in `App.jsx` takes either a `requiredPage` prop (string or array, checked against the cached permissions) or a hardcoded `allowedRoles` prop (used only for the `/users`-equivalent hard-boundary case). Bottom-nav link visibility and in-page edit/delete button visibility both read from the same cached permissions — but note this is a client-side convenience only; the backend is the actual enforcement point.

### Page structure / recent merges
The nav is `New Order → Live Orders → Delivered → Master → Report → Admin`. Two things got merged into single pages/routes while keeping their underlying permission keys independent:
- **Master** (`frontend/src/Master.jsx`, route `/master`) composes `CustomerMaster` + `ItemMaster` as two sections, each gated by its own `customers`/`items` permission — a user might see one section but not the other.
- **Admin** (`frontend/src/ManagerDashboard.jsx`, route `/dashboard`) composes the Settings/backup panel + `UserManagement` (imported directly, not routed separately) — both sections are hardcoded `isAdmin`-gated regardless of the `dashboard` page permission, since backup/restore and user management are both too sensitive to delegate via a generic per-page edit flag.

When adding a new page-merge like this, update `PAGE_LABELS` in `UserManagement.jsx` to match — it's a manually-maintained display map from permission-key → current nav wording, and it does *not* auto-derive from the actual route/nav structure, so it silently goes stale if routes are renamed without updating it too.

### Push notifications
`backend/services/pushService.js` wraps Firebase Admin SDK (v14+ modular API — `require('firebase-admin/app')`/`require('firebase-admin/messaging')`, not the old `admin.credential`/`admin.messaging()` namespace style). Lazily initialized from `FIREBASE_SERVICE_ACCOUNT_PATH` env var; no-ops with a console warning if unset, so push failures never break order creation. `sendOrderNotification` excludes the acting user and auto-prunes device tokens FCM reports as invalid. Frontend registration is in `frontend/src/pushNotifications.js`, called after login; `frontend/android/app/google-services.json` (gitignored) must match the current `applicationId` in `build.gradle` or the Google Services Gradle plugin fails the build outright.

### Local dev environment gotchas
This repo's `node_modules` and Android tooling were originally set up on a different machine — on a fresh machine you may hit: `node_modules/.bin/*` missing the executable bit (`chmod +x`), and native bindings (e.g. `bcrypt`) built for the wrong OS/arch (delete the package's `node_modules/<pkg>` dir, `npm approve-scripts <pkg>` if install scripts are blocked, then `npm rebuild <pkg>`). No local Postgres is assumed to exist — `brew install postgresql@16` and create a role/DB matching `backend/.env`'s `DATABASE_URL` if starting from scratch.

### Deployment status
As of this writing, the live server (116.74.77.22, PM2 process `order-manager`) has **not** been updated with the permission system, push notifications, or the Master/Admin page merges — those exist only in this repo, applied locally. A production-pointed build will log in fine but 404 on `/api/users/me/permissions` and `/api/devices/register`, since neither route exists on the deployed backend yet.
