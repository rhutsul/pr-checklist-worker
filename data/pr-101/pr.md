<!-- Синтетичний PR для golden data працівника: вигаданий продукт, вигадані AC ID. -->
# Реалізація: бронювання переговорної на години (AC-DEMO-01, AC-DEMO-02)

## Тип PR

- [ ] **Оновлення вимог** — гілка `sync/<дата>`: лише `requirements/` і рядок «Вимоги: …» у шапці `docs/conformance.md`.
- [ ] **Специфікація** — гілка `spec/<id зміни>`: `openspec/**`, рядки `docs/conformance.md`, `docs/spec-reading.md`.
- [x] **Реалізація** — гілка `task/<коротко>`: `src/`, `supabase/`, `tests/`, рядки `docs/conformance.md`, галочки в `openspec/changes/impl-<зріз>/tasks.md`. Без `requirements/` і `openspec/specs/`.
- [ ] **Оновлення шаблону** — гілка `template/<коротко>`: `git cherry-pick` коміту шаблону курсу.

## Вимоги

Вимоги: синтетичний приклад · знімок 2026-11-16

## AC, які покриває PR

| AC | Статус |
|---|---|
| AC-DEMO-01 | реалізовано |
| AC-DEMO-02 | реалізовано |
| AC-DEMO-03 | відкладено (наступна задача зрізу, `impl-room-booking` 1.3) |

## Що змінилось

- Server Action `bookRoom`: перевірка перетину й запис броні однією дією.
- Тести з AC ID: `tests/bookings.test.ts` і UAT `tests/e2e/bookings.spec.ts` з дослівним «Тоді».
- Рядки AC-DEMO-01 і AC-DEMO-02 у `docs/conformance.md` — «реалізовано».

## Чекліст

- [x] Одна зміна — один намір; гілка від свіжого `main`
- [x] Тести з AC ID на початку назви (`it("AC-…: …")`), без `.skip` для «реалізовано»; `npm test` зелений
- [x] Рядок `docs/conformance.md` для кожного AC оновлено в цьому ж PR
- [x] Жодних секретів і справжніх даних: дані — синтетичні (`*@example.test`)
