# Бенчмарк ReFormer против Formik / React Hook Form / RJSF

## Context

Нужно сравнить ReFormer с популярными библиотеками форм **на реальных числах из браузера**. Сейчас в
репо нет реализаций форм на Formik/RHF/RJSF и нет инфраструктуры профилирования:
`react-playground-e2e` меряет `Date.now()` на стороне Node и гоняет dev-сервер — без CDP, трасс,
троттлинга CPU и подсчёта React-рендеров. Итог работы: команда `npm run bench` даёт воспроизводимый
отчёт (markdown + HTML + трассы DevTools) с медианами, доверительными интервалами и разбросом по
каждой фазе каждой формы, плюс размер бандла и кода.

## 1. Участники (решено)

| ID | Стек | Валидация |
|---|---|---|
| `reformer-core` | `@reformer/core` + headless `@reformer/cdk` (form-field, form-wizard, field-array) | встроенная |
| `reformer-json` | `@reformer/renderer-json` — пара к RJSF (форма описана JSON) | встроенная |
| `formik` | Formik 2.4.x | Yup |
| `rhf` | React Hook Form 7.x + `@hookform/resolvers` ≥ 5 | zod 4 |
| `rjsf` | RJSF 6.10.1 (`@rjsf/core`, `utils`) | `@rjsf/validator-ajv8` |
| `baseline` | React + харнесс + общий UI, без формы | — (точка отсчёта для байтов и heap) |
| `aa-*` | копия `reformer-core` под другим именем | A/A-контроль шума |

Версии конкурентов закрепляются точно (без `^`) и попадают в отчёт. UI — **общий нейтральный набор**
примитивов на чистом HTML, одинаковые разметка и `data-testid` у всех: в цифрах только библиотека форм.

## 2. Что меряем

Всё собирается **по фазам** сценария. Внутри окна замера — только «сырой» ввод (`page.keyboard`,
`page.mouse` по заранее вычисленным координатам), ожидание — одним in-page промисом, без
actionability-проверок, `expect`-поллинга и `page.evaluate` (они грузят тот же main thread и
масштабируются с DOM).

| Группа | Метрики | Источник |
|---|---|---|
| **Время** | холодная загрузка до готовой формы; тёплый remount; гидратация данными заявки; «клавиша → кадр» и время обработки события; time-to-settle на клавишу; переход шага; добавление строки массива; показ ошибок | `timeOrigin` + inline-mark в `<head>`; готовность определяет харнесс по DOM-контракту (все поля шага 1 + значения), не реализация; rAF + `MessageChannel`; Event Timing (max, p98, число ≥ 16 мс); LoAF |
| **Рендеры** | commits и отрендеренные компоненты на действие; число исполнений примитивов | отдельный проход: хук `__REACT_DEVTOOLS_GLOBAL_HOOK__`, обход дерева как в React DevTools (флаг `PerformedWork`) + счётчики исполнений внутри общих примитивов (ловят «исполнился и выбросил» у uSES/сигналов); классификация по идентичности `fiber.type`, а не по именам |
| **CPU / память** | `ScriptDuration`, `TaskDuration`, `LayoutDuration`, `RecalcStyleDuration`, `ThreadTime`; long tasks, TBT, LoAF; JS heap после GC; DOM-узлы и слушатели; утечка = **наклон** heap и узлов по remount 5/10/15/20 | CDP `Performance.getMetrics`, `HeapProfiler.collectGarbage`, `Memory.getDOMCounters`; троттлинг `Emulation.setCPUThrottlingRate` 4x (по умолчанию) и 1x |
| **Бандл и код** | JS на страницу raw/gzip/brotli; прирост над `baseline`; атрибуция минифицированных байтов по пакетам; реально загруженное за сценарий (Resource Timing, вкл. динамические чанки); пакеты, попавшие в браузер; LOC реализации (JSON / TS / общий код раздельно) | sourcemap-атрибуция (`source-map-explorer --json`), zlib |

Плюс одна **трассируемая** итерация на (библиотека × форма) → `traces/*.json`, открывается в
DevTools → Performance.

Ограничения, которые прямо пишутся в отчёт: троттлинг CPU не замедляет off-thread парсинг/компиляцию и
GC (стоимость больших бандлов занижена); значения «клавиша → кадр» квантованы vsync — поэтому рядом
время обработки события и CPU-дельты.

## 3. Сценарии (1 e2e-тест на форму, внутри — фазы)

