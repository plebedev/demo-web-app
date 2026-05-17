# Agent Notes

## Purpose

This repo is the frontend and BFF only. It is a Next.js app that serves the UI and proxies backend requests through `/api/bff/*`.

It is also the frontend home for modular experiences in the multi-experience demo platform. Experiences compose routes, UI, dashboards, workflows, and experience-specific interactions while reusing shared platform infrastructure.

This repo is not a standalone job-search app, resume analyzer, or interview-prep tool. Job Search / Career Context is the first reference Context Engine-powered experience, and experience UI must not create separate auth, orchestration, storage, ingestion, or vector infrastructure.

## Platform structure

Use these locations for experience work:

- shared frontend utilities and components: `src/shared/`
- experience-specific UI and route composition: `src/experiences/`
- BFF proxy routes: `src/app/api/bff/`

Experience-specific UI code may exist under `src/experiences/`.

Do not duplicate shared platform behavior inside an experience. Browser-facing code should use existing protected routing, invitation/access-token behavior, shared API clients, and BFF proxy conventions.

## Experience rules

- Experiences own route composition, UI composition, dashboard assembly, workflow composition, and experience-specific interactions.
- Experiences may register routes, workflows, dashboards, MCP capabilities, UI composition, and domain-pack usage when the supporting backend APIs exist.
- An experience should be replaceable without changing shared frontend infrastructure.
- Keep experience-specific state and components behind experience boundaries.
- Keep reusable UI, API, auth, and routing helpers in shared frontend locations.
- Do not hardcode job-search concepts into shared frontend infrastructure.
- Do not imply unsupported demo capabilities such as OCR, audio/video, image understanding, or web lookup unless they are actually implemented.

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

## When making changes

- If you change backend URL/env conventions, check Helm values, `.env.example`, and BFF config together
- If you change deploy behavior, keep task defaults simple: normal command should stay `task ship-deploy`
- If you change API contract used by the status card or BFF, update the backend repo in the same session when possible
- If you add or change an experience, explicitly confirm that it reuses shared auth, routing, BFF, and API infrastructure
- If you add shared frontend infrastructure, explicitly confirm that no job-search-specific logic leaked into shared code
