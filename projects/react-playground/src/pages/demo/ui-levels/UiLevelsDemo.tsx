/**
 * Демо «Уровни UI над одной моделью» — тема, язык и таблицы ReFormer.
 *
 * - Форма настроек — обычная форма над `app.model.settings`: выбор темы и языка пишет поля модели,
 *   а уровни темы и языка читают те же сигналы (класс `dark` и `lang` на `<html>`, словари кита).
 * - Клиентская таблица — над массивом `app.model.users`; форма выбранной строки пишет под-модель,
 *   таблица пересортировывается сама. Коллация сортировки — язык уровня языка.
 * - Серверная таблица — грид рисует таблицу из стора (`<DataGrid table={…}>`), провайдер отвечает
 *   через 700 мс, журнал показывает отменённые запросы; смена языка перезапрашивает страницу.
 */

import { useState, type ReactNode } from 'react';
import { createForm, type FormModel } from '@reformer/core';
import { modelOf } from '@reformer/core/model';
import { I18nProvider, useFormBundle, useI18n, useSignalSnapshot } from '@reformer/core/react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  FormField,
  Input,
  RadioGroupOptions,
} from '@reformer/ui-kit';
import { DataGrid, type TableColumn } from '@reformer/ui-kit/table';
import { getDemoApp, type DemoApp, type Order, type Settings, type User } from './ui-levels-store';

export default function UiLevelsDemo() {
  const [app] = useState(getDemoApp);
  return (
    // Вложенный провайдер над уровнем языка: язык меняют полем модели, а не пропом.
    <I18nProvider language={app.language}>
      <Content app={app} />
    </I18nProvider>
  );
}

