# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Iris Chrome extension (Manifest V3, WXT + React + Tailwind v4, pnpm): AI-assisted job applications. User opens the side panel on an application page; per-field "Fill with iris" buttons and a "Complete application" button generate answers. See PLAN.md for the product plan. Fill/sync API calls are currently STUBS (`src/services/fill.ts`, `src/services/sync.ts`) — auth is real.

## Commands

```bash
pnpm dev          # dev server + auto-reload; output in dist/chrome-mv3-dev
pnpm build        # production build; output in dist/chrome-mv3
pnpm compile      # tsc --noEmit typecheck
pnpm zip          # store-ready zip
```

Load unpacked from `dist/chrome-mv3` (after build) or `dist/chrome-mv3-dev` (only valid while `pnpm dev` runs). Manifest changes require removing + re-adding the extension (or manual ⟳); an open side panel keeps running old JS until reopened.

## Architecture

```
side panel (React UI, all API fetches) ⇄ content script (DOM scan/fill) ; background (panel behavior + injection)
```

- `src/entrypoints/sidepanel/` — main UI. Auth gate → scan / complete-application / sync buttons + field list. Owns ALL API calls (fill/sync stubs run here, triggered by content-script messages).
- `src/entrypoints/content/index.ts` — runtime-registered (`registration: 'runtime'`, NOT in manifest matches); injected on demand by background via `scripting.executeScript`. Scans visible text inputs/textareas/selects, tags them `data-iris-id`, paints fill buttons in ONE shadow-DOM overlay (positions tracked on scroll/resize), writes values via native setter + `input`/`change` events (required for React-controlled forms; `programmaticWrite` flag stops the edit watcher from seeing AI writes), reports manual edits.
- `src/entrypoints/background.ts` — `sidePanel.setPanelBehavior({openPanelOnActionClick})`; handles `INJECT_CONTENT` (file path must be `/content-scripts/content.js` — leading slash).
- `src/lib/messages.ts` — single source of truth for the typed messaging protocol (panel⇄content via `tabs.sendMessage`, content/panel→background via `runtime.sendMessage`). Extend the discriminated unions there.
- `src/lib/types.ts` — `DetectedField` (id/label/kind/value/filledBy/synced), `AuthState`.
- `src/services/auth.ts` — real: `GET ${API_URL}/me` with `credentials: 'include'`.
- `src/lib/config.ts` — URLs from `.env` (`WXT_API_URL`, `WXT_CLIENT_URL`).

## Auth model (zero backend changes)

iris-api keeps a JWT in the HttpOnly `Access_Token` cookie; `GET /me` → user or 401. All fetches run from the SIDE PANEL (an extension page): `host_permissions` on the API origin exempts them from CORS and includes the cookie. Do NOT fetch from the content script — page CORS applies there. Login = open iris-client `/login` in a tab; panel refetches `/me` on focus/visibility.

## Permissions model

- `activeTab` alone is insufficient: it's granted on icon click and revoked on navigation, so Scan clicks inside the panel fail. Scan therefore requests persistent per-site access at click time via `permissions.request({origins})` against `optional_host_permissions: ['http://*/*', 'https://*/*']`. Keep this pattern; don't add `<all_urls>` to `host_permissions`.
- `permissions.request` must run in a user gesture (button click handler).

## Gotchas

- WXT env vars must be prefixed `WXT_` and read via `import.meta.env`.
- Field IDs (`data-iris-id`) are stable per scan only; every scan re-tags and rebuilds the overlay. Guard against double-injection: `window.__irisInjected`.
- Panel resets field state on `tabs.onActivated`/`onUpdated` — content script context also dies on navigation; rescan re-injects.
- `chrome://` / Web Store pages can't be injected; scan blocks non-http(s) URLs up front.
- No shadcn: its portalled components fight the content-script shadow DOM; plain Tailwind.

## Related repos

- `../iris-api` — Go/Gin API (localhost:4000). Future endpoints: `/extension/fill`, `/extension/sync`.
- `../iris-client` — React app (localhost:5173), login page + session cookie source. Extension icons derive from `../iris-client/public/logo.png` (sips-resized into `public/icon/`).
- `../iris-worker` — Temporal worker; autonomous JobApplicationWorkflow stays separate. Field state will persist to its `job_application_data` table (`activity/sqldb/jobapplicationdata.go`).
