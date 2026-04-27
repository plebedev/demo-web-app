# Invite-Only Demo Frontend

This repository is the invite-only frontend/BFF for the phase-1 demo. It stays intentionally small, but it now includes the browser-facing invite gate at `/`, signed-token persistence, the protected `/messy-notes` demo workspace, and explicit demo guardrails.

## What is included

- Next.js app with an invite-only phase-1 shell
- Protected `/messy-notes` workspace for run creation, editing, status viewing, and history
- Health endpoint at `/api/health`
- BFF proxy entry point at `/api/bff/*` for backend integration
- Browser localStorage persistence for the phase-1 signed access token
- A protected frontend status card that checks backend connectivity through the BFF
- Vitest + Testing Library tests for token-gating behavior, protected workspace rendering, and sticky-note note-board rendering
- Multi-stage production `Dockerfile`
- Helm chart under [deploy/helm/frontend-bff](/Users/plebedev/github/demo-web-app/deploy/helm/frontend-bff)
- Shell deploy helpers under [deploy/scripts](/Users/plebedev/github/demo-web-app/deploy/scripts)
- `Taskfile.yml` wrappers for common local and deployment commands
- A registry-free ship-and-deploy flow for a single remote k3s VM

## Repository layout

```text
.
|-- Dockerfile
|-- Taskfile.yml
|-- README.md
|-- deploy/
|   |-- helm/
|   |   `-- frontend-bff/
|   |       |-- Chart.yaml
|   |       |-- values.yaml
|   |       |-- values-demo.yaml
|   |       `-- templates/
|   `-- scripts/
`-- src/
    `-- app/
```

## Prerequisites

- Node.js 20+
- Docker
- `kubectl` configured for the target `k3s` cluster
- Helm 3

## Local development

1. Install dependencies:

```bash
task install
```

2. Create a local env file if you want custom config:

```bash
cp .env.example .env.local
```

3. Run the app:

```bash
task dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## Demo guardrails

This is a demo, not a general-purpose assistant.

Supported phase-1 inputs:

- pasted text
- text file upload
- PDF upload with extractable text

Not supported in phase 1:

- images
- OCR
- audio/video
- web lookup

Current hard-limit placeholders:

- `NEXT_PUBLIC_MAX_FILES_PER_RUN`
- `NEXT_PUBLIC_MAX_FILE_SIZE_BYTES`
- `NEXT_PUBLIC_MAX_EXTRACTED_TEXT_BYTES`
- `NEXT_PUBLIC_MAX_TOTAL_WORKFLOW_TEXT_BYTES`

Follow-up rules:

- one generated brief per run
- at most one follow-up question after brief generation
- the follow-up must be about the generated brief
- after that, the user must start a new run

The full brief workflow is not implemented yet. The UI documents these guardrails now, and the codebase contains TODO boundaries where the real brief-generation flow should enforce them later.

## M2 demo shell

This milestone adds the first runnable protected demo shell:

- `/` stays the public invitation page
- successful invitation validation redirects the browser to `/messy-notes`
- `/messy-notes` lists saved runs and creates new draft runs
- `/messy-notes/<runId>` lets the user paste notes, preview them as sticky-note cards, save the draft, and submit the run
- `/messy-notes/about` explains the bounded product and practical architecture

If a user lands on `/messy-notes` without a valid access token in localStorage, the app redirects back to `/`.

## Local production build test

```bash
task build
npm run start
```

## Tests

Run the normal frontend checks with:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Runtime configuration

The app is prepared for future backend integration through environment variables.

| Variable | Purpose | Example |
|---|---|---|
| `PORT` | Container listen port | `3000` |
| `APP_NAME` | Server-side app label | `Very Serious Prototype :)` |
| `NEXT_PUBLIC_APP_NAME` | Frontend app label | `Very Serious Prototype :)` |
| `NEXT_PUBLIC_STAGE` | Frontend environment marker | `demo` |
| `BACKEND_BASE_URL` | Explicit override for `/api/bff/*` proxy routes | `http://127.0.0.1:8000/api` |
| `BACKEND_LOCAL_URL` | Local-development backend base URL | `http://127.0.0.1:8000/api` |
| `BACKEND_CLUSTER_URL` | Cluster-internal backend base URL | `http://backend-api.demo.svc.cluster.local/api` |
| `NEXT_PUBLIC_MAX_FILES_PER_RUN` | UI-visible phase-1 max files per run placeholder | `3` |
| `NEXT_PUBLIC_MAX_FILE_SIZE_BYTES` | UI-visible phase-1 max file size placeholder | `5242880` |
| `NEXT_PUBLIC_MAX_EXTRACTED_TEXT_BYTES` | UI-visible extracted-text limit placeholder | `250000` |
| `NEXT_PUBLIC_MAX_TOTAL_WORKFLOW_TEXT_BYTES` | UI-visible total workflow text limit placeholder | `400000` |