function Content({ app }: { app: DemoApp }) {
  const { t } = useI18n();
  return (
    <div className="space-y-6 p-4" data-testid="ui-levels-demo">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{t('demo.title', undefined, 'UI levels')}</h1>
        <p className="text-muted-foreground">{t('demo.intro', undefined, '')}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title={t('demo.settings', undefined, 'Settings')}>
          <SettingsForm app={app} />
        </Section>
        <Section title={t('demo.state', undefined, 'State')}>
          <LevelState app={app} />
        </Section>
      </div>

      <Section title={t('demo.client', undefined, 'Client table')}>
        <ClientTable app={app} />
      </Section>

      <Section title={t('demo.server', undefined, 'Server table')}>
        <ServerTable app={app} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// ── Форма настроек: обычная форма над частью модели приложения ─────────────────────────────

function settingsSchema(model: FormModel<Settings>) {
  return {
    children: [
      {
        model: model.$.theme,
        component: RadioGroupOptions,
        componentProps: {
          label: 'Тема / Theme',
          testId: 'settings-theme',
          options: [
            { value: 'light', label: 'Светлая / Light' },
            { value: 'dark', label: 'Тёмная / Dark' },
            { value: 'system', label: 'Как в системе / System' },
          ],
        },
      },
      {
        model: model.$.lang,
        component: RadioGroupOptions,
        componentProps: {
          label: 'Язык / Language',
          testId: 'settings-lang',
          options: [
            { value: 'ru', label: 'Русский' },
            { value: 'en', label: 'English' },
          ],
        },
      },
    ],
  };
}

function SettingsForm({ app }: { app: DemoApp }) {
  const { form } = useFormBundle(() =>
    createForm<Settings>({ model: app.model.settings, schema: settingsSchema })
  );
  return (
    <div className="space-y-4">
      <FormField control={form.theme} />
      <FormField control={form.lang} />
    </div>
  );
}

// ── Состояние уровней: сигналы только для чтения и команды ─────────────────────────────────

function LevelState({ app }: { app: DemoApp }) {
  const settings = useSignalSnapshot(app.model.$.settings);
  const preference = useSignalSnapshot(app.theme.preference);
  const system = useSignalSnapshot(app.theme.system);
  const resolved = useSignalSnapshot(app.theme.resolved);
  const lang = useSignalSnapshot(app.language.lang);
  const code = useSignalSnapshot(app.language.code);
  const pending = useSignalSnapshot(app.language.pending);
  const dir = useSignalSnapshot(app.language.dir);
  const rows: [string, string][] = [
    ['app.model.settings', JSON.stringify(settings)],
    ['theme.preference', preference],
    ['theme.system', system],
    ['theme.resolved', resolved],
    ['language.lang', lang],
    ['language.code', code],
    ['language.pending', String(pending)],
    ['language.dir', dir],
  ];
  return (
    <div className="space-y-3">
      <table className="w-full text-sm" data-testid="level-state">
        <tbody>
          {rows.map(([name, value]) => (
            <tr key={name} className="border-b last:border-0">
              <td className="py-1 pr-4 font-mono text-muted-foreground">{name}</td>
              <td className="py-1 font-mono">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => app.theme.toggle()}>
          theme.toggle()
        </Button>
        <Button
          variant="outline"
          onClick={() => void app.language.set(code === 'ru' ? 'en' : 'ru')}
        >
          language.set('{code === 'ru' ? 'en' : 'ru'}')
        </Button>
      </div>
    </div>
  );
}

// ── Клиентская таблица над массивом модели и форма выбранной строки ────────────────────────

function ClientTable({ app }: { app: DemoApp }) {
  const { t } = useI18n();
  const selected = useSignalSnapshot(app.users.selection.keys);
  const columns: TableColumn<User>[] = [
    { id: 'name', header: t('demo.col.name', undefined, 'Name'), accessor: (u) => u.name },
    { id: 'city', header: t('demo.col.city', undefined, 'City'), accessor: (u) => u.city },
    {
      id: 'age',
      header: t('demo.col.age', undefined, 'Age'),
      accessor: (u) => u.age,
      align: 'right',
    },
  ];
  const key = [...selected][0];
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('demo.client.hint', undefined, '')}</p>
      <DataGrid table={app.users} columns={columns} />
      <Button variant="outline" onClick={() => app.addUser()}>
        {t('demo.add', undefined, 'Add user')}
      </Button>
      <div className="rounded-md border p-4">
        <h3 className="mb-3 font-medium">{t('demo.editor', undefined, 'Row form')}</h3>
        {key === undefined ? (
          <p className="text-sm text-muted-foreground">
            {t('demo.editor.empty', undefined, 'Select a row')}
          </p>
        ) : (
          <RowEditor key={key} app={app} id={Number(key)} />
        )}
      </div>
    </div>
  );
}

function rowSchema(model: FormModel<User>) {
  return {
    children: [
      {
        model: model.$.name,
        component: Input,
        componentProps: { label: 'Имя / Name', testId: 'row-name' },
      },
      {
        model: model.$.city,
        component: Input,
        componentProps: { label: 'Город / City', testId: 'row-city' },
      },
    ],
  };
}

function RowEditor({ app, id }: { app: DemoApp; id: number }) {
  // Под-модель строки — тот же узел, который читает таблица: правка формы сразу пересортирует её.
  const users = modelOf(app.model.$.users);
  const index = users.toArray().findIndex((u) => u.id === id);
  const row = users.at(index) as FormModel<User>;
  const { form } = useFormBundle(() => createForm<User>({ model: row, schema: rowSchema }));
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField control={form.name} />
      <FormField control={form.city} />
    </div>
  );
}

// ── Серверная таблица: отмена устаревших запросов и правило между уровнями ─────────────────

function ServerTable({ app }: { app: DemoApp }) {
  const { t, number } = useI18n();
  const log = useSignalSnapshot(app.log);
  const selected = useSignalSnapshot(app.orders.selection.keys);
  const columns: TableColumn<Order>[] = [
    { id: 'id', header: t('demo.col.id', undefined, 'Number'), accessor: (o) => o.id },
    {
      id: 'customer',
      header: t('demo.col.customer', undefined, 'Customer'),
      accessor: (o) => o.customer,
    },
    {
      id: 'total',
      header: t('demo.col.total', undefined, 'Total'),
      accessor: (o) => number(o.total, { style: 'currency', currency: 'RUB' }),
      align: 'right',
    },
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{t('demo.server.hint', undefined, '')}</p>
        <DataGrid table={app.orders} columns={columns} />
        <p className="text-sm">
          {t('demo.selected', { count: selected.size }, `Selected: ${selected.size}`)}
        </p>
      </div>
      <div>
        <h3 className="mb-2 font-medium">{t('demo.log', undefined, 'Request log')}</h3>
        <ol className="space-y-1 font-mono text-xs" data-testid="request-log">
          {log.map((entry) => (
            <li
              key={entry.n}
              className={
                entry.state === 'aborted'
                  ? 'text-muted-foreground line-through'
                  : entry.state === 'pending'
                    ? 'text-amber-600'
                    : ''
              }
            >
              #{entry.n} {entry.state} — {entry.query}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
