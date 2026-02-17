#!/bin/bash

# Vue I18n Migration Script Wrapper
# Automates the migration of hardcoded Chinese text to vue-i18n

set -e  # Exit on error

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Main execution
main() {
    print_header "Vue I18n Migration Tool"

    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js first."
        exit 1
    fi

    # Check if we're in the right directory
    if [ ! -f "${PROJECT_ROOT}/web/admin-spa/package.json" ]; then
        print_error "Could not find admin-spa package.json. Are you in the right project?"
        exit 1
    fi

    # Parse command line arguments
    DRY_RUN=""
    QUIET=""

    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run|-n)
                DRY_RUN="--dry-run"
                shift
                ;;
            --quiet|-q)
                QUIET="--quiet"
                shift
                ;;
            --help|-h)
                echo "Usage: $0 [options]"
                echo ""
                echo "Options:"
                echo "  --dry-run, -n    Show what would be changed without modifying files"
                echo "  --quiet, -q      Suppress detailed output"
                echo "  --help, -h       Show this help message"
                echo ""
                echo "Examples:"
                echo "  $0              # Run migration (modifies files)"
                echo "  $0 --dry-run    # Preview changes without modifying"
                echo "  $0 -n -q        # Quiet dry-run"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                echo "Use --help to see available options"
                exit 1
                ;;
        esac
    done

    # Navigate to scripts directory
    cd "${SCRIPT_DIR}"

    print_success "Node.js version: $(node --version)"
    echo ""

    # Run the migration script
    print_header "Starting Migration"

    if [ -n "$DRY_RUN" ]; then
        print_warning "DRY RUN MODE - No files will be modified"
    fi

    echo ""

    # Execute the Node.js script
    node migrate-vue-i18n.js $DRY_RUN $QUIET

    # Check exit code
    EXIT_CODE=$?

    echo ""

    if [ $EXIT_CODE -eq 0 ]; then
        print_header "Migration Complete"

        if [ -z "$DRY_RUN" ]; then
            echo ""
            echo "Next steps:"
            echo "  1. Review the changes in your editor"
            echo "  2. Check translations in web/admin-spa/src/locales/es-MX/"
            echo "  3. Test the application: cd web/admin-spa && npm run dev"
            echo "  4. Run prettier: npm run format"
            echo "  5. Commit the changes"
            echo ""
            echo "Backups are saved in: .backup-vue-i18n/"
        else
            echo ""
            print_warning "This was a dry run. No files were modified."
            echo "Run without --dry-run to apply changes:"
            echo "  $0"
        fi

        print_success "Done!"
    else
        print_error "Migration failed with exit code $EXIT_CODE"
        exit $EXIT_CODE
    fi
}

# Run main function
main "$@"
