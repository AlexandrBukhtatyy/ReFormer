# reformer-builder-playground-e2e

E2E-тесты [`@reformer/builder`](../reformer-builder) на Playwright. Билдер поднимается целиком
и открывает [`reformer-builder-playground`](../reformer-builder-playground) как рабочий каталог —
тем же путём, что человек: «Открыть папку…» → дерево проекта → редактор.

Юнит- и браузерные тесты самого билдера (`npm test`, `npm run test:browser` в его пакете)
проверяют модули по отдельности. Здесь — то, что видно только в собранном приложении: конфиг
запуска, открытие проекта, плагины из его `.ui_builder/`, запись на диск, переоткрытие после
перезагрузки.

## Быстрый старт

```bash
npm run test:e2e -w reformer-builder-playground-e2e          # dev-сервер билдера поднимется сам
npm run test:e2e:ui -w reformer-builder-playground-e2e       # интерактивный режим Playwright
npm run test:e2e:headed -w reformer-builder-playground-e2e   # с окном браузера
npm run test:e2e:report -w reformer-builder-playground-e2e   # отчёт прошлого прогона
```

Из каталога пакета — обычные флаги Playwright:

```bash
cd projects/reformer-builder-playground-e2e
npx playwright test tests/forms.spec.ts
npx playwright test -g "сохраняется в каталог"
npx playwright test --debug
```

Браузеры Playwright ставятся один раз: `npx playwright install chromium`.

## Что поднимается

| Переменная             | Значение          | Что делает                                                                                   |
| ---------------------- | ----------------- | -------------------------------------------------------------------------------------------- |
| `BUILDER_E2E_TARGET`   | `dev` (умолчание) | vite dev-сервер билдера: сборка не нужна, правка исходников билдера видна следующим прогоном |
|                        | `dist`            | собранный билдер под лаунчером — то, что человек получает из `npx reformer-builder`          |
| `BUILDER_E2E_PORT`     | `5184`            | порт сервера                                                                                 |
| `BUILDER_E2E_BASE_URL` | —                 | адрес уже запущенного билдера; сервер тогда не поднимается                                   |

```bash
npm run build -w @reformer/builder                         # для dist нужен свежий projects/reformer-builder/dist
npm run test:e2e:dist -w reformer-builder-playground-e2e
```

Конфиг запуска в обоих режимах один — `.ui_builder/config.json` playground: профиль
`ReFormer + RJSF`, локаль `ru`, светлая тема. Тесты опираются на русские подписи, поэтому локаль
закреплена конфигом, а не умолчанием билдера.

Вне CI уже запущенный на порту сервер переиспользуется. Его можно держать поднятым —
`npm run builder -w reformer-builder-playground` — и гонять тесты без ожидания старта. Порт свой
намеренно: на 5174 живёт dev билдера с конфигом самого разработчика, и подхватить его значило бы
тестировать чужой состав плагинов.

## Как тест открывает каталог

Билдер получает каталог проекта из `showDirectoryPicker()` — системного диалога, которым Playwright
не управляет. Поэтому выбор каталога подменён, а отдаёт подмена **копию playground в OPFS**
страницы ([playground-disk.ts](tests/shared/playground-disk.ts)).

OPFS, а не объект-заглушка: билдеру нужен настоящий `FileSystemDirectoryHandle` — он кладёт хэндл
в IndexedDB, по нему восстанавливает проект после перезагрузки, сверяет каталоги через
`isSameEntry`. Хэндл OPFS проходит весь этот путь тем же кодом, что каталог с диска; подменено
одно-единственное место — сам диалог.

Следствия:

- **тесты изолированы.** У каждого свой контекст браузера, значит свои OPFS и IndexedDB и свежая
  копия проекта. Прогон идёт параллельно и не трогает рабочее дерево репозитория;
- **запись проверяется по копии.** «Билдер сохранил форму» — это `disk.readText(...)`, а не файл
  в `projects/reformer-builder-playground`;
