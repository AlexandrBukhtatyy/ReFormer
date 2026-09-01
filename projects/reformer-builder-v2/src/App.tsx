/**
 * Корень React-дерева: только оболочка и связь с открытым проектом.
 *
 * Приложение собирается в `app/boot`, а здесь — единственная связь между собранным
 * приложением и оболочкой. Компонент намеренно тривиален: всё, что он мог бы делать
 * (создание сервисов, регистрация плагинов, восстановление состояния), не должно зависеть
 * от жизненного цикла React — иначе `StrictMode` с его двойным монтированием превращает
 * запуск в источник дублей.
 *
 * Единственное, что здесь всё же есть, — подписка на открытый проект. Вкладки принадлежат
 * рабочей области, а она появляется ПОСЛЕ отрисовки (шаг 5 запуска), поэтому `documents`
 * не может быть полем собранного приложения: поле не перерисовало бы оболочку, когда проект
 * наконец открылся.
 *
 * @module App
 */

import { useMemo, type ReactElement } from 'react';
import { Shell, type ShellHost } from './shell/platform/ui/Shell';
import { useProjectSession } from './shell/boot/project/useProject';
import type { BuilderApp } from './shell/boot/boot';

export default function App({ app }: { app: BuilderApp }): ReactElement {
  const session = useProjectSession(app.project);
  // Новый объект только при смене проекта: оболочка держит части `host` в зависимостях
  // хуков, и пересборка на каждый кадр переустанавливала бы диспетчер сочетаний.
  const host = useMemo<ShellHost>(
    () => ({ ...app, documents: session?.documents ?? null }),
    [app, session]
  );
  return <Shell host={host} />;
}
