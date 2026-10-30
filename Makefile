IMAGE    := monline
VERSION  ?= beta-$(shell git rev-parse --short=12 HEAD)
REPO     ?=

# ── Multi-arch build (OCI tar, sem push) ─────────────────────────────────────
.PHONY: build
build:
	docker buildx build \
		--no-cache \
		--platform linux/amd64,linux/arm64 \
		-t $(IMAGE):$(VERSION) \
		-t $(IMAGE):beta \
		--output type=oci,dest=./$(IMAGE).tar \
		.
	@echo "Imagem salva em ./$(IMAGE).tar"

# ── Multi-arch push (beta + commit) ────────────────────────────────────────
.PHONY: push
push:
	@test -n "$(REPO)" || (echo "Set REPO to your Monline registry path before publishing." >&2; exit 1)
	docker buildx build \
		--no-cache \
		--platform linux/amd64,linux/arm64 \
		-t $(REPO):$(VERSION) \
		-t $(REPO):beta \
		--push \
		.

# ── Builds individuais (carregam no daemon local) ────────────────────────────
.PHONY: build-amd64
build-amd64:
	docker buildx build --no-cache --platform linux/amd64 -t $(IMAGE):$(VERSION) -t $(IMAGE):beta --load .

.PHONY: build-arm64
build-arm64:
	docker buildx build --no-cache --platform linux/arm64 -t $(IMAGE):$(VERSION) -t $(IMAGE):beta --load .

# ── Dev local (sobe com docker compose) ──────────────────────────────────────
.PHONY: up
up:
	docker compose up -d --build

.PHONY: down
down:
	docker compose down

.PHONY: logs
logs:
	docker compose logs -f
