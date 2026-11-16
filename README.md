# pr-checklist-worker

Віртуальний працівник «рецензент PR за чеклістом процесу» на Claude Code (бонус WS10 курсу «Modern Development with
Agentic AI», шлях 1). Перевіряє синтетичний PR — тип і межі змін, тести з AC ID і рядки матриці, дослівне «Тоді» в UAT,
ключі й не-синтетичні email — і пише вердикт «можна зливати» / «треба виправити» зі знахідками (файл і рядок).
Зливає, коментує й відповідає автору PR лише людина.

**Звіт за шаблоном курсу — [`docs/worker/README.md`](docs/worker/README.md)** (картка ролі, межі, перевіряльник,
golden data, журнал запуску, вартість і ліміти, що зламалось).

Дані лише синтетичні: вигаданий продукт, AC ID `AC-DEMO-NN`, email `*@example.test`. Ключів і `.env` у репо немає.

## Файли

```
AGENTS.md, CLAUDE.md                 роль, вердикт, межі (CLAUDE.md = @AGENTS.md)
.claude/skills/pr-review/SKILL.md    оркестратор: A — правила кодом, B — перевіряльник, C — звіт і його перевірка
.claude/agents/pr-review-verifier.md перевіряльник: лише читання, звіряє кожну знахідку з файлом і рядком
.claude/settings.json                вузький allow / deny
scripts/check-pr.mjs                 правила чекліста: таблиця + ###JSON###, код виходу 0 / 1 / 2
scripts/validate-report.mjs          перевірка звіту кодом (схема, докази, узгодженість зі скриптом)
scripts/golden.mjs                   звірка з відомими вердиктами (запускає людина)
scripts/lib/checks.mjs               правила як код
references/rules.md                  правила й «відомі граблі»
data/pr-101 … pr-104                 синтетичні PR (golden data)
golden/expected.json                 відомі вердикти — працівник їх не читає
tests/check-pr.test.mjs              офлайн-тести правил (без моделі)
run.sh, run.ps1                      запуск без людини: claude -p … --permission-mode dontAsk
docs/worker/                         звіт і журнали запусків
```

## Як запустити

Потрібні Node 24 і Claude Code з входом у власну підписку (`claude`, потім `/login`).

```bash
npm test                               # правила на golden data, без моделі
node scripts/check-pr.mjs data/pr-103  # один PR без моделі: код 1, дві знахідки
./run.sh                               # працівник без людини на всіх data/pr-*
npm run golden                         # звірка out/*.json з golden/expected.json
```

Windows: `powershell -NoProfile -ExecutionPolicy Bypass -File .\run.ps1` (або `-Pr pr-103,pr-104`). Розклад —
Планувальник завдань, наприклад щогодини:

```powershell
schtasks /Create /TN "PR checklist worker" /SC HOURLY /TR "powershell -NoProfile -ExecutionPolicy Bypass -File \"<шлях>\pr-checklist-worker\run.ps1\""
```

Запускайте лише в цій теці: `.claude/settings.json` діє тільки з теки, де запущено Claude Code. У теці без прийнятого
діалогу довіри Claude Code ігнорує `allow` з `settings.json`, тому ті самі дозволи передаються ще й через
`--allowedTools` у `run.*` (`deny` діє завжди).

Підписка — лише для особистого використання; рецензент для інших людей потребує API-ключа.
