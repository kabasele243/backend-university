#!/bin/bash

# =============================================================================
# Sync GitHub Workflows
#
# Copies workflows from individual services to root .github/workflows/
# Run this after adding/modifying workflows in any service.
# =============================================================================

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKFLOWS_DIR="$ROOT_DIR/.github/workflows"

# Create root workflows directory
mkdir -p "$WORKFLOWS_DIR"

# Clean existing synced workflows to remove stale files
rm -f "$WORKFLOWS_DIR"/*.yml

echo "Syncing workflows to $WORKFLOWS_DIR"

# Find all workflow files in service directories (excluding node_modules)
find "$ROOT_DIR" -path "*/.github/workflows/*.yml" -not -path "$ROOT_DIR/.github/*" -not -path "*/node_modules/*" | while read -r workflow; do
    # Get the service directory name (e.g., 01-distributed-rate-limiter)
    service_dir=$(echo "$workflow" | sed "s|$ROOT_DIR/||" | cut -d'/' -f1)

    # Get the filename
    filename=$(basename "$workflow")

    # Extract service short name (e.g., "rate-limiter" from "01-distributed-rate-limiter")
    # Takes the last hyphen-separated component(s) that form a meaningful name
    service_short_name=$(echo "$service_dir" | sed 's/^[0-9]*-//' | sed 's/^distributed-//')

    # Skip if workflow already has service prefix
    if [[ "$filename" == *"$service_short_name"* ]]; then
        # Already prefixed, use as-is
        target_filename="$filename"
    else
        # Add service short name prefix to avoid collisions
        target_filename="${service_short_name}-${filename}"
    fi

    # Copy to root workflows directory
    cp "$workflow" "$WORKFLOWS_DIR/$target_filename"

    echo "  ✓ Synced: $target_filename (from $service_dir)"
done

echo ""
echo "Done! All workflows synced to .github/workflows/"
echo ""
echo "Remember to commit the changes in .github/workflows/"
