# generate-llms-txt

Генератор `llms.txt` для пакетов `@reformer/*`. Собирает файл из двух источников: `docs/llms/*.md` и JSDoc/TSDoc на публичных экспортах из `src/index.ts`.

См. конвенцию: [docs/llms-convention.md](../../docs/llms-convention.md).

## Использование

```bash
node scripts/generate-llms-txt <package-path>
```

`package-path` — относительный или абсолютный путь к каталогу пакета (например `packages/reformer-cdk`).

Скрипт перезапишет `<package-path>/llms.txt`. Файл начинается с шапки `# AUTO-GENERATED. …` — руками не редактируется.

## Запуск через npm

В каждом `@reformer/*` подключается как `generate:llms`:

```jsonc
{
  "scripts": {
    "generate:llms": "node ../../scripts/generate-llms-txt .",
  },
}
```

Запуск пачкой по всем пакетам: `npm run generate:llms -ws`.

## Источники

- `package.json` — имя пакета, версия, описание для шапки.
- `docs/llms/*.md` — нумерованные тематические разделы. Имена секций должны совпадать со словарём из конвенции (`Installation`, `Quick Start`, …).
- `src/index.ts` (рекурсивно по `export * from './...'` и `export { ... } from './...'`) — публичные символы с JSDoc.

## Идемпотентность

Порядок жёстко фиксирован:

- `docs/llms/*.md` — по числовому префиксу имени файла (`01-`, `02-`, …).
- Секции внутри файла — в порядке появления.
- API-символы — алфавитно по имени.

Повторный запуск не должен менять файл.

## Зависимости

Только то, что уже есть в монорепо: `typescript` (Compiler API). Внешние зависимости не подтягиваются.
