#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/recruitment}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
OUT_DIR="${BACKUP_DIR}/${TIMESTAMP}"

mkdir -p "${OUT_DIR}"

if [[ -z "${MONGODB_URI:-}" ]]; then
  echo "MONGODB_URI is required."
  exit 1
fi

mongodump --uri="${MONGODB_URI}" --out="${OUT_DIR}"

echo "Backup stored at ${OUT_DIR}"
