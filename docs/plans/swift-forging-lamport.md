# Design doc: режим «Живой dev-сервер» (iframe) в reformer-builder

> **Объём этой задачи — только проектирование** (по решению пользователя). Кода и правок спеки не
> делаем. Итоговый deliverable — создать этот дизайн-документ в
> `projects/reformer-builder/docs/architecture/live-preview-embed.md` и завести bd-issue на реализацию.
> Этот plan-файл — полный текст документа; см. раздел «Deliverable».

## 1. Context — зачем

Конструктор `projects/reformer-builder` показывает форму двумя способами (тумблер в
[FloatingActions.tsx:47-66](../../projects/reformer-builder/src/canvas/FloatingActions.tsx#L47-L66),
ветвление в [CanvasArea.tsx:33](../../projects/reformer-builder/src/canvas/CanvasArea.tsx#L33)):

- **Схематичный** (`wire`) — agnostic wireframe из метаданных каталога;
- **Runtime** (`runtime`) — реальный рендер через `@reformer/renderer-json`
  ([RuntimePreview.tsx](../../projects/reformer-builder/src/canvas/RuntimePreview.tsx),
  [build-preview.ts](../../projects/reformer-builder/src/preview-runtime/build-preview.ts)).

**Проблема.** Runtime-превью работает «в вакууме» и не отрисовывает формы, которым нужен **контекст
приложения**. Форма ReFormer — это три слоя, из которых JSON кодирует только первый:

1. **Layout** — выразим в JSON (`$component`, `$html`, `$model`, `$dataSource`, `$fn`, `$locale`).
2. **Модель + behavior** — `compute`/`copyFrom`/`enableWhen`/`onChange`, вычисляемые поля, загрузка
   справочников — исполняемый TS в `createForm({ behavior })`.
3. **Render-behavior** — `hideWhen`/`patchProps`/submit/lifecycle/API — императивный TS.

Слои 2–3 в JSON не выражаются в принципе. Поэтому изолированное Runtime-превью строит только скелет:
кастомные `$component` вне 21 ui-kit-имени → плейсхолдер
([unknown-component.tsx](../../projects/reformer-builder/src/preview-runtime/unknown-component.tsx)),
реальные `$dataSource/$fn/$locale` → моки
([mock-sources.ts](../../projects/reformer-builder/src/preview-runtime/mock-sources.ts)), модель
синтезируется пустой ([synth-model.ts](../../projects/reformer-builder/src/preview-runtime/synth-model.ts)),
behavior/валидация не применяются. Единственный верный рендер такой формы — **внутри реального приложения**.

**Решение (формулировка пользователя).** Не «connected renderer». Разработчик локально поднимает свой
dev-сервер; билдер **встраивает его в iframe** в рабочей области; разработчик сам открывает нужную
страницу и видит ровно то, что увидел бы, открыв её в браузере. Появляется кнопка «прокси» с настройкой
**адреса и порта**. Опционально — правка схемы прямо в этой форме: билдер шлёт отредактированную схему в
iframe через **postMessage**, а страница (если содержит мини-мост-listener) ре-рендерит без сохранения
файла.

Ключевой сдвиг, который делает подход простым: билдер — **не рендерер**, а *окно* в уже запущенный
разработчиком софт. Всю тройку слоёв рендерит dev-сервер; билдер не привносит никакой семантики рендера.

## 2. Decision & scope

Реализуем **третий режим предпросмотра `live`**: plain view-only iframe запущенного dev-сервера +
опциональный **односторонний** слой schema-push поверх. Это в точности §18 брейншторма
([reformer-builder.md:888-943](../../projects/reformer-builder/docs/brainstorms/reformer-builder.md#L888-L943)),
но сведённый к «plain iframe (MVP) + push (v2 opt-in)» — без двусторонней синхронизации узел↔DOM.

> ⚠️ **Реверс отклонённого решения.** Спека §9
> ([reformer-builder-mvp.md:176-178](../../projects/reformer-builder/docs/specs/reformer-builder-mvp.md#L176-L178))
> и §18.9 брейншторма зафиксировали, что iframe+мост **отклонён в раунде 12** («живой результат — вне
> билдера»). Спека **read-only** (правило CLAUDE.md) — в рамках этой работы её **не редактируем**.
> Обновление §9/§12 спеки под реверс — **отдельная явно-санкционированная задача**.

## 3. Non-goals (явно вне обеих фаз)

- **Нет корреляции узел ↔ DOM.** Пользователь отверг same-origin proxy → iframe cross-origin → билдер
  не читает DOM iframe: нет подсветки «этот узел → тот элемент», нет клика-обратно (весь §18.3/§18.4:
  select/highlight/hover/node-clicked — вне scope). Выделение остаётся понятием билдера.
- **Нет двусторонней синхронизации.** v2 — только билдер → iframe (schema-push). Заполненное состояние
  формы принадлежит разработчику и обратно не зеркалится.
- **Push — не zero-integration.** Требует listener на странице (мини-мост). Без него — plain iframe.
- **Push не заменяет save→HMR для структурных изменений** — см. ограничение «layer-1 only» в §9.

## 4. UX / UI

**Размещение — третий режим внутри `CanvasArea`, не отдельная вкладка/рабочая область.** Это превью
активной схемы, пир к Схематичный/Runtime, и должно оставаться связанным с `tab.schema` для push. Iframe
монтируется в тот же слот, что `RuntimePreview` ([CanvasArea.tsx:31-38](../../projects/reformer-builder/src/canvas/CanvasArea.tsx#L31-L38)),
но для `live` **обходит** узкую центрирующую обёртку `max-w-[680px]` — реальная страница шире формы,
занимает всю ширину canvas-панели.

**Тумблер режимов — третий сегмент** «Живой» рядом с «Схематичный»/«Runtime» в
[FloatingActions.tsx:47-66](../../projects/reformer-builder/src/canvas/FloatingActions.tsx#L47-L66)
(тот же стиль). Справа — кнопка-шестерёнка, открывающая попап настроек («прокси»).

**Попап настроек** (ui-kit `Popover` + `Input`/`Switch`/`Button` из главного barrel):

| Поле | Дефолт | Примечание |
|---|---|---|
| Protocol (`http`/`https`) | `http` | |
| Host | `localhost` | |
| Port | `5173` | Vite-дефолт; можно пусто |
| Path | `/` | |
| Итоговый URL | (read-only) | собирается через `new URL()` |
| Enable schema-push (Switch) | off | v2; в MVP скрыт/disabled |
| Действия | | **Открыть** (монтировать/сменить iframe), **Обновить** (remount через React `key` — cross-origin `location.reload()` недоступен), **Стоп** (снять iframe, конфиг сохранить) |

**Валидация ввода** (до сборки URL): host — непусто, `[A-Za-z0-9.-]` (или IPv6 `[...]`), без пробелов/схем/`/`/`@`;
port — целое 1–65535 или пусто; path — начинается с `/`, обрезать после `#`/пробелов, не давать вставить
полный URL; собрать через `new URL()`, при исключении — инлайн-ошибка и disable «Открыть». На HTTPS-хосте
при `http` + non-loopback host — предупреждение «браузер заблокирует mixed content» (попытку всё равно
разрешить).

**Loading / error / нет сервера** (cross-origin почти не даёт сигналов — проектируем на непрозрачность):
- Оверлей «Загрузка…» до события `load` у `<iframe>`, затем скрыть.
- HTTP-ошибки, отказ `X-Frame-Options`, connection-refused из родителя cross-origin **не детектируются**.
  Митигация: таймаут ~4–6 с без `load` → неблокирующая карточка поверх iframe: «Не удалось загрузить
  <URL>. Проверьте, что dev-сервер запущен и не запрещает встраивание (X-Frame-Options / frame-ancestors)»
  + «Повторить». Iframe оставить смонтированным (может ещё успеть).
- Конфиг пуст / не задан → пустое состояние в ветке: «Укажите адрес dev-сервера» + кнопка открытия попапа.

**Персист конфига** — `localStorage['rb.live.config']` (JSON), в стиле существующих ключей `rb.layout.*`.
Читать при инициализации стора, писать при каждом изменении.

## 5. State & store

Иммутабельный reducer-стор (логика в `reducers.ts`, тонкие экшены в `editor-store.ts`, селектор в
`hooks.ts`). Персиста UI-состояния сейчас нет (только `rb.layout.*` через `useDefaultLayout` и IndexedDB
для handle) — persist live-конфига net-new.

- [store/types.ts:16](../../projects/reformer-builder/src/store/types.ts#L16) — расширить union:
  `PreviewMode = 'wire' | 'runtime' | 'live'`; добавить интерфейс и поле:
  ```ts
  export interface LiveConfig {
    protocol: 'http' | 'https';
    host: string;          // 'localhost'
    port: string;          // '5173' (строка — чтобы был представим пустой порт)
    path: string;          // '/'
    pushEnabled: boolean;  // v2; дефолт false
  }
  // UiState += live: LiveConfig
  ```
- [store/reducers.ts:26-28](../../projects/reformer-builder/src/store/reducers.ts#L26) (`initialUi`) —
  `live: loadLiveConfig()`; `initialLiveConfig()` = дефолты выше; `setLiveConfig(state, patch)` (merge)
  рядом с `setPreview` ([reducers.ts:214](../../projects/reformer-builder/src/store/reducers.ts#L214)).
  Импуре-чтение localStorage изолировать в `loadLiveConfig()` (reducers остаются чистыми).
- [store/editor-store.ts:49](../../projects/reformer-builder/src/store/editor-store.ts#L49) — экшен
  `setLiveConfig(patch)` = `setState(R.setLiveConfig)` + `persistLiveConfig(...)` (запись в localStorage
  в обёртке экшена, не в reducer). `setPreview` уже есть — с расширенным union правок не требует.
- `store/hooks.ts` — опционально `useLiveConfig()` → `s.ui.live`.

## 6. Transport & protocol (v2, opt-in)

Envelope из §18.4, урезанный до одностороннего push + handshake.

**Конверт** (обе стороны): `{ source, v, type, ... }`, `v: 1` на каждом сообщении.
- билдер→iframe: `source: 'reformer-builder'`;
- iframe→билдер (мост): `source: 'reformer-builder-bridge'`.

**Handshake** (когда мост готов + какой origin доверять):
1. iframe грузится async; билдер слушает DOM-событие `load` на `<iframe>`.
2. На `load` билдер шлёт `hello` `{source:'reformer-builder', v:1, type:'hello'}` с **явным `targetOrigin`**
   = сконфигурированный dev-origin (`protocol://host:port`), никогда `'*'`.
3. Мост (если есть) на `hello` от разрешённого origin запоминает `event.origin` как доверенный origin
   билдера и отвечает `ready` `{source:'reformer-builder-bridge', v:1, type:'ready', capabilities:['schema-push'], appVersion}`.
4. Билдер на `ready` проверяет `event.origin === devOrigin`, включает push, показывает бейдж «connected».
   Нет `ready` за N секунд → мост отсутствует → остаёмся plain view-only, push выключен, бейдж «view-only».

**Schema-push** (билдер→iframe): на коммит-изменение `tab.schema` шлём
`{source:'reformer-builder', v:1, type:'schema', revision, schema}` с `targetOrigin = devOrigin`.
`revision` — монотонный счётчик (мост игнорит устаревшие/out-of-order и может слать ack).

**Ack / error** (мост→билдер, рекомендуется): `{...type:'applied', revision}` или
`{...type:'error', revision, message}`. Билдер показывает `error` тостом — так разработчик узнаёт, что
пушнутая схема требует нового model/behavior-обвязки (см. §9, ограничение layer-1).

**Origin safety** (обе стороны): всегда `postMessage(msg, devOrigin)` — не `'*'`; в своём `message`-listener
дропать событие, если `event.origin !== devOrigin` / `data.source` не тот / `data.v !== 1`. Мост дефолтно
запрещает origins, разрешает только пойманный из `hello`.

**Версионирование:** билдер шлёт `v`; мост эхом отдаёт поддерживаемую `v` в `ready`. Несовпадение →
деградация до plain iframe.

**Связь с «правкой схемы в форме»** — без спец-кейса Monaco. И raw-JSON Monaco
([RawJson.tsx:33-44](../../projects/reformer-builder/src/canvas/RawJson.tsx#L33-L44) → `replaceSchema`),
и визуальный редактор (`commit`) меняют одну и ту же `tab.schema` (иммутабельно → новая ссылка только на
коммит). Единственный триггер push = «ссылка `schema` активной вкладки изменилась». `LiveIframe` подписан
на схему активной вкладки; на изменение (debounce ~250 мс) шлёт `schema`-сообщение. Покрывает raw-JSON,
визуальные правки и undo/redo единообразно; в `RawJson.tsx` лезть не нужно.

**Graceful degradation:** нет `ready` → plain iframe, `schema`-сообщения не шлём (или шлём — страница без
listener их молча игнорит). Никогда не бросаем и не блокируем вид. Не-ReFormer страница просто отображается.

## 7. Мини-мост для приложения

**Что добавляет приложение:** крошечный listener, который (а) завершает handshake и (б) применяет
пушнутые схемы, переопределяя свою render-схему.

Минимальная React-форма (для `projects/react-playground`, в стиле его `createForm` +
`JsonRendererProvider` + `JsonFormRenderer`):
```tsx
const schema = useBuilderBridge({ ownSchema, allowedOrigins: ['http://localhost:5173', 'https://<pages-host>'] });
<JsonRendererProvider settings={{ registry, model }}>
  <JsonFormRenderer schema={schema} />
</JsonRendererProvider>
```
`useBuilderBridge` ставит `message`-listener; на `hello` из allowed-origin запоминает origin билдера и
отвечает `ready`; на `schema` валидирует конверт+origin, `try`-парсит/guard'ит, при успехе кладёт в
`override` (иначе шлёт `error`); возвращает `override ?? ownSchema`. **Важно:** страница держит свои
реальные model/behavior/registry — push меняет только layout-JSON (слой 1), слои 2–3 остаются приложения.

**Развилка доставки (§18.5) — рекомендация: отдельный opt-in модуль**, не в renderer-json и не Vite-плагин:
- *Не renderer-json* — ядро/рендерер должны оставаться agnostic; иначе listener авто-цепляется на прод-страницах.
- *Не авто-инжект Vite-плагином* — невидимая магия для security-sensitive cross-origin listener; неверный дефолт.
- *`@reformer/builder-bridge`* (или задокументированный ~30-строчный сниппет для вставки) — явный, opt-in
  там, где разработчик хочет live-preview; без связности; разработчик контролирует `allowedOrigins`. Точно
  ложится на формулировку пользователя «если содержит мини-мост-listener».

## 8. Точки расширения в коде

| Файл | Изменение |
|---|---|
| [store/types.ts:16](../../projects/reformer-builder/src/store/types.ts#L16) | `PreviewMode += 'live'`; интерфейс `LiveConfig`; `UiState.live` |
| [store/reducers.ts:26](../../projects/reformer-builder/src/store/reducers.ts#L26) | `initialUi.live`, `initialLiveConfig()`, `loadLiveConfig()`, reducer `setLiveConfig` |
| [store/editor-store.ts:49](../../projects/reformer-builder/src/store/editor-store.ts#L49) | экшен `setLiveConfig` + `persistLiveConfig` |
| store/hooks.ts | опц. `useLiveConfig()` |
| [FloatingActions.tsx:47-66](../../projects/reformer-builder/src/canvas/FloatingActions.tsx#L47-L66) | третий сегмент «Живой» + шестерёнка |
| [CanvasArea.tsx:33](../../projects/reformer-builder/src/canvas/CanvasArea.tsx#L33) | ветка `live` → `<LiveIframe>`; обход `max-w-[680px]` |
| **new** canvas/LiveIframe.tsx | URL из `ui.live`, `<iframe>` + sandbox, load/timeout+error-оверлей, пустое/бейдж-состояния; v2: message-listener (handshake, ack/error) + debounced push по ссылке `schema` |
| **new** canvas/LiveConfigPopover.tsx | форма host/port/path (ui-kit), валидация, `editorActions.setLiveConfig` |
| vite.config.ts | без изменений (транспорт = iframe+postMessage, не `server.proxy`; отметить намеренный отказ) |
| **new** packages/builder-bridge/ (v2) | хук/installer мини-моста + пример в react-playground |

`RuntimePreview.tsx` — образец self-contained превью-компонента для `LiveIframe.tsx`.

## 9. Constraints & risks

- **Mixed content (уточнено).** Chromium считает `http://localhost`, `http://127.0.0.1`, `::1`,
  `*.localhost` *potentially trustworthy* — поэтому даже HTTPS-билдер (GitHub Pages) **может** встроить
  loopback dev-сервер. Non-loopback `http://` (LAN-IP `192.168.x.x`, кастомные хосты) из HTTPS-билдера
  **блокируется** как active mixed content. → фича **loopback-first**, не строго «локал-дев-онли». Дефолт
  host `localhost`; предупреждение в попапе при http+non-loopback на HTTPS-хосте; для non-loopback —
  локально запущенный билдер (`http`-origin) или `https` dev-сервер.
- **Cross-origin непрозрачность.** Нет чтения DOM → нет node↔DOM подсветки; родитель не детектит фейлы
  загрузки/HTTP-статус/отказ фрейминга. Весь error-UX — на таймаутах/оверлеях.
- **X-Frame-Options / CSP `frame-ancestors`.** Если dev-сервер их выставляет с исключением origin билдера —
  iframe молча отказывает. Vite dev по умолчанию их **не ставит** (проверено: в обоих vite-конфигах нет
  `server.headers`) → playground встраивается из коробки. **Verify-item** и документированный failure mode.
- **Sandbox vs функциональность.** Реальному приложению нужны `allow-scripts allow-forms allow-same-origin
  allow-popups`; `allow-scripts`+`allow-same-origin` вместе = страница с полными правами своего origin
  (ожидаемо — это доверенный dev-сервер разработчика). Документировать: указывать только доверенные origins.
- **postMessage-инъекции.** Обе стороны пинят `event.origin` и `data.source`/`data.v`; `targetOrigin`
  никогда `'*'`; мост дефолтно-deny.
- **Санитизация ввода.** host/port/path через `new URL()` — не дать собрать `javascript:`/`data:`/креды.
- **Live-push — только слой 1 (ключевое ограничение).** Push ре-рендерит layout, но новые `$model`-пути /
  `$component`-имена / dataSource, которых нет в model/registry/behavior приложения, не отрисуются
  полностью — мост `try/catch`'ит конверсию и шлёт `error` (→ тост), сохраняя last-good рендер. Формулировка
  для пользователя: push отлично для правки существующих полей вживую; структурные добавления всё равно
  требуют TS-обвязки разработчика + save→HMR.
- **Реверс отклонённого решения спеки** — см. §2. Спека read-only; обновление — отдельная задача.
- **Рестарт dev-сервера / дрейф порта.** «Обновить» = remount по React `key`. Документировать, что рестарт
  сервера может потребовать ручного обновления.

## 10. Phasing & acceptance

**MVP (Phase 1) — plain view-only iframe, без postMessage:**
- `PreviewMode += 'live'`; `LiveConfig` + дефолты + persist `rb.live.config`; `setLiveConfig`.
- третий сегмент + шестерёнка; `LiveConfigPopover` (protocol/host/port/path, валидация, Открыть/Обновить/Стоп).
- ветка `live` в `CanvasArea`; `LiveIframe.tsx` (URL, sandbox, load/timeout-оверлей, пустое/error, full-width).
- моста/push/listener нет; `pushEnabled` скрыт.
- **Acceptance:** навести на запущенный dev-сервер (Vite playground) → видно реальную страницу; конфиг
  переживает перезагрузку; graceful error-оверлей, когда сервер выключен или запрещает фрейминг.

**v2 (Phase 2) — opt-in handshake + односторонний live schema-push + мини-мост:**
- билдер: message-listener в `LiveIframe` (hello/ready, ack/error), пиннинг origin+версии, бейдж
  connected/view-only, debounced push по ссылке `tab.schema`, счётчик `revision`, error→тост; `pushEnabled` активен.
- приложение: `@reformer/builder-bridge` (хук+installer) или сниппет; пример в playground с
  `override ?? ownSchema`.
- **Acceptance:** с установленным мостом правка схемы в билдере (визуально или raw-JSON) ре-рендерит живую
  страницу без сохранения файла; без моста — поведение как в MVP.

Явно **вне обеих фаз** (было §18.3/§18.4): node↔DOM select/highlight/hover, клик-обратно, любое чтение
DOM — требуют отвергнутого same-origin proxy.

## Deliverable (эта задача)

1. Создать `projects/reformer-builder/docs/architecture/live-preview-embed.md` с содержимым этого документа
   (каталог `docs/architecture/` сейчас пуст — естественный дом для фичи, реверсящей решение спеки).
2. Завести bd-issue (feature) на реализацию с ссылкой на документ и разбивкой на Phase 1 / Phase 2.
3. **Не** трогать код и `docs/specs/`. Обновление спеки §9/§12 — отдельная явно-санкционированная задача.

## Verification

Поскольку объём — только документ, проверка = ревью документа пользователем. Критерии готовности к
реализации (для будущей сессии) описаны в §10 (Acceptance для Phase 1 / Phase 2). Verify-item на реализации:
проверить, что Vite dev-сервер не выставляет `X-Frame-Options`/`frame-ancestors`, запретных для origin билдера
(по умолчанию не выставляет — оба vite-конфига без `server.headers`).

## Open questions / follow-ups

- Мост как пакет `@reformer/builder-bridge` vs вставляемый сниппет (рекомендация — пакет + документированный сниппет).
- Пушить ли также тему (light/dark) в iframe для согласованности.
- Отдельная задача на обновление спеки §9/§12 под реверс решения.
