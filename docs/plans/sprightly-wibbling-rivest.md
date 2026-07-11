# План: info-иконка с подсказкой Variants vs Examples в таб-баре доки

## Context

В доке компонентов (Docusaurus-сайт `projects/reformer-doc`) каждая страница компонента открывается оболочкой `ComponentDoc` с таб-баром **Variants | Examples | API**. Разница между вкладками не очевидна пользователю:

- **Variants** — готовые конфигурации одного и того же компонента с разными преднастроенными пропсами (витрина состояний: напр. обычный Select для пользователей и Select с расширенной инфой = 2 варианта одного компонента).
- **Examples** — приёмы/рецепты в коде: как решить конкретную задачу (напр. как разные Data Provider'ы работают с Select).

Нужно добавить в таб-бар info-иконку у правого края; при наведении (и при фокусе с клавиатуры) всплывает подсказка, объясняющая эту разницу. Итог — пользователь сразу понимает, зачем нужны обе вкладки.

**Решения (согласованы с пользователем):**
- Tooltip — собственный лёгкий CSS-tooltip (без новых зависимостей), появляется по `:hover` и `:focus-within`.
- Иконка прижата к правому краю таб-бара; подсказка объясняет Variants vs Examples.

## Файлы

Правка локализована в двух файлах папки `projects/reformer-doc/src/components/demo/`:

1. **`ComponentDoc.tsx`** — разметка иконки + tooltip внутри `.tabBar`.
2. **`styles.module.css`** — стили `.hint`, `.hintTrigger`, `.tooltip`.

Готового Tooltip-компонента в проекте нет; иконки берём из уже установленного `lucide-react` (как в `ApiPreview.tsx` / `ApiExplorer.tsx`). Стили используют Infima-переменные (`var(--ifm-...)`), поэтому тёмная тема поддержится автоматически.

## Реализация

### 1. `ComponentDoc.tsx`

- Добавить импорт иконки: `import { Info } from 'lucide-react';`
- Импортировать `useId` из `react` (`import { useEffect, useId, useState } from 'react';`) и получить `const hintId = useId();` — чтобы связать триггер и tooltip через `aria-describedby` без риска дублей `id`, если на странице окажется несколько `ComponentDoc`.
- Внутри `<div className={styles.tabBar}>`, **после** блока `TABS.map(...)`, добавить блок-подсказку. `margin-left: auto` в CSS прижмёт его к правому краю:

```tsx
<div className={styles.hint}>
  <button
    type="button"
    className={styles.hintTrigger}
    aria-label="В чём разница между Variants и Examples"
    aria-describedby={hintId}
  >
    <Info size={16} aria-hidden />
  </button>
  <div role="tooltip" id={hintId} className={styles.tooltip}>
    <p>
      <strong>Variants</strong> — готовые конфигурации компонента: один и тот же
      компонент с разными преднастроенными пропсами. Витрина состояний (напр.
      обычный Select и Select с расширенной информацией — два варианта).
    </p>
    <p>
      <strong>Examples</strong> — приёмы в коде: как решить задачу. Напр. как
      разные Data Provider’ы работают с компонентом (рецепты использования).
    </p>
  </div>
</div>
```

Триггер — настоящая `<button>`, поэтому фокусируется с клавиатуры, а `:focus-within` на обёртке покажет tooltip и при табуляции (a11y).

### 2. `styles.module.css`

Добавить в секцию «Оболочка страницы компонента + табы» (после `.tabActive`):

```css
/* ── Info-подсказка Variants vs Examples ─────────────────────────────── */
.hint {
  position: relative;
  display: flex;
  align-items: center;
}

.hintTrigger {
  appearance: none;
  background: transparent;
  border: none;
  padding: 0.4rem;
  display: inline-flex;
  align-items: center;
  color: var(--ifm-color-emphasis-500);
  cursor: help;
  transition: color 0.15s ease;
}

.hintTrigger:hover,
.hintTrigger:focus-visible {
  color: var(--ifm-color-primary);
}

.tooltip {
  position: absolute;
  top: calc(100% + 8px);
  right: 0; /* раскрывается влево от иконки — не уедет за правый край */
  z-index: 10;
  width: max-content;
  max-width: 320px;
  padding: 0.75rem 0.9rem;
  border: 1px solid var(--ifm-toc-border-color);
  border-radius: 8px;
  background: var(--ifm-background-surface-color);
  box-shadow: var(--ifm-global-shadow-md);
  color: var(--ifm-color-emphasis-800);
  font-size: 0.85rem;
  font-weight: 400;
  line-height: 1.45;
  text-align: left;
  visibility: hidden;
  opacity: 0;
  transform: translateY(-4px);
  transition:
    opacity 0.15s ease,
    transform 0.15s ease,
    visibility 0.15s;
}

.tooltip p {
  margin: 0;
}
.tooltip p + p {
  margin-top: 0.5rem;
}

.hint:hover .tooltip,
.hint:focus-within .tooltip {
  visibility: visible;
  opacity: 1;
  transform: translateY(0);
}
```

## Проверка (end-to-end)

1. Запустить доку: `cd projects/reformer-doc && npm run start`.
2. Открыть любую страницу компонента, где рендерится `ComponentDoc`, напр. `/docs/ui-kit/input` или `/docs/ui-kit/select`.
3. Убедиться, что справа в таб-баре появилась info-иконка, прижатая к правому краю; табы Variants/Examples/API не сместились.
4. Навести курсор на иконку — всплывает tooltip с двумя абзацами (Variants / Examples), корректно читается, не уезжает за правый край.
5. Проверить клавиатуру: `Tab` до иконки — tooltip показывается по фокусу (`:focus-within`).
6. Переключить тему (светлая/тёмная) — фон, рамка и текст tooltip читаемы в обеих (через Infima-переменные).
7. Опционально — smoke-скриншот playwright MCP c явным `filename` в `projects/react-playground-e2e/screenshots/tooltip-hint/` (hover-состояние), согласно правилам вывода файлов.
