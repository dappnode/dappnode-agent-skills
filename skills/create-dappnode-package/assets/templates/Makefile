SHELL := /bin/sh

DNP_NAME ?= $(shell node -e "process.stdout.write(require('./dappnode_package.json').name)")
VERSION ?= $(shell node -e "process.stdout.write(require('./dappnode_package.json').version)")

# For the single-service template, the compose service key is the full dnpName,
# so DAppNode expects <dnpName>:<version>. For a short service key such as "web",
# run: make dev-tar SERVICE=web CURRENT_IMAGE=<image-built-by-compose>
SERVICE ?= $(DNP_NAME)
CURRENT_IMAGE ?= $(DNP_NAME):$(VERSION)
REQUIRED_IMAGE ?= $(if $(filter $(SERVICE),$(DNP_NAME)),$(DNP_NAME):$(VERSION),$(SERVICE).$(DNP_NAME):$(VERSION))
TARBALL ?= $(DNP_NAME).tar

.PHONY: dev-tar print-dev-vars

dev-tar:
	docker compose build
	docker tag "$(CURRENT_IMAGE)" "$(REQUIRED_IMAGE)"
	docker images --format '{{.Repository}}:{{.Tag}}' | grep -Fx "$(REQUIRED_IMAGE)"
	docker save "$(REQUIRED_IMAGE)" -o "$(TARBALL)"
	shasum -a 256 "$(TARBALL)"

print-dev-vars:
	@printf 'DNP_NAME=%s\n' "$(DNP_NAME)"
	@printf 'VERSION=%s\n' "$(VERSION)"
	@printf 'SERVICE=%s\n' "$(SERVICE)"
	@printf 'CURRENT_IMAGE=%s\n' "$(CURRENT_IMAGE)"
	@printf 'REQUIRED_IMAGE=%s\n' "$(REQUIRED_IMAGE)"
	@printf 'TARBALL=%s\n' "$(TARBALL)"
