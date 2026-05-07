# Invite-Only Demo Frontend

This repository is the invite-only frontend/BFF for the phase-1 demo. It stays intentionally small, but it now includes the browser-facing invite gate at `/`, signed-token persistence, the protected `/messy-notes` demo workspace, and explicit demo guardrails.

The live demo is deployed at [demo.lebedev.ai](https://demo.lebedev.ai).

## What is included

- Next.js app with an invite-only phase-1 shell
- Protected `/messy-notes` workspace for run creation, editing, status viewing, and history
- `/messy-notes/<runId>` ingestion UI for pasted text, file uploads, and honest boundary reporting
- `/messy-notes/<runId>` result UI for completed brief output, execution summary, and audit summary
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

Current hard limits:

- `NEXT_PUBLIC_MAX_FILES_PER_RUN`
- `NEXT_PUBLIC_MAX_FILE_SIZE_BYTES`
- `NEXT_PUBLIC_MAX_EXTRACTED_TEXT_BYTES`
- `NEXT_PUBLIC_MAX_PASTED_TEXT_BYTES`
- `NEXT_PUBLIC_MAX_TOTAL_WORKFLOW_TEXT_BYTES`

Follow-up rules:

- one generated brief per run
- exactly one brief-scoped follow-up question per completed run
- unrelated broad chat and second follow-ups are rejected by the backend
- follow-up response state is stored with the run

Submitting a run executes the bounded messy-notes workflow. The current brief
formatter is intentionally simple and heuristic; completed runs show the brief,
recent execution events, and the post-run audit summary.

## M6 demo polish

The protected `/messy-notes` workspace now includes curated backend-loaded
sample chaos sets, stronger sticky-note board styling, optional SMS preference
capture, and one guarded follow-up after a brief is complete. Notification
sending is not performed by an agent; the backend validates US phone numbers,
checks permanent opt-out status, and sends completion texts through Twilio from
coded run-completion behavior. The UI shows when a number is on the permanent
opt-out list, prevents enabling SMS for that number, and saves changed SMS
preferences automatically when the user saves a draft or submits a run. The SMS
controls are hidden unless the backend status response returns
`features.SmsNotification: true`.

Frontend coverage for sample loading, sticky-note rendering, notification
preference UI, and follow-up state is included in:

```bash
npm run test
npm run lint
npm run typecheck
npm run build
```

## M5 runtime visibility

The protected run detail page now shows the M5 backend execution result:

- run status after synchronous submit/execution
- generated structured brief output
- recent structured run events as a compact execution summary
- first post-processor audit summary for tool use and agent handoffs

Frontend coverage for this view is part of the normal workflow:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## M3 input ingestion

This milestone turns the M2 shell into a real phase-1 intake flow:

- `/` is still the invite gate
- successful invite redemption still routes to `/messy-notes`
- visitors without a code can submit a simple invite request and receive the code by email
- `/messy-notes/<runId>` now accepts pasted text plus file uploads
- accepted files, rejected files, and trimming warnings are rendered directly in the protected workspace
- the UI stays explicit about what is unsupported and why

The trimming strategy is fixed and documented to match the backend:

- keep the first supported files in upload order
- keep the first bytes that fit the configured text budgets
- do not pretend the app deeply ranked notes that were dropped

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

The app connects to the backend through BFF routes configured by environment variables.

| Variable                                    | Purpose                                                | Example                                         |
| ------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------- |
| `PORT`                                      | Container listen port                                  | `3000`                                          |
| `APP_NAME`                                  | Server-side app label                                  | `Very Serious Prototype :)`                     |
| `NEXT_PUBLIC_APP_NAME`                      | Frontend app label                                     | `Very Serious Prototype :)`                     |
| `NEXT_PUBLIC_STAGE`                         | Frontend environment marker                            | `demo`                                          |
| `BACKEND_BASE_URL`                          | Explicit override for `/api/bff/*` proxy routes        | `http://127.0.0.1:8000/api`                     |
| `BACKEND_LOCAL_URL`                         | Local-development backend base URL                     | `http://127.0.0.1:8000/api`                     |
| `BACKEND_CLUSTER_URL`                       | Cluster-internal backend base URL                      | `http://backend-api.demo.svc.cluster.local/api` |
| `NEXT_PUBLIC_MAX_FILES_PER_RUN`             | UI-visible phase-1 max files per run                   | `3`                                             |
| `NEXT_PUBLIC_MAX_FILE_SIZE_BYTES`           | UI-visible phase-1 max file size                       | `5242880`                                       |
| `NEXT_PUBLIC_MAX_EXTRACTED_TEXT_BYTES`      | UI-visible extracted-text budget across accepted files | `250000`                                        |
| `NEXT_PUBLIC_MAX_PASTED_TEXT_BYTES`         | UI-visible raw pasted-text storage limit               | `200000`                                        |
| `NEXT_PUBLIC_MAX_TOTAL_WORKFLOW_TEXT_BYTES` | UI-visible total normalized workflow text limit        | `400000`                                        |

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

The public demo hostname is [demo.lebedev.ai](https://demo.lebedev.ai).

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
- Invite requests are submitted through the BFF; the backend persists them and prepares the invite email asynchronously

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
