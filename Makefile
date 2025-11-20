# =============================================================================
# Backend University - Makefile
# =============================================================================

.PHONY: sync-workflows help

# Default target
help:
	@echo "Available commands:"
	@echo "  make sync-workflows  - Sync GitHub workflows from services to root"
	@echo ""

# Sync all service workflows to root .github/workflows/
sync-workflows:
	@./scripts/sync-workflows.sh
