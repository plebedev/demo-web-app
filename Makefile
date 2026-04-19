SHELL := /bin/bash

IMAGE_REGISTRY ?=
IMAGE_REPOSITORY ?= frontend-bff
IMAGE_TAG ?= dev
RELEASE_NAME ?= frontend-bff
NAMESPACE ?= demo
VALUES_FILE ?= deply/helm/frontend-bff/values-demo.yaml

.PHONY: install dev lint build docker-build docker-push deploy full-deploy ship-deploy rollback history

install:
	npm install

dev:
	npm run dev

lint:
	npm run lint

build:
	npm run build

docker-build:
	IMAGE_REGISTRY="$(IMAGE_REGISTRY)" IMAGE_REPOSITORY="$(IMAGE_REPOSITORY)" IMAGE_TAG="$(IMAGE_TAG)" ./deply/scripts/build-image.sh

docker-push:
	IMAGE_REGISTRY="$(IMAGE_REGISTRY)" IMAGE_REPOSITORY="$(IMAGE_REPOSITORY)" IMAGE_TAG="$(IMAGE_TAG)" ./deply/scripts/push-image.sh

deploy:
	RELEASE_NAME="$(RELEASE_NAME)" NAMESPACE="$(NAMESPACE)" VALUES_FILE="$(VALUES_FILE)" IMAGE_REGISTRY="$(IMAGE_REGISTRY)" IMAGE_REPOSITORY="$(IMAGE_REPOSITORY)" IMAGE_TAG="$(IMAGE_TAG)" ./deply/scripts/deploy.sh

full-deploy:
	RELEASE_NAME="$(RELEASE_NAME)" NAMESPACE="$(NAMESPACE)" VALUES_FILE="$(VALUES_FILE)" IMAGE_REGISTRY="$(IMAGE_REGISTRY)" IMAGE_REPOSITORY="$(IMAGE_REPOSITORY)" ./deply/scripts/full-deploy.sh

ship-deploy:
	RELEASE_NAME="$(RELEASE_NAME)" NAMESPACE="$(NAMESPACE)" VALUES_FILE="$(VALUES_FILE)" IMAGE_REPOSITORY="$(IMAGE_REPOSITORY)" DEPLOY_TARGET="$(DEPLOY_TARGET)" DEPLOY_PATH="$(DEPLOY_PATH)" SSH_OPTS="$(SSH_OPTS)" ./deply/scripts/ship-deploy.sh

rollback:
	RELEASE_NAME="$(RELEASE_NAME)" NAMESPACE="$(NAMESPACE)" REVISION="$(REVISION)" ./deply/scripts/rollback.sh

history:
	helm history "$(RELEASE_NAME)" --namespace "$(NAMESPACE)"
