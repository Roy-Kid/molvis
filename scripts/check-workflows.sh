#!/usr/bin/env bash
# The same check as `lint / workflows`: check-workflows at the ref that
# workflow `uses:` names. actionlint does not know the MolCrafts scheme.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
unset $(git rev-parse --local-env-vars)
ref=master
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
git init -q "$work"
git -C "$work" fetch -q --depth 1 https://github.com/MolCrafts/molcrafts-ci.git "$ref"
git -C "$work" checkout -q --detach FETCH_HEAD
env -u VIRTUAL_ENV uv run --no-project --script "$work/actions/check-workflows/check_workflows.py" "$PWD"