**Регистрация:** `load` → `hydrate` (предзаполнение из приглашения) → `submit-invalid` → `typing`
(живая перевалидация) → `async-validation` → `captcha` (обновить, ввести, проверка) →
`submit-valid` → `remount×20`.

**Кредит:** `load` → `hydrate` (сохранённая заявка) → на чистой форме: `step1` (ипотека → условные
поля; сумма/срок → вычисляемый платёж) → `next-invalid` → ввод и `next` по шагам 2–5 → `arrays`
(масштаб N = 1 / 10 / 50 строк: добавление, ввод в последней строке, удаление) → шаг 6 + SMS →
`submit` → `remount×10`.

Перед и после каждой фазы — **проверочные ворота вне окна замера**: ожидаемое число ошибок, счётчики
вызовов fake API, в конце — эталонный payload. Сломанная реализация не может «выглядеть быстрой».

## 4. Правила честности

1. **Контракт поведения** (`projects/forms-benchmark/BENCH-CONTRACT.md`, фиксируется до первого
   полного прогона — пре-регистрация методики):
   - валидация `afterFirstSubmit`: тихо до первой попытки submit / «Далее» (в визарде — на шаге),
     затем живая перевалидация на change. Совпадает со спекой («ошибки показываются после нажатия»),
     нативно у ReFormer и RHF (`mode: 'onSubmit'`); Formik — гейт по `submitCount`, RJSF —
     `liveValidate` после первой отправки;
   - одно сообщение на поле (первое по порядку правил), фокус на ошибку и сводка ошибок выключены,
     неактивные шаги размонтированы, скрытые поля сбрасываются;
   - debounce и кэширование async-проверок — фиксированные значения; счётчики вызовов API — часть
     conformance (например, «john_doe» → ровно 1 проверка username);
   - общий `FieldFrame` (label, контрол, `error-{path}`, aria) и нормализатор payload;
   - матрица охвата спеки кредита (что из 🆕-строк входит, что нет — например, режим `view` и
     форматирование тысяч вне охвата). Спека не меняется.
2. **Prod-сборка**, проверяется на каждом прогоне (`bundleType` из DevTools-хука = 0); отказ от
   запуска при устаревшем `dist` пакетов `@reformer/*`; ассерт, что в бандлах нет `@reformer/ui-kit`,
   Radix, tailwind, `ajv` у renderer-json.
3. **Fake API** с режимом ручного `flush()` и счётчиками вызовов; фиксированные часы и сид капчи
   (возраст и год авто зависят от даты). Async-фазы оцениваются по CPU, а «запрос ушёл» и
   «ответ → UI успокоился» меряются раздельно.
4. **Идиоматично по документации**, одинаковый бюджет оптимизаций: только рекомендованные официальной
   документацией (RHF `register`, `useFieldArray`, `useWatch`; Formik — пример MultistepWizard,
   `FastField`; RJSF — тема, `extraErrors`, схемы вне компонента), только публичные API; React Compiler
   запрещён всем. README реализации ссылается на страницу доков для каждого паттерна.
5. **Независимость реализаций конкурентов:** каждую пишет отдельный субагент, которому даны только
   спека, контракт и документация библиотеки (без доступа к коду ReFormer); затем отдельное
   ревью «идиоматичность и производительность» по чек-листу на каждую библиотеку.
6. **Публикуется всё**, включая метрики, где ReFormer проигрывает. Таблицы — абсолютные значения +
   отношение к лучшему в строке (не к ReFormer).

## 5. Статистика

- Каждый прогон сначала сворачивается (медиана и p95 по клавишам **внутри** прогона), сравниваются
  прогоны — без псевдорепликации.
- Медиана, IQR, CV; отношение медиан с bootstrap-CI; Mann–Whitney U с поправкой Holm.
- A/A-контроль задаёт порог шума; различия ниже порога помечаются как «нет разницы».
- Пилотный прогон → CV → выбор N (по умолчанию 10, p95 не показывается при n < 20);
  1–2 прогрева на библиотеку отбрасываются; `BENCH_QUICK=1` → 3.
- Порядок — round-robin по библиотекам, перемешан сидом; новый browser context на прогон, кэш
  выключен. Калибровочная JS-нагрузка в начале и в конце прогона ловит термальный дрейф.
- Каждый прогон пишется в ndjson сразу; сбой одного прогона ловится и не роняет весь тест.

## 6. Реализация

