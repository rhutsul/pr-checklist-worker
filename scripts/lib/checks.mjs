// Правила чекліста процесу як код. Node 24, без залежностей.
// Головне правило працівника: ПЕРЕВІРЯЄ КОД, модель лише запускає скрипт, пояснює й пише звіт.
//
// Вхід — тека синтетичного PR: data/<pr>/
//   pr.md      опис PR за шаблоном (тип, «Вимоги», «AC, які покриває PR», чекліст)
//   files.txt  змінені файли: «A|M|D <шлях у репо>», по одному в рядку
//   tree/      стан потрібних файлів репо ПІСЛЯ PR (тести, UAT, матриця, вимоги)
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export class InputError extends Error {}

export const VERDICT_OK = "можна зливати";
export const VERDICT_FIX = "треба виправити";

// Межі змін за типом PR (з AGENTS.md і шаблону PR процесу курсу).
export const PR_TYPES = {
  "Оновлення вимог": {
    allow: [/^requirements\//, /^docs\/conformance\.md$/],
    note: "лише requirements/ і рядок «Вимоги: …» шапки docs/conformance.md",
  },
  "Специфікація": {
    allow: [/^openspec\//, /^docs\/conformance\.md$/, /^docs\/spec-reading\.md$/],
    // Виняток процесу: окремий коміт, що прибирає з назв тестів ID AC, прибраних зі специфікації.
    warn: [/^tests\//, /^src\/.*\.test\.tsx?$/],
    note: "лише openspec/**, рядки docs/conformance.md, docs/spec-reading.md",
  },
  "Реалізація": {
    allow: [
      /^src\//,
      /^supabase\//,
      /^tests\//,
      /^docs\/conformance\.md$/,
      /^docs\/decisions\//,
      /^docs\/bootstrap\.md$/,
      /^docs\/img\//,
      /^docs\/qa\//,
      /^openspec\/changes\/impl-[^/]+\//,
      /^openspec\/changes\/archive\/[^/]*impl-[^/]+\//,
    ],
    note: "src/, supabase/, tests/, рядки docs/conformance.md, docs/decisions/, docs/img/, docs/qa/, impl-<зріз>; без requirements/ і openspec/specs/",
  },
  "Оновлення шаблону": {
    allow: [/^(?!requirements\/|openspec\/specs\/)/],
    note: "cherry-pick шаблону; без requirements/ і openspec/specs/",
  },
};

const AC_RE = /AC-[A-Z]+-\d{2,}/g;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const SECRET_RES = [
  { name: "ключ OpenAI/OpenRouter/Anthropic (sk-…)", re: /\bsk-[A-Za-z0-9_-]{20,}/ },
  { name: "токен GitHub", re: /\bgh[pousr]_[A-Za-z0-9]{30,}/ },
  { name: "JWT", re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./ },
  { name: "секретний ключ Supabase", re: /\bsb_secret_[A-Za-z0-9_-]{8,}/ },
  { name: "приватний ключ", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  {
    name: "присвоєння секрету",
    re: /\b[A-Z0-9_]*(?:API_KEY|SECRET|TOKEN|PASSWORD)[A-Z0-9_]*\s*[:=]\s*["']?[A-Za-z0-9_\-./+]{16,}/,
  },
];

const rel = (file) => path.relative(ROOT, file).split(path.sep).join("/");
const lines = (file) => readFileSync(file, "utf8").replace(/^﻿/, "").split(/\r?\n/);
const mask = (s) => (s.length <= 8 ? "****" : `${s.slice(0, 4)}…${s.slice(-2)} (${s.length} знаків)`);

function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out.sort();
}

/** Тека PR має бути всередині data/ цього проєкту. */
export function resolvePrDir(dirArg) {
  if (!dirArg) throw new InputError("не вказано теку PR (напр. data/pr-101)");
  const dir = path.resolve(ROOT, dirArg);
  if (!dir.startsWith(path.join(ROOT, "data") + path.sep)) {
    throw new InputError(`тека має бути всередині data/: ${dirArg}`);
  }
  for (const f of ["pr.md", "files.txt"]) {
    if (!existsSync(path.join(dir, f))) throw new InputError(`немає файлу ${rel(path.join(dir, f))}`);
  }
  return dir;
}

/** Розділ markdown від «## <назва>» до наступного «## ». Повертає [{n, text}] з номерами рядків файлу. */
function section(all, title) {
  const out = [];
  let inside = false;
  all.forEach((text, i) => {
    if (/^## /.test(text)) inside = text.slice(3).trim().startsWith(title);
    else if (inside) out.push({ n: i + 1, text });
  });
  return out;
}

function parsePr(dir) {
  const file = path.join(dir, "pr.md");
  const all = lines(file);
  const typeLines = section(all, "Тип PR").filter((l) => /^- \[[xX ]\]/.test(l.text));
  const checked = typeLines.filter((l) => /^- \[[xX]\]/.test(l.text));
  const types = checked.map((l) => ({
    n: l.n,
    name: Object.keys(PR_TYPES).find((t) => l.text.includes(`**${t}**`)) ?? null,
  }));
  const acs = [];
  for (const l of section(all, "AC, які покриває PR")) {
    if (/^\s*<!--/.test(l.text) || /^\s*\|\s*-+/.test(l.text)) continue;
    const ids = l.text.match(AC_RE);
    if (!ids) continue;
    const status = /відкладено/i.test(l.text) ? "відкладено" : /реалізовано/i.test(l.text) ? "реалізовано" : null;
    for (const id of new Set(ids)) acs.push({ id, status, file: rel(file), line: l.n });
  }
  return { file: rel(file), types, acs };
}

function parseFiles(dir) {
  const file = path.join(dir, "files.txt");
  return lines(file)
    .map((text, i) => ({ text: text.trim(), n: i + 1 }))
    .filter((l) => l.text && !l.text.startsWith("#"))
    .map((l) => {
      const m = l.text.match(/^([AMDR])\s+(\S.*)$/);
      if (!m) throw new InputError(`files.txt:${l.n}: очікується «A|M|D <шлях>», а не «${l.text}»`);
      return { status: m[1], path: m[2].trim(), file: rel(file), line: l.n };
    });
}

const isVitest = (p) => /^(src|tests)\/.*\.test\.tsx?$/.test(p);
const isUat = (p) => /^tests\/e2e\/.*\.spec\.ts$/.test(p);

/** Назви тестів з tree/: лише рядкові літерали ("…" чи '…'), без .skip; шаблонний рядок `${id}` не рахується. */
function collectTests(dir) {
  const tree = path.join(dir, "tree");
  const tests = [];
  for (const abs of walk(tree)) {
    const repoPath = path.relative(tree, abs).split(path.sep).join("/");
    if (!isVitest(repoPath) && !isUat(repoPath)) continue;
    lines(abs).forEach((text, i) => {
      const m = text.match(/\b(it|test)(\.(only|skip|todo))?\s*\(\s*(["'])(.*?)\4/);
      if (!m) return;
      tests.push({
        title: m[5],
        skipped: m[3] === "skip" || m[3] === "todo",
        file: rel(abs),
        repoPath,
        line: i + 1,
        uat: isUat(repoPath),
      });
    });
  }
  return tests;
}

/** Текст «Then» кожного AC з вимог PM у tree/requirements/*.md: «- AC-X-NN: Given … When … Then <текст>». */
function collectAcThen(dir) {
  const reqDir = path.join(dir, "tree", "requirements");
  const map = new Map();
  for (const abs of walk(reqDir).filter((f) => f.endsWith(".md"))) {
    lines(abs).forEach((text, i) => {
      // Крапка в кінці речення AC — не частина тексту «Тоді».
      const m = text.match(/^\s*-\s*(AC-[A-Z]+-\d{2,}):\s.*?\bThen\s+(.+?)\.?\s*$/);
      if (m) map.set(m[1], { then: m[2], file: rel(abs), line: i + 1 });
    });
  }
  return map;
}

/** Кроки «Тоді» в UAT: test.step("Тоді: …") або коментар «// Тоді: …», прив'язані до найближчого тесту вище. */
function collectThenSteps(dir) {
  const tree = path.join(dir, "tree");
  const steps = [];
  for (const abs of walk(tree)) {
    const repoPath = path.relative(tree, abs).split(path.sep).join("/");
    if (!isUat(repoPath)) continue;
    let currentAcs = [];
    lines(abs).forEach((text, i) => {
      const t = text.match(/\btest(\.(only|skip))?\s*\(\s*(["'])(.*?)\3/);
      if (t) currentAcs = t[4].match(/^(AC-[A-Z]+-\d{2,})/) ? [t[4].match(/^(AC-[A-Z]+-\d{2,})/)[1]] : [];
      const s =
        text.match(/test\.step\(\s*(["'`])Тоді:\s*(.*?)\1/) ?? text.match(/\/\/\s*Тоді:\s*(["«]?)(.*?)["»]?\s*$/);
      if (s) steps.push({ text: s[2], acs: currentAcs, file: rel(abs), line: i + 1 });
    });
  }
  return steps;
}

function conformanceRows(dir) {
  const abs = path.join(dir, "tree", "docs", "conformance.md");
  const rows = new Map();
  if (!existsSync(abs)) return { file: null, rows };
  lines(abs).forEach((text, i) => {
    const m = text.match(/^\|\s*(AC-[A-Z]+-\d{2,})\s*\|/);
    if (m) rows.set(m[1], { text, file: rel(abs), line: i + 1 });
  });
  return { file: rel(abs), rows };
}

/** Усі перевірки. Повертає { pr, type, findings, checked, notChecked }. Кидає InputError, якщо вхід не читається. */
export function runChecks(dirArg) {
  const dir = resolvePrDir(dirArg);
  const pr = parsePr(dir);
  const files = parseFiles(dir);
  const findings = [];
  const checked = [];
  const notChecked = [];
  const add = (f) => findings.push({ severity: "блокує", ...f });

  // 1. Тип PR: рівно один.
  checked.push("тип PR: рівно одна позначка в «Тип PR»");
  let type = null;
  if (pr.types.length !== 1 || !pr.types[0].name) {
    add({
      rule: "PR_TYPE",
      file: pr.file,
      line: pr.types[0]?.n ?? 1,
      message: `позначено типів PR: ${pr.types.length}; має бути рівно один`,
      evidence: pr.types.map((t) => t.name ?? "?").join(", ") || "жодного",
    });
  } else type = pr.types[0].name;

  // 2. Межі змін за типом.
  if (type) {
    checked.push(`межі змін для «${type}»: ${PR_TYPES[type].note}`);
    for (const f of files) {
      const rule = PR_TYPES[type];
      if (rule.allow.some((re) => re.test(f.path))) continue;
      if (rule.warn?.some((re) => re.test(f.path))) {
        add({
          rule: "SCOPE",
          severity: "попередження",
          file: f.file,
          line: f.line,
          message: `«${type}» змінює ${f.path}: дозволено лише окремим комітом, що прибирає ID прибраних AC з назв тестів`,
          evidence: `${f.status} ${f.path}`,
        });
        continue;
      }
      add({
        rule: "SCOPE",
        file: f.file,
        line: f.line,
        message: `PR типу «${type}» не може змінювати ${f.path} (${rule.note})`,
        evidence: `${f.status} ${f.path}`,
      });
    }
  } else notChecked.push("межі змін — тип PR не визначено");

  // 3–4. AC з PR: тест з AC ID і рядок матриці.
  const tests = collectTests(dir);
  const conf = conformanceRows(dir);
  const implemented = pr.acs.filter((a) => a.status === "реалізовано");
  if (type === "Реалізація") {
    checked.push("кожен AC «реалізовано» у PR має тест з AC ID на початку назви (без .skip)");
    checked.push("кожен AC з PR має рядок у docs/conformance.md");
    if (pr.acs.length === 0) {
      add({ rule: "AC_LIST", file: pr.file, line: 1, message: "у розділі «AC, які покриває PR» немає жодного AC ID", evidence: "—" });
    }
    for (const ac of pr.acs) {
      if (!ac.status) {
        add({ rule: "AC_STATUS", file: ac.file, line: ac.line, message: `${ac.id}: не вказано «реалізовано» чи «відкладено (причина)»`, evidence: ac.id });
      }
    }
    for (const ac of implemented) {
      const own = tests.filter((t) => t.title.startsWith(`${ac.id}:`) || t.title.startsWith(`${ac.id} `));
      const live = own.filter((t) => !t.skipped);
      if (live.length === 0) {
        add({
          rule: "AC_TEST",
          file: ac.file,
          line: ac.line,
          message: own.length
            ? `${ac.id} «реалізовано», але його тест лише з .skip/.todo (${own[0].file}:${own[0].line})`
            : `${ac.id} «реалізовано», але немає тесту, назва якого починається з «${ac.id}:»`,
          evidence: `тестів з цим ID: ${own.length}`,
        });
      }
    }
    if (!conf.file && pr.acs.length) {
      add({ rule: "AC_MATRIX", file: pr.file, line: pr.acs[0].line, message: "у PR є AC, а docs/conformance.md у tree/ немає", evidence: "—" });
    } else {
      for (const ac of pr.acs) {
        const row = conf.rows.get(ac.id);
        if (!row) {
          add({ rule: "AC_MATRIX", file: ac.file, line: ac.line, message: `${ac.id}: немає рядка в docs/conformance.md`, evidence: conf.file });
        } else if (ac.status === "реалізовано" && !/реалізовано/.test(row.text)) {
          add({ rule: "AC_MATRIX", file: row.file, line: row.line, message: `${ac.id}: у PR «реалізовано», а в матриці інший статус`, evidence: row.text.trim() });
        }
      }
    }
  } else if (type) {
    notChecked.push(`тести й матриця за AC — лише для «Реалізації» (цей PR — «${type}»)`);
  }

  // 5. «Тоді» в UAT дослівно з AC.
  const acThen = collectAcThen(dir);
  const steps = collectThenSteps(dir);
  checked.push("кожен крок «Тоді» в UAT (tests/e2e/**/*.spec.ts) дослівно збігається з «Then» AC у requirements/");
  for (const s of steps) {
    if (s.acs.length === 0) {
      add({ rule: "THEN_VERBATIM", severity: "попередження", file: s.file, line: s.line, message: "крок «Тоді» в тесті без AC ID у назві — не з чим звірити", evidence: s.text });
      continue;
    }
    for (const id of s.acs) {
      const src = acThen.get(id);
      if (!src) {
        notChecked.push(`«Тоді» для ${id}: тексту AC немає в tree/requirements/`);
        continue;
      }
      if (s.text !== src.then) {
        add({
          rule: "THEN_VERBATIM",
          file: s.file,
          line: s.line,
          message: `«Тоді» для ${id} не дослівно з AC (${src.file}:${src.line})`,
          evidence: `у тесті: «${s.text}» · в AC: «${src.then}»`,
        });
      }
    }
  }

  // 6. Секрети й не-синтетичні email у всьому вході.
  checked.push("немає ключів і токенів; email лише *@example.test");
  for (const abs of [path.join(dir, "pr.md"), path.join(dir, "files.txt"), ...walk(path.join(dir, "tree"))]) {
    lines(abs).forEach((text, i) => {
      for (const { name, re } of SECRET_RES) {
        const m = text.match(re);
        if (m) {
          add({ rule: "SECRET", file: rel(abs), line: i + 1, message: `схоже на секрет: ${name}`, evidence: mask(m[0]) });
          break;
        }
      }
      for (const email of text.match(EMAIL_RE) ?? []) {
        if (!/@example\.test$/i.test(email)) {
          add({ rule: "EMAIL", file: rel(abs), line: i + 1, message: `email не синтетичний (дозволено лише *@example.test)`, evidence: email });
        }
      }
    });
  }

  findings.forEach((f, i) => (f.id = `F${i + 1}`));
  const blocking = findings.filter((f) => f.severity === "блокує").length;
  return {
    pr: path.basename(dir),
    dir: rel(dir),
    type,
    acs: pr.acs.map(({ id, status }) => ({ id, status })),
    verdict: blocking ? VERDICT_FIX : VERDICT_OK,
    findings,
    checked,
    notChecked: [...new Set(notChecked)],
  };
}

/** Чи існує рядок line у файлі file (шлях від кореня проєкту, лише всередині data/). */
export function lineExists(file, line) {
  const abs = path.resolve(ROOT, file);
  if (!abs.startsWith(path.join(ROOT, "data") + path.sep) || !existsSync(abs)) return false;
  return Number.isInteger(line) && line >= 1 && line <= lines(abs).length;
}
