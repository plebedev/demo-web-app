# CLAUDE.md

## Purpose

This repo is the frontend and BFF only. It is a Next.js app that serves the UI and proxies backend requests through `/api/bff/*`.

## Normal workflow

### Local

```bash
task install
task dev
task build
```

- local frontend port: `3000`
- local backend traffic should go through BFF proxy routes
- local backend target is configured with:
  - `BACKEND_LOCAL_URL`

### Deploy

```bash
task ship-deploy
```

Defaults:

- deploy target: `ubuntu@openclaw`
- remote path: `/home/ubuntu/frontend-bff-deploy`
- namespace: `demo`
- release name: `frontend-bff`

## Backend integration rules

- Browser code should not talk directly to the backend service
- Server-side BFF routes under `src/app/api/bff/` own backend proxying
- Backend URL resolution order is:
  1. `BACKEND_BASE_URL`
  2. `BACKEND_LOCAL_URL` during local dev
  3. `BACKEND_CLUSTER_URL` in deployed runtime
- Current cluster backend URL convention:
  - `http://backend-api.demo.svc.cluster.local/api`

## Deployment model

- No image registry is used in the normal flow
- Image builds happen locally
- Images are shipped to the VM as tar archives
- Remote deploy imports images into `k3s` and runs Helm
- Image tags default to short git SHA

## Important files

- `Taskfile.yml`
- `deploy/helm/frontend-bff/`
- `deploy/scripts/ship-deploy.sh`
- `deploy/scripts/remote-deploy.sh`
- `src/lib/config.ts`
- `src/app/api/bff/[...path]/route.ts`
- `src/components/backend-status-card.tsx`

## Current decisions

- single-node `k3s` on Oracle VM
- Traefik ingress
- public app reachable by domain / ingress, not by separate backend exposure
- frontend remains focused on UI + BFF concerns
- webhook/public backend exposure, if needed later, should be handled in the backend repo

## Verification

Run `task verify` before considering any change complete. It runs:

```bash
task verify   # npm run lint + typecheck + test + next build
```

Do not mark work done if lint or type-check errors remain.

## UI and component conventions

### New experience workspaces
When adding a new protected experience workspace, it must be visually and structurally
consistent with the existing ones (messy-notes, rag-demo). Read an existing workspace
component before writing a new one. Use the same layout skeleton, the same class names,
and the same patterns for tabs, forms, error states, and data fetching.

### Styling
- Always `className` referencing classes from `src/app/globals.css`. Never `style={{}}`.
- `src/app/globals.css` is the single CSS file — no CSS modules, no Tailwind.
- When a new experience needs layout-specific classes, add them to `globals.css` following
  the naming conventions already present.

### Tests
- Every component `foo.tsx` must have `foo.test.tsx` alongside it.
- Stack: `vitest` + `@testing-library/react`.
- `vi.mock` `next/navigation` and `@/hooks/use-protected-access` at module level.
- `vi.stubGlobal('fetch', vi.fn(...))` in `beforeEach`, `vi.restoreAllMocks()` to clean up.
- `cleanup()` in `afterEach`.
- Cover: renders without crash, tab switching, form fill + submit, API call assertions, error state.

## When making changes

- If you change backend URL/env conventions, check Helm values, `.env.example`, and BFF config together
- If you change deploy behavior, keep task defaults simple: normal command should stay `task ship-deploy`
- If you change API contract used by the status card or BFF, update the backend repo in the same session when possible