### `projects/forms-benchmark` — приложение

```
BENCH-CONTRACT.md
pages/<lib>/<form>/index.html       # по одному входу на (библиотека × форма) + baseline, calibration
scripts/build-entries.mjs           # ОТДЕЛЬНЫЙ vite build на каждый вход → dist/<lib>/<form>/
                                    # (точный tree-shaking и честная холодная загрузка; общие чанки MPA
                                    #  смешивали бы код разных страниц), сборка с сорсмапами
scripts/serve.mjs                   # один статический сервер для всего dist/
scripts/bundle-size.mjs, scripts/code-size.mjs
src/shared/ui/        # Input, Select (native), Checkbox, Radio, Textarea, MaskedInput, DateInput,
                      # CaptchaWidget (canvas + обновить), FieldFrame, разметка визарда/массива, 1 CSS
src/shared/api/       # fake API: латентность, flush(), счётчики; словари, авто, города,
                      # check-username/email, captcha, SMS, prefill, submit
src/shared/domain/    # функции из спеки (ставка, аннуитет, возраст…), нормализатор payload, часы
src/shared/messages/  # тексты ошибок
src/shared/harness/   # готовность по DOM-контракту, window.__bench (remount, unmount, api, submitted),
                      # зонд простоя; render-count-сборка: хук + реестр примитивов
src/libs/{reformer-core,reformer-json,formik,rhf,rjsf}/{registration,credit}/
```

- ReFormer-реализации — порт демо из `projects/react-playground/src/pages/demo/`
  (`registration-form`, `registration-form-renderer-json`, `complex-multy-step-form`,
  `complex-multy-step-form-renderer-json`): `@reformer/ui-kit` → нейтральные примитивы, `FormField` →
  `FieldFrame` поверх `useFormField` из `@reformer/cdk`, в renderer-json — `registry` +
  `FIELD_WRAPPER` на нейтральный UI; убрать `setTimeout(300)` из async-правил демо
  (`RegistrationForm.tsx:73,87`).
- `@reformer/*` — `"*"` из workspace, потребляются из `dist/`: перед сборкой пересобрать
  core → cdk → renderer-react → renderer-json.
- Сборочный скрипт называется `bench:build`, а не `build`, чтобы корневой `npm run build --workspaces`
  его не подхватывал.

Ключевые решения по библиотекам (подробно — в контракте):
- **RJSF:** визард — отдельный `<Form>` на срез данных шага, слияние в общее состояние;
  межшаговые правила — `customValidate`; условные поля — `allOf/if-then` + `ui:order`, сброс скрытых —
  `omitExtraData` + `liveOmit`; async — `extraErrors`; вычисляемые — контролируемый `formData` +
  `onChange` с защитой от циклов; async-опции — виджет с опциями из `formContext` (не переписывать
  `enum`); testid — адаптер id → path. Вариант с прекомпилированным валидатором — опциональная
  отдельная задача.
- **Formik:** один `<Formik>`, `validationSchema` текущего шага; вычисляемые —
  `setFieldValue(f, v, false)`; явный сброс скрытых.
- **RHF:** один `useForm`, `shouldUnregister: false`, резолвер на шаг; вычисляемые — `useWatch` +
  `setValue`; `Controller` для маски и капчи; `deps` для confirmPassword. В спайке регистрации
  проверить, что после `trigger()` исправленная ошибка гаснет на change, и что `refine` в zod 4 не
  пропускается.

### `projects/forms-benchmark-e2e` — Playwright

```
playwright.config.ts   # chromium (new headless, режим пишется в env.json), workers 1, retries 0,
                       # фикс. высокий viewport (шаг без скролла), флаги против фонового троттлинга,
                       # webServer = bench:build + serve; projects: conformance → bench (dependencies)
lib/libs.ts            # манифест участников
lib/cdp.ts             # троттлинг, метрики, GC, DOM-счётчики, трассировка
lib/input.ts           # сырой ввод по заранее вычисленным координатам; ASCII-данные
lib/phase.ts           # phase(name, fn): простой → GC → снимок → действие → in-page промис простоя → снимок
lib/init/latency.ts    # клавиша→кадр, обработка события, Event Timing, longtask, LoAF
lib/init/render-counter.ts
lib/results.ts         # ndjson на прогон + env.json (ОС, CPU, RAM, Chrome, Node, версии, git sha,
                       # dirty, хэш dist, троттлинг, N, сид)
pom/registration.pom.ts, pom/credit.pom.ts   # нейтральный testid-контракт
tests/conformance/*.spec.ts   # контрольные точки, счётчики API, эталонный payload — на все 5
tests/bench/registration.bench.ts, credit.bench.ts, calibration.spec.ts (счётчик рендеров)
scripts/report.mjs     # → summary.json, report.md, report.html (+ --publish в docs/benchmarks/)
results/<runId>/       # gitignored: raw.ndjson, env.json, traces/, отчёты
```

