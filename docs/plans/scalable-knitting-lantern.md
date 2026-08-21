# SignalJSONInspector — живой JSON модели

## Context

Нужен компонент, который принимает `FormModel` пропсом и показывает актуальный JSON при любом
изменении модели. Существующий [FormStateDisplay](projects/react-playground/src/pages/examples/registration-form/FormSateDisplay.tsx)
решает похожую задачу, но подписывается на узел ФОРМЫ (`GroupNode.value`) и использует
`useState` + `useEffect` — новый компонент работает от МОДЕЛИ и от `useSyncExternalStore`,
как остальные хуки кодовой базы.

Код согласован в чате. Этот план — только про размещение файла.

## Файл

Создать `projects/react-playground/src/pages/examples/registration-form/SignalJSONInspector.tsx`
с кодом из ответа (рядом с `FormSateDisplay.tsx`, тот же пример-контекст).

Альтернатива, если компонент нужен всем примерам и JSON-реестрам: вынести в
`packages/reformer-ui-kit/src/components/signal-json-inspector/` + экспорт из index пакета.
Тогда добавляется props-схема по образцу соседних компонентов ui-kit.

## Ключевые решения (чтобы не потерять при правках)

- Подписка на `model.$` — корень дерева `$` сам является `ReadonlySignal<T>` агрегата всей
  модели ([form-model.ts:322-334](packages/reformer/src/state/form-model.ts#L322-L334)).
- Снимок держится в `useRef` и обновляется из колбэка `subscribe`. `model.get()` в `getSnapshot`
  недопустим: новый объект на каждый вызов → бесконечный ре-рендер в `useSyncExternalStore`.
- Первый (синхронный) вызов подписчика preact гасится флагом `initial` — так же, как в
  [useSignalSubscription.ts:91-94](packages/reformer/src/form/hooks/useSignalSubscription.ts#L91-L94).
- `model.$ as unknown as ReadonlySignal<T>` — из-за `Omit<ReadonlySignal<T>, keyof T>` в типе
  [ModelGroupSignals](packages/reformer/src/state/types.ts#L138-L149) в generic-компоненте `subscribe` не виден.
- `jsonReplacer` для `File`/`Blob`/`undefined` — иначе они теряются в выводе.

## Verification

1. Смонтировать компонент в примере рядом с формой:
   `<SignalJSONInspector model={model} />`.
2. `cd projects/react-playground && npx tsc --noEmit` — проверка типов generic-компонента.
3. Дев-сервер: ввод в любое поле обновляет JSON посимвольно; `model.reset()` даёт одно обновление,
   а не по одному на поле; вложенные группы и элементы массивов видны целиком.
4. Проверить отсутствие бесконечного цикла: React DevTools Profiler — на один ввод один коммит.