Resolution order is:

- `BACKEND_BASE_URL` if set
- otherwise `BACKEND_LOCAL_URL` during `npm run dev`
- otherwise `BACKEND_CLUSTER_URL` in production-like runtime

If no backend URL resolves, `/api/bff/*` returns `503`, which makes the missing backend wiring obvious.

## Build the container image

Images are tagged explicitly. The default image tag is the current short git commit SHA.

### Build locally

```bash
task docker-build
```

### Verify the deployment

```bash
kubectl get all -n demo
kubectl get ingress -n demo
kubectl rollout status deployment/frontend-bff -n demo
```

On a standard `k3s` install with Traefik, the Ingress is hostless and routes `/` over plain HTTP, so you can test from the VM public IP directly:

```bash
curl http://<VM_PUBLIC_IP>/
curl http://<VM_PUBLIC_IP>/api/health
```

## Roll back

To inspect release history:

```bash
./deploy/scripts/rollback.sh
```

To roll back to a specific revision:

```bash
./deploy/scripts/rollback.sh 2
```

Or with `task`:

```bash
RELEASE_NAME="$RELEASE_NAME" NAMESPACE="$NAMESPACE" REVISION=2 task rollback
```

## Helm values

Default chart settings live in [deploy/helm/frontend-bff/values.yaml](/Users/plebedev/github/demo-web-app/deploy/helm/frontend-bff/values.yaml).

Demo environment overrides live in [deploy/helm/frontend-bff/values-demo.yaml](/Users/plebedev/github/demo-web-app/deploy/helm/frontend-bff/values-demo.yaml).

The chart renders:

- `Deployment`
- `Service`
- `Ingress`
- `ConfigMap`

Namespace creation is handled by the deploy script using `kubectl create namespace` if needed, and Helm also runs with `--create-namespace`.

## Registry-free ship deploy to the VM

For a single-node `k3s` VM, the recommended flow is:

```bash
task ship-deploy
```

This deploy mode:

- uses the current `HEAD` commit hash as the image tag
- refuses to run if operational files have uncommitted changes
- builds the app and Docker image locally on your laptop
- saves the image as a tar archive
- ships the committed repo snapshot plus the image tar to the VM over `scp`
- imports the image into the VM's `k3s` containerd
- runs `helm upgrade --install` on the VM with `image.pullPolicy=Never`
- prunes remote shipped artifacts and extracted releases, keeping only the newest three by default

Optional variables:

- `DEPLOY_PATH`
  Remote working directory, default: `/home/ubuntu/frontend-bff-deploy`
- `IMAGE_REPOSITORY`
  Default: `frontend-bff`
- `RELEASE_NAME`
  Default: `frontend-bff`
- `NAMESPACE`
  Default: `demo`
- `VALUES_FILE`
  Default: `deploy/helm/frontend-bff/values-demo.yaml`
- `SSH_OPTS`
  Extra SSH/SCP flags, for example: `-i ~/.ssh/oracle_vm`
- `KEEP_REMOTE_RELEASES`
  Number of shipped image/source artifacts and extracted release directories to retain on the VM, default: `3`

Default target VM:

```bash
ubuntu@openclaw
```

VM prerequisites for this flow:

- `k3s` already installed and working
- `helm` available on the VM
- `kubectl` available on the VM
- `sudo k3s ctr images import` works for your user
- the remote directory exists or can be created, for example `/home/ubuntu/frontend-bff-deploy`
- the k3s kubeconfig is available at `/etc/rancher/k3s/k3s.yaml` or you override `KUBECONFIG_PATH`

The remote script used by this flow is [deploy/scripts/remote-deploy.sh](/Users/plebedev/github/demo-web-app/deploy/scripts/remote-deploy.sh).

## Access model

- First screen is invitation-code entry when this browser has no valid access token
- Successful code redemption returns a signed backend token and stores it in localStorage
- Protected UI calls send the token through the BFF to the backend
- If the backend rejects the token as invalid or expired, the UI clears local state and returns to invitation entry

## Notes for future backend and webhook routes

This repo is designed to stay focused on the frontend/BFF layer. When the backend arrives in its own repo:

- Keep backend business endpoints behind an internal Kubernetes `Service`
- Point `BACKEND_BASE_URL` at that internal service DNS name
- Add frontend-safe BFF routes under `src/app/api/bff/`
- If you later need public webhook endpoints with different security or scaling requirements, expose them from the backend repo instead of routing them through this frontend service

## Helpful commands

```bash
task install
task dev
task test
task build
task docker-build
task ship-deploy
```