testid-контракт: `input-{path}`, `error-{path}`, `computed-{path}`, `btn-next`, `btn-prev`,
`btn-submit`, `btn-add-{array}`, `btn-remove-{array}-{i}`, `step-current[data-step]`,
`submit-result`; путь через дефис, как в существующем соглашении репо.

### Изменения вне новых проектов

- `docs/specs/registration-form.md` — **новая** спека (одобрено): основа —
  `packages/reformer-mcp/eval/calibration/cases/registration/spec.md`, капча — виджет (canvas,
  «обновить», async-проверка на сервере, детерминирована сидом), предзаполнение, «Очистить».
  `docs/specs/credit-application-form.md` — только чтение.
- `.gitignore` — `results/`, `test-results/`, `playwright-report/`, `dist/` новых проектов.
- Корневой `package.json` — скрипты `bench`, `bench:quick`, `bench:report`; `typecheck` — tsconfig
  новых проектов. `package-lock.json` — formik, yup, react-hook-form, @hookform/resolvers.

## 7. Порядок работ (эпик в bd, задачи с зависимостями)

| # | Задача | Зависит от |
|---|---|---|
| T1 | Контракт поведения и методики (`BENCH-CONTRACT.md`), матрица охвата кредита | — |
| T2 | Спека `docs/specs/registration-form.md` | T1 |
| T3 | Каркас приложения: версии, сборка по входам, сервер, guard на dist, ассерты бандла | — |
| T4 | Общий слой: примитивы + `FieldFrame` + CSS, fake API, domain, messages | T1, T3 |
| T5 | Харнесс: готовность, `__bench`, зонд простоя, рекордеры; render-count-сборка; страницы calibration и baseline | T3, T4 |
| T6 | Каркас e2e: config, CDP, сырой ввод, phase-раннер, ndjson + env | T3, T5 |
| T7 | Регистрация ×5 (подзадача на библиотеку, параллельно) — спайк паритета, таблица отклонений | T2, T4, T5 |
| T8 | Conformance регистрации | T6, T7 |
| T9 | Бенч регистрации + проход рендеров + трасса; пилот → CV → N | T8 |
| T10 | Статические метрики: бандл, атрибуция, LOC | T3, T7 |
| T11 | Агрегатор и отчёты (md + html) | T9, T10 |
| T12 | Общий слой кредита: domain, fake-эндпоинты | T1, T4 |
| T13 | Кредит ×5 (подзадача на библиотеку) | T12, T7 |
| T14 | Независимое ревью каждой библиотеки, правки, повтор conformance | T7, T13 |
| T15 | Conformance + бенч кредита (hydrate, массивы N = 1/10/50) | T13, T14, T9 |
| T16 | Финальный прогон на спокойной машине; `--publish` — только по просьбе | T11, T15 |

Регистрация идёт первой целиком (T7–T11): на ней обкатываются контракт, харнесс и отчёт до того, как
вкладываться в пять реализаций кредита.

## 8. Проверка

1. `npm run bench:build -w forms-benchmark` — все входы собраны; `bundle-size` печатает таблицу; ассерты
   (нет ui-kit/Radix/tailwind, prod-сборка) зелёные.
2. `calibration.spec.ts` — счётчик рендеров совпадает с заранее известными числами.
3. `npx playwright test --project=conformance` — зелёный для всех 5 реализаций обеих форм, payload
   совпадает с эталоном, счётчики вызовов API — в пределах контракта.
4. `BENCH_QUICK=1 npm run bench` — `results/<runId>/report.md` содержит все фазы и все библиотеки;
   A/A-пара не показывает значимой разницы.
5. Полный `npm run bench`; трассы открываются в DevTools; CV ключевых метрик < 10 %.
6. `tsc`, eslint и prettier по новым проектам.

Коммиты и push — только по явной просьбе; задачи — в bd, синхронизация по разделу «Beads sync»
в CLAUDE.md.
