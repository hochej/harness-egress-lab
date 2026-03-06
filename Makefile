ZENSICAL_VERSION ?= 0.0.21

.PHONY: help docs serve-docs

help:
	@echo "Available commands:"
	@echo "  make docs        - Build documentation site (Zensical)"
	@echo "  make serve-docs  - Serve documentation locally (Zensical)"

docs:
	@uvx --from "zensical==$(ZENSICAL_VERSION)" zensical build
	@touch site/.nojekyll

serve-docs:
	@uvx --from "zensical==$(ZENSICAL_VERSION)" zensical serve
