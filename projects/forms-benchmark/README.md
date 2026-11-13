# forms-benchmark

Бенчмарк ReFormer против Formik, React Hook Form и RJSF на реальных числах из браузера.
Две части:

- **`projects/forms-benchmark`** (здесь) — страницы: одна форма на одну библиотеку, каждая
  собирается отдельной prod-сборкой;
- **`projects/forms-benchmark-e2e`** — Playwright: conformance (одинаковое поведение), калибровка
  счётчика рендеров, профилирование и отчёт.

Правила честности и методика — [BENCH-CONTRACT.md](BENCH-CONTRACT.md). План —
[docs/plans/reformer-crispy-gem.md](../../docs/plans/reformer-crispy-gem.md).

## Участники и формы

| id                 | Стек                                           |
| ------------------ | ---------------------------------------------- |
| `reformer-core`    | `@reformer/core` + headless `@reformer/cdk`    |
| `reformer-json`    | `@reformer/renderer-json`                      |
| `formik`           | Formik + Yup                                   |
| `rhf`              | React Hook Form + zod                          |
| `rjsf`             | RJSF + ajv8                                    |
| `baseline`         | та же разметка без библиотеки — нижняя граница |
| `reformer-core-aa` | копия `reformer-core` — контроль шума (A/A)    |

Формы: регистрация с капчей ([спека](../../docs/specs/registration-form.md)) и кредитная заявка
([спека](../../docs/specs/credit-application-form.md), охват — контракт §8).

## Запуск

Пакеты `@reformer/*` потребляются из `dist/` — сначала соберите их (core → cdk → renderer-react →
renderer-json): `npm run build:stackblitz -w @reformer/core` и т.д. Сборка страниц отказывается
работать со старым `dist`.

```bash
npm run bench:build         # сборка всех страниц + отчёты бандла и объёма кода (dist/*.json)
npm run bench:conformance   # паритет поведения всех реализаций
npm run bench:quick         # быстрый прогон: 3 итерации, без прогрева
npm run bench               # полный прогон: 10 итераций + прогрев, рендеры, трассы, отчёт
npm run bench:report        # отчёт по последним прогонам; -- --publish → docs/benchmarks/forms/
```

Параметры прогона — переменные окружения (`projects/forms-benchmark-e2e/lib/config.ts`):
`BENCH_ITERATIONS`, `BENCH_WARMUP`, `BENCH_CPU` (например `1,4`), `BENCH_CADENCE`, `BENCH_REMOUNTS`,
`BENCH_RENDERS`, `BENCH_TRACE`, `BENCH_SEED`, `BENCH_LIBS`.

Разработка страницы: `npm run dev -w forms-benchmark` → `http://localhost:5173/<id>/<form>/`
(dev-режим только для разработки; замеры — по prod-сборкам).

## Где что

```
src/shared/      общий слой: UI-примитивы, FieldFrame, fake API, домен, тексты, харнесс
src/libs/<id>/   реализации; README каждой — паттерны со ссылками на документацию и отклонения
scripts/         build-entries (сборка по входам), serve, bundle-size, code-size
```

Результаты прогонов — `projects/forms-benchmark-e2e/results/<run>/` (в .gitignore): `env.json`,
`phases.ndjson`, `runs.ndjson`, `traces/*.json` (открываются в DevTools → Performance), отчёты в
`results/_reports/<stamp>/`.
