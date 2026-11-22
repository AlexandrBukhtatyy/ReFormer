/**
 * Compile-time тест типизации уровней UI [ReFormer-cn5g]. Проверяется `tsc`; vitest его не
 * запускает.
 *
 * - `table.columns` типизирован id колонок из конфига, без явных generic-ов; чужой id — ошибка.
 * - Тип строки выводится из массива модели и из провайдера.
 * - Тема и язык привязываются к полям модели приложения (`model.$.settings.theme`) напрямую.
 */

import { expectTypeOf } from 'vitest';
import { createModel } from '../../src/model/create-model';
import { arrayOf } from '../../src/model/model-nodes';
import type { Model } from '../../src/model/types';
import { defineBehavior } from '../../src/model/behavior';
import { createTheme } from '../../src/theme/create-theme';
import type { ThemePreference } from '../../src/theme/adapters';
import { createLanguage } from '../../src/language/create-language';
import type { LocaleLoad } from '../../src/i18n/locale-store';
import { createTable } from '../../src/table/create-table';
import type { Table, TableColumnFace, TableRow } from '../../src/table/types';

type User = { id: number; name: string; role: 'admin' | 'user' };

export function levelsTypeChecks(load: LocaleLoad): void {
  const model = createModel({
    settings: { theme: 'system' as ThemePreference, lang: 'ru' },
    users: arrayOf((): User => ({ id: 0, name: '', role: 'user' })),
  });

  // Клиентская таблица над массивом модели: Row и id колонок выводятся сами.
  const users = createTable({
    data: model.$.users,
    columns: [
      { id: 'name', sortable: true, value: (u) => u.name },
      { id: 'role', filterable: true },
    ],
    getRowKey: (u) => u.id,
  });
  expectTypeOf(users).toEqualTypeOf<Table<User, 'name' | 'role'>>();
  expectTypeOf(users.columns.name).toEqualTypeOf<TableColumnFace<'name'>>();
  // @ts-expect-error — колонки 'email' в конфиге нет
  void users.columns.email;
  expectTypeOf(users.rows.value[0]!).toEqualTypeOf<TableRow<User>>();
  expectTypeOf(users.rows.value[0]!.model).toEqualTypeOf<Model<User> | undefined>();

  // Серверная таблица: Row — из ответа провайдера.
  const orders = createTable({
    dataProvider: async () => ({ rows: [{ id: 'o1', total: 1 }], total: 1 }),
    columns: [{ id: 'total', sortable: true }],
  });
  expectTypeOf(orders.rows.value[0]!.value).toEqualTypeOf<{ id: string; total: number }>();

  // Тема и язык — над полями модели приложения.
  const theme = createTheme({ preference: model.$.settings.theme });
  expectTypeOf(theme.resolved.value).toEqualTypeOf<'light' | 'dark'>();
  const language = createLanguage({ lang: model.$.settings.lang, load });
  expectTypeOf(language.set).returns.toEqualTypeOf<Promise<void>>();

  // Правило между уровнями — контекст типизирован.
  const rule = defineBehavior<{ table: Table<User, 'name' | 'role'> }>(({ table }) => {
    expectTypeOf(table.columns.role).toEqualTypeOf<TableColumnFace<'role'>>();
  });
  expectTypeOf(rule.attach({ table: users })).toEqualTypeOf<() => void>();
}
