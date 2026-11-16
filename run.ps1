# Запуск рецензента PR без людини (Планувальник завдань Windows): claude -p (headless) на ОСОБИСТІЙ підписці.
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\run.ps1                 # усі теки data\pr-*
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\run.ps1 -Pr pr-103,pr-104
# Без --bare: --bare пропускає CLAUDE.md, скіли, .claude/agents і не бере вхід підпискою — працівника не було б.
param(
  [string[]]$Pr = @(),
  [string]$ClaudeBin = "claude"
)
$ErrorActionPreference = "Continue"
Set-Location -Path $PSScriptRoot
New-Item -ItemType Directory -Force -Path "out\runs" | Out-Null
if ($Pr.Count -eq 0) { $Pr = Get-ChildItem -Directory -Path "data" -Filter "pr-*" | ForEach-Object { $_.Name } }

# --permission-mode dontAsk: усе, що не дозволено явно, — відмова (без людини нема кому натиснути «так»).
# --allowedTools: те саме, що allow у .claude/settings.json; deny звідти діє й тут.
$allowed = "Skill(pr-review),Agent(pr-review-verifier),Bash(node scripts/check-pr.mjs *),Bash(node scripts/validate-report.mjs *),PowerShell(node scripts/check-pr.mjs *),PowerShell(node scripts/validate-report.mjs *),Read(/data/**),Read(/references/**),Read(/scripts/**),Read(/out/**),Grep,Glob,Edit(/out/**)"
$worst = 0
foreach ($p in $Pr) {
  $stamp = Get-Date -Format "yyyy-MM-ddTHH-mm-ss"
  $log = "out\runs\$stamp-$p.json"
  & $ClaudeBin -p "/pr-review data/$p" --permission-mode dontAsk --allowedTools $allowed --max-turns 40 --output-format json |
    Out-File -FilePath $log -Encoding utf8
  $code = $LASTEXITCODE
  & node scripts/validate-report.mjs "data/$p"
  $v = $LASTEXITCODE
  Write-Output "${p}: claude код $code, validate-report код $v; журнал $log, звіт out\$p.md"
  if ($code -ne 0 -or $v -ne 0) { $worst = 1 }
}
exit $worst
