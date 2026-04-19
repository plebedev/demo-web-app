# Frontend BFF Starter

This repository is a production-like starter scaffold for a deployable frontend/BFF service targeting a single-node `k3s` cluster. It is intentionally minimal, but it already has the shape you would keep when the UI and backend integration grow.

## What is included

- Next.js app with a simple "Coming soon" page
- Health endpoint at `/api/health`
- BFF proxy entry point at `/api/bff/*` for future backend integration
- Multi-stage production `Dockerfile`
- Helm chart under [deploy/helm/frontend-bff](/Users/plebedev/github/demo-web-app/deploy/helm/frontend-bff)
- Shell deploy helpers under [deploy/scripts](/Users/plebedev/github/demo-web-app/deploy/scripts)
- `Makefile` wrappers for common local and deployment commands
- A single-command full deploy flow that uses the current git commit hash as the image tag
- A registry-free ship-and-deploy flow for a single remote k3s VM

## Repository layout

```text
.
|-- Dockerfile
|-- Makefile
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
npm install
```

2. Create a local env file if you want custom config:

```bash
cp .env.example .env.local
```

3. Run the app:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## Local production build test

```bash
npm run build
npm run start
```

## Runtime configuration

The app is prepared for future backend integration through environment variables.

| Variable | Purpose | Example |
|---|---|---|
| `PORT` | Container listen port | `3000` |
| `APP_NAME` | Server-side app label | `Frontend BFF` |
| `NEXT_PUBLIC_APP_NAME` | Frontend app label | `Frontend BFF` |
| `NEXT_PUBLIC_STAGE` | Frontend environment marker | `demo` |
| `BACKEND_BASE_URL` | Base URL used by `/api/bff/*` proxy routes | `http://backend.demo.svc.cluster.local:8080` |

If `BACKEND_BASE_URL` is unset, `/api/bff/*` returns `503`, which makes it obvious that the backend wiring is not ready yet.

## Build the container image

Images are tagged explicitly. The registry is not hardcoded.

### Example environment

```bash
export IMAGE_REGISTRY=iad.ocir.io/mytenancy
export IMAGE_REPOSITORY=frontend-bff
export IMAGE_TAG=2026-04-19.1
```

### Build

```bash
./deploy/scripts/build-image.sh "$IMAGE_TAG"
```

Or with `make`:

```bash
make docker-build IMAGE_REGISTRY="$IMAGE_REGISTRY" IMAGE_REPOSITORY="$IMAGE_REPOSITORY" IMAGE_TAG="$IMAGE_TAG"
```

## Push the container image

```bash
./deploy/scripts/push-image.sh "$IMAGE_TAG"
```

Or with `make`:

```bash
make docker-push IMAGE_REGISTRY="$IMAGE_REGISTRY" IMAGE_REPOSITORY="$IMAGE_REPOSITORY" IMAGE_TAG="$IMAGE_TAG"
```

## Deploy to k3s with Helm

The release defaults to:

- Release name: `frontend-bff`
- Namespace: `demo`
- Ingress class: `traefik`
- Path: `/`

The deploy script ensures the namespace exists, then runs `helm upgrade --install`.

### Example deploy

```bash
export RELEASE_NAME=frontend-bff
export NAMESPACE=demo
export VALUES_FILE=deploy/helm/frontend-bff/values-demo.yaml

./deploy/scripts/deploy.sh "$IMAGE_TAG"
```

Or with `make`:

```bash
make deploy \
  IMAGE_REGISTRY="$IMAGE_REGISTRY" \
  IMAGE_REPOSITORY="$IMAGE_REPOSITORY" \
  IMAGE_TAG="$IMAGE_TAG" \
  RELEASE_NAME="$RELEASE_NAME" \
  NAMESPACE="$NAMESPACE" \
  VALUES_FILE="$VALUES_FILE"
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

Or with `make`:

```bash
make rollback RELEASE_NAME="$RELEASE_NAME" NAMESPACE="$NAMESPACE" REVISION=2
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

## Single-command full deploy

The recommended deploy command is:

```bash
make full-deploy IMAGE_REGISTRY=iad.ocir.io/mytenancy
```

You can also run the script directly:

```bash
IMAGE_REGISTRY=iad.ocir.io/mytenancy ./deploy/scripts/full-deploy.sh
```

What it does:

- Verifies the repo already has a commit
- Refuses to continue if operational files have uncommitted changes
- Uses the current `HEAD` commit hash as the Docker image tag
- Runs `npm run build`
- Runs `helm lint`
- Builds the image
- Pushes the image
- Deploys or upgrades the Helm release in namespace `demo`

The operational cleanliness check covers the app/container/deploy inputs:

- `src/`
- `public/`
- `deploy/`
- `Dockerfile`
- `package.json`
- `package-lock.json`
- `next.config.ts`
- `next-env.d.ts`
- `tsconfig.json`
- `.dockerignore`
- `.env.example`
- `.eslintrc.json`

That means doc-only edits such as `README.md` do not block deployment, but anything that can change the running artifact or Kubernetes release does.

## Registry-free ship deploy to the VM

For a single-node `k3s` VM, the recommended flow is:

```bash
make ship-deploy DEPLOY_TARGET=opc@<VM_PUBLIC_IP>
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

Required variables:

- `DEPLOY_TARGET`
  Example: `opc@203.0.113.10`

Optional variables:

- `DEPLOY_PATH`
  Remote working directory, default: `/srv/frontend-bff`
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

Example:

```bash
make ship-deploy \
  DEPLOY_TARGET=opc@203.0.113.10 \
  DEPLOY_PATH=/srv/frontend-bff \
  SSH_OPTS="-i ~/.ssh/oracle_vm"
```

VM prerequisites for this flow:

- `k3s` already installed and working
- `helm` available on the VM
- `kubectl` available on the VM
- `sudo k3s ctr images import` works for your user
- the remote directory exists or can be created, for example `/srv/frontend-bff`
- the k3s kubeconfig is available at `/etc/rancher/k3s/k3s.yaml` or you override `KUBECONFIG_PATH`

The remote script used by this flow is [deploy/scripts/remote-deploy.sh](/Users/plebedev/github/demo-web-app/deploy/scripts/remote-deploy.sh).

## Notes for future backend and webhook routes

This repo is designed to stay focused on the frontend/BFF layer. When the backend arrives in its own repo:

- Keep backend business endpoints behind an internal Kubernetes `Service`
- Point `BACKEND_BASE_URL` at that internal service DNS name
- Add frontend-safe BFF routes under `src/app/api/bff/`
- If you later need public webhook endpoints with different security or scaling requirements, expose them from the backend repo instead of routing them through this frontend service

## Helpful commands

```bash
make install
make dev
make build
make ship-deploy DEPLOY_TARGET=opc@203.0.113.10
make docker-build IMAGE_TAG=2026-04-19.1 IMAGE_REGISTRY=iad.ocir.io/mytenancy
make docker-push IMAGE_TAG=2026-04-19.1 IMAGE_REGISTRY=iad.ocir.io/mytenancy
make deploy IMAGE_TAG=2026-04-19.1 IMAGE_REGISTRY=iad.ocir.io/mytenancy
make full-deploy IMAGE_REGISTRY=iad.ocir.io/mytenancy
```
