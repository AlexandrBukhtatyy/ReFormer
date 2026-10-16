/**
 * Корень React-дерева билдера: только оболочка и связь с открытым проектом.
 *
 * Приложение собирается в `./boot`, а здесь — единственная связь между собранным приложением
 * и оболочкой. Компонент намеренно тривиален: всё, что он мог бы делать (создание сервисов,
 * регистрация плагинов, восстановление состояния), не должно зависеть от жизненного цикла
 * React — иначе `StrictMode` с его двойным монтированием превращает запуск в источник дублей.
 *
 * Единственное, что здесь всё же есть, — подписка на открытый проект. Вкладки принадлежат
 * рабочей области, а она появляется ПОСЛЕ отрисовки (шаг 5 запуска), поэтому `documents`
 * не может быть полем собранного приложения: поле не перерисовало бы оболочку, когда проект
 * наконец открылся.
 *
 * По той же причине здесь стоит и вопрос о расхождении с источником: он принадлежит открытому
 * проекту, а не оболочке, и появляется вместе с ним.
 *
 * Корень один на обе оболочки — вкладку браузера (`shell/standalone`) и страницу чужого
 * приложения (`shell/embedded`): рисуют они одно и то же, различается то, что вокруг.
 *
 * И локаль кита: интерфейс билдера собран из компонентов `@reformer/ui-kit`, а их подписи
 * («Создать «…»» в комбобоксе, «Нет данных») идут из словаря кита через `I18nProvider`. Без него
 * кит говорил бы по-английски внутри русского интерфейса. Язык — тот же, что у оболочки, и
 * меняется вместе с ним. Словарь первого языка грузится до первой отрисовки
 * (`preloadKitUiLocale`): провайдер, которому словарь ещё не пришёл, не рисует ничего.
 *
 * @module shell/boot/BuilderRoot
 */

import { useCallback, useMemo, useSyncExternalStore, type ReactElement } from 'react';
import { createLocaleLoader } from '@reformer/core/i18n';
import { I18nProvider } from '@reformer/core/react';
import { loadKitLocale } from '@reformer/ui-kit/locale';
import { Shell, type ShellHost } from '@/shell/platform/ui/Shell';
import { MergeQuestionHost } from '@/shell/boot/project/MergeQuestionHost';
import { useProjectSession } from '@/shell/boot/project/useProject';
import type { BuilderApp } from './boot';

/** Словари кита по языкам: один загрузчик на модуль — загруженный язык не грузится повторно. */
const loadKitUiLocale = createLocaleLoader([loadKitLocale]);

/**
 * Загрузить словарь кита для языка заранее — чтобы первая отрисовка корня застала его готовым.
 * Отказ не мешает запуску: провайдер повторит загрузку сам, а кит до неё говорит по-английски.
 *
 * @param code - Язык оболочки.
 */
export function preloadKitUiLocale(code: string): Promise<void> {
  return loadKitUiLocale.preload(code).then(
    () => undefined,
    () => undefined
  );
}

/** Язык оболочки, с подпиской на его смену. */
function useShellLocale(i18n: BuilderApp['i18n']): string {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const subscription = i18n.onDidChangeLocale(onChange);
      return () => subscription.dispose();
    },
    [i18n]
  );
  return useSyncExternalStore(
    subscribe,
    () => i18n.locale,
    () => i18n.locale
  );
}

export function BuilderRoot({ app }: { app: BuilderApp }): ReactElement {
  const locale = useShellLocale(app.i18n);
  const session = useProjectSession(app.project);
  // Новый объект только при смене проекта: оболочка держит части `host` в зависимостях
  // хуков, и пересборка на каждый кадр переустанавливала бы диспетчер сочетаний.
  const host = useMemo<ShellHost>(
    () => ({ ...app, documents: session?.documents ?? null }),
    [app, session]
  );
  return (
    <I18nProvider lang={locale} load={loadKitUiLocale}>
      <Shell host={host} />
      {session !== null && <MergeQuestionHost flow={session.merge} i18n={app.i18n} />}
    </I18nProvider>
  );
}