- **в копию идёт то, что видит git** — отслеживаемые и новые файлы playground, без
  игнорируемых (`git ls-files`). Копия поэтому одинакова на любой машине. Игнорируемый каталог,
  нужный тесту, называют явно: `builder.openPlayground({ ignored: ['<путь>'] })`.

## Кит HexaUI

[kit.spec.ts](tests/kit.spec.ts) проверяет кит из плагина проекта. Сборка плагина в git не едет,
поэтому тест берёт её из игнорируемого каталога и **пропускается, пока она не собрана**:

```bash
npm run plugins:hexa-ui -w reformer-builder-playground
```

HexaUI объявляет React до 18-го, а билдер работает на 19-м — кит пишет в консоль известные
предупреждения. Тест отсеивает их по списку; любая другая ошибка по-прежнему его проваливает.

## Фикстуры

Тесты импортируют `test` и `expect` из [tests/shared/fixtures.ts](tests/shared/fixtures.ts).

| Фикстура     | Что даёт                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------- |
| `builder`    | [`BuilderApp`](tests/shared/builder-app.pom.ts) — оболочка: открытие проекта, дерево, вкладки, палитра команд |
| `disk`       | [`PlaygroundDisk`](tests/shared/playground-disk.ts) — «диск»: `readText`, `writeText`, `exists`, `snapshot`   |
| `pageErrors` | ошибки страницы за тест; включена всегда — `console.error` или исключение проваливают тест                    |

```ts
import { test, expect } from './shared/fixtures';

test('правка сохраняется в каталог проекта', async ({ builder, disk, page }) => {
  await builder.openPlayground();
  await builder.openFile('forms/contact.rjsf.json');

  await page.getByTestId('rjsf-title').fill('Новый заголовок');
  await builder.save();

  await expect(builder.statusBar).toContainText('Всё сохранено');
  expect(JSON.parse(await disk.readText('forms/contact.rjsf.json')).schema.title).toBe(
    'Новый заголовок'
  );
});
```

`pageErrors` нужна потому, что билдер отказы не роняет, а пишет в консоль и остаётся рабочим:
«плагины каталога не загрузились» глазами сценария не видно. Тест, которому ошибка нужна
по сценарию, разбирает список сам и очищает его (`pageErrors.length = 0`).

Уведомления проверяйте через `builder.shownNotifications()` — это все показанные с загрузки
страницы, включая уже исчезнувшие. Уведомление живёт около четырёх секунд, и проверка «сейчас их
нет» дождётся пустого списка даже после предупреждения.

## Раскладка

```text
tests/
├── shared/
│   ├── paths.ts              пути: пакет билдера, playground, конфиг запуска
│   ├── playground-disk.ts    копия playground в OPFS и подмена выбора каталога
│   ├── builder-app.pom.ts    оболочка билдера как Page Object
│   └── fixtures.ts           test / expect с фикстурами
├── launch.spec.ts            конфиг запуска: заголовок, состав, локаль; стартовая страница
├── config.spec.ts            один config.json на запуск и проект: без уведомлений, пока совпадает
├── project.spec.ts           открытие каталога, дерево, неизменность файлов, перезагрузка
├── forms.spec.ts             формы RJSF и ReFormer в своих редакторах, сохранение
├── plugins.spec.ts           плагин из .ui_builder/plugins проекта
└── kit.spec.ts               кит HexaUI из плагина проекта (нужна сборка плагина)
```

В `BuilderApp` — только оболочка. Локаторы редакторов живут в тестах: у каждого плагина своя
разметка. Строку дерева ищите по пути (`builder.treeItem('forms/contact.rjsf.json')`), а не
по имени — имена не уникальны.

Конфиг проекта и вклады его плагинов появляются позже дерева, отдельной цепочкой. Тест,
которому нужен её итог, ждёт `builder.projectPluginsReady()`. Тест, который сначала правит
«диск», открывает проект по шагам: `builder.goto()`, `disk.seed()`, правка, `builder.openFolder()` —
см. [config.spec.ts](tests/config.spec.ts).

## Артефакты

`test-results/` (скриншоты упавших тестов, трейсы повторов) и `playwright-report/` — в `.gitignore`.
