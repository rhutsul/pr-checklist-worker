#!/usr/bin/env bash
# Запуск рецензента PR без людини (cron, CI): claude -p (headless) на ОСОБИСТІЙ підписці розробника.
#   ./run.sh                    # усі теки data/pr-*
#   ./run.sh pr-103 pr-104      # вибрані PR
# Без --bare: --bare пропускає CLAUDE.md, скіли, .claude/agents і не бере вхід підпискою — працівника не було б.
# --allowedTools потрібен і тут: у теці без прийнятого діалогу довіри Claude Code ігнорує allow з settings.json (deny діє).
# Grep і Glob тут голі навмисно: правило `Grep(/data/**)` Claude Code приймає, але шлях пошуку з ним не звіряє
# (docs: permissions). Межу «лише data/ і references/» тримає хук PreToolUse scripts/hooks/search-scope.mjs,
# а «команда рівно node scripts/<скрипт>.mjs data/<pr>» — хук scripts/hooks/exact-command.mjs (обидва в
# .claude/settings.json; хуки діють і в недовіреній теці, і для субагента).
set -uo pipefail
cd "$(dirname "$0")"
export MSYS_NO_PATHCONV=1   # Git Bash на Windows не перетворює «/pr-review» на шлях
CLAUDE_BIN="${CLAUDE_BIN:-claude}"
ALLOWED="Skill(pr-review),Agent(pr-review-verifier),Bash(node scripts/check-pr.mjs *),Bash(node scripts/validate-report.mjs *),PowerShell(node scripts/check-pr.mjs *),PowerShell(node scripts/validate-report.mjs *),Read(/data/**),Read(/references/**),Read(/scripts/**),Read(/out/**),Grep,Glob,Edit(/out/**)"
mkdir -p out/runs
if [ "$#" -gt 0 ]; then PRS=("$@"); else PRS=(); for d in data/pr-*/; do PRS+=("$(basename "$d")"); done; fi
worst=0
for pr in "${PRS[@]}"; do
  stamp="$(date +%Y-%m-%dT%H-%M-%S)"
  "$CLAUDE_BIN" -p "/pr-review data/${pr}" \
    --permission-mode dontAsk \
    --allowedTools "$ALLOWED" \
    --max-turns 40 \
    --output-format json < /dev/null > "out/runs/${stamp}-${pr}.json" 2> "out/runs/${stamp}-${pr}.stderr.txt"
  code=$?
  node scripts/validate-report.mjs "data/${pr}"; v=$?
  echo "${pr}: claude код ${code}, validate-report код ${v}; журнал out/runs/${stamp}-${pr}.json, звіт out/${pr}.md"
  [ "$code" -ne 0 ] || [ "$v" -ne 0 ] && worst=1
done
exit "$worst"
