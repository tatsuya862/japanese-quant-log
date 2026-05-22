#!/usr/bin/env bash
set -euo pipefail

echo "Checking public repository safety..."

blocked_paths_regex="(assets/audio/|docs/assets/audio/|assets/audio-scripts/|docs/assets/audio-scripts/|\\.chrome-check-final/|\\.env|Cookie|Login Data)"
blocked_secret_regex="(sk_live_|sk_test_|whsec_|ghp_[A-Za-z0-9_]+|AIza[0-9A-Za-z_-]+|xox[baprs]-|-----BEGIN [A-Z ]*PRIVATE KEY-----|C:/Users)"
blocked_internal_regex="(有料音声台本全文|ライブ原稿全文|配信原稿全文|有料記事本文全文|内部メモ[:：]|OBL記録|KPI記録)"

blocked_paths_found=0
while IFS= read -r tracked_path; do
  if [[ "$tracked_path" =~ $blocked_paths_regex ]]; then
    echo "$tracked_path"
    blocked_paths_found=1
  fi
done < <(git ls-files)

if [[ "$blocked_paths_found" -ne 0 ]]; then
  echo "NG: blocked file path detected."
  exit 1
fi

if git grep --untracked -n -E "$blocked_secret_regex" -- . ":(exclude).git" ":(exclude)node_modules" ":(exclude)docs/content-security-policy.md" ":(exclude)docs/pre-publish-checklist.md" ":(exclude)scripts/check-public-repo-safety.sh"; then
  echo "NG: likely secret or local machine path detected."
  exit 1
fi

if git grep --untracked -n -E "$blocked_internal_regex" -- . ":(exclude).git" ":(exclude)node_modules" ":(exclude)docs/content-security-policy.md" ":(exclude)docs/pre-publish-checklist.md" ":(exclude)scripts/check-public-repo-safety.sh"; then
  echo "NG: likely internal or paid-source text detected."
  exit 1
fi

echo "OK: no obvious blocked public-repo content detected."
