#!/bin/bash
# Pre-commit hook to prevent committing secrets
# Install by copying to .git/hooks/pre-commit and making executable

set -e

echo "Running security pre-commit checks..."

# Check for common secret patterns in staged files
PATTERNS=(
  "password\s*=\s*['\"][^'\"]*['\"]"
  "api[_-]key\s*=\s*['\"][^'\"]*['\"]"
  "secret\s*=\s*['\"][^'\"]*['\"]"
  "token\s*=\s*['\"][^'\"]*['\"]"
  "POSTGRES_PASSWORD\s*=\s*['\"]"
  "JWT_SECRET\s*=\s*['\"][^'\"]*['\"]"
)

FOUND_SECRETS=0

for pattern in "${PATTERNS[@]}"; do
  if git diff --cached --name-only | xargs -I {} grep -nE "$pattern" {} 2>/dev/null; then
    echo "ERROR: Potential secret found matching pattern: $pattern"
    FOUND_SECRETS=1
  fi
done

# Check if .env file is being committed
if git diff --cached --name-only | grep -q "^\.env$"; then
  echo "ERROR: Attempting to commit .env file. This should never be committed!"
  FOUND_SECRETS=1
fi

if [ $FOUND_SECRETS -eq 1 ]; then
  echo ""
  echo "Pre-commit check FAILED: Secrets detected in staged files"
  echo "Please remove secrets and use environment variables instead"
  exit 1
fi

echo "Pre-commit security checks passed ✓"
exit 0
