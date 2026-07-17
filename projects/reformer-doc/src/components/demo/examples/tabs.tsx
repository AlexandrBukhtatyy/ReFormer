import { Tabs, TabsList, TabsTrigger, TabsContent } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Tabs — не form-control: compound поверх Radix Tabs (Tabs / TabsList / TabsTrigger / TabsContent).
 * Таб Variants показывает стиль списка (default / line) и ориентацию (horizontal / vertical),
 * Examples — рецепт (панель настроек), props — таблица.
 */
export const tabsDocConfig: ComponentDocConfig = {
  name: 'Tabs',
  importFrom: '@reformer/ui-kit',
  description:
    'Вкладки на shadcn / Radix Tabs. Compound-набор: Tabs / TabsList / TabsTrigger / TabsContent. Активная вкладка — через defaultValue (uncontrolled) или value + onValueChange (controlled).',
  variants: [
    {
      id: 'default',
      title: 'Базовые вкладки (variant="default")',
      description:
        'Список с заливкой (bg-muted). Активная вкладка выделяется фоном. defaultValue задаёт стартовую вкладку.',
      render: () => (
        <Tabs defaultValue="account" style={{ width: '100%', maxWidth: 420 }}>
          <TabsList>
            <TabsTrigger value="account">Аккаунт</TabsTrigger>
            <TabsTrigger value="password">Пароль</TabsTrigger>
          </TabsList>
          <TabsContent value="account">Настройки аккаунта.</TabsContent>
          <TabsContent value="password">Смена пароля.</TabsContent>
        </Tabs>
      ),
      code: `<Tabs defaultValue="account">
  <TabsList>
    <TabsTrigger value="account">Аккаунт</TabsTrigger>
    <TabsTrigger value="password">Пароль</TabsTrigger>
  </TabsList>
  <TabsContent value="account">Настройки аккаунта.</TabsContent>
  <TabsContent value="password">Смена пароля.</TabsContent>
</Tabs>`,
    },
    {
      id: 'line',
      title: 'Подчёркнутые вкладки (variant="line")',
      description:
        'variant="line" на TabsList — без заливки, активная вкладка помечается нижней линией.',
      render: () => (
        <Tabs defaultValue="overview" style={{ width: '100%', maxWidth: 420 }}>
          <TabsList variant="line">
            <TabsTrigger value="overview">Обзор</TabsTrigger>
            <TabsTrigger value="activity">Активность</TabsTrigger>
            <TabsTrigger value="settings">Настройки</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">Сводка по проекту.</TabsContent>
          <TabsContent value="activity">Лента событий.</TabsContent>
          <TabsContent value="settings">Параметры проекта.</TabsContent>
        </Tabs>
      ),
      code: `<Tabs defaultValue="overview">
  <TabsList variant="line">
    <TabsTrigger value="overview">Обзор</TabsTrigger>
    <TabsTrigger value="activity">Активность</TabsTrigger>
    <TabsTrigger value="settings">Настройки</TabsTrigger>
  </TabsList>
  <TabsContent value="overview">Сводка по проекту.</TabsContent>
  <TabsContent value="activity">Лента событий.</TabsContent>
  <TabsContent value="settings">Параметры проекта.</TabsContent>
</Tabs>`,
    },
    {
      id: 'vertical',
      title: 'Вертикальная ориентация (orientation="vertical")',
      description: 'orientation="vertical" — список вкладок располагается сбоку от контента.',
      render: () => (
        <Tabs
          defaultValue="general"
          orientation="vertical"
          style={{ width: '100%', maxWidth: 480 }}
        >
          <TabsList>
            <TabsTrigger value="general">Общие</TabsTrigger>
            <TabsTrigger value="security">Безопасность</TabsTrigger>
            <TabsTrigger value="billing">Оплата</TabsTrigger>
          </TabsList>
          <TabsContent value="general">Общие настройки.</TabsContent>
          <TabsContent value="security">Пароль и двухфакторная защита.</TabsContent>
          <TabsContent value="billing">Способы оплаты и счета.</TabsContent>
        </Tabs>
      ),
      code: `<Tabs defaultValue="general" orientation="vertical">
  <TabsList>
    <TabsTrigger value="general">Общие</TabsTrigger>
    <TabsTrigger value="security">Безопасность</TabsTrigger>
    <TabsTrigger value="billing">Оплата</TabsTrigger>
  </TabsList>
  <TabsContent value="general">Общие настройки.</TabsContent>
  <TabsContent value="security">Пароль и двухфакторная защита.</TabsContent>
  <TabsContent value="billing">Способы оплаты и счета.</TabsContent>
</Tabs>`,
    },
  ],
  examples: [
    {
      id: 'settings-panel',
      title: 'Панель настроек',
      description:
        'Типовой сценарий: переключение между разделами настроек. Каждая вкладка держит свой контент.',
      render: () => (
        <Tabs defaultValue="profile" style={{ width: '100%', maxWidth: 480 }}>
          <TabsList>
            <TabsTrigger value="profile">Профиль</TabsTrigger>
            <TabsTrigger value="notifications">Уведомления</TabsTrigger>
            <TabsTrigger value="advanced">Расширенные</TabsTrigger>
          </TabsList>
          <TabsContent value="profile">Имя, аватар и контактные данные.</TabsContent>
          <TabsContent value="notifications">Настройка email- и push-уведомлений.</TabsContent>
          <TabsContent value="advanced">Экспорт данных и удаление аккаунта.</TabsContent>
        </Tabs>
      ),
      code: `<Tabs defaultValue="profile">
  <TabsList>
    <TabsTrigger value="profile">Профиль</TabsTrigger>
    <TabsTrigger value="notifications">Уведомления</TabsTrigger>
    <TabsTrigger value="advanced">Расширенные</TabsTrigger>
  </TabsList>
  <TabsContent value="profile">Имя, аватар и контактные данные.</TabsContent>
  <TabsContent value="notifications">Настройка email- и push-уведомлений.</TabsContent>
  <TabsContent value="advanced">Экспорт данных и удаление аккаунта.</TabsContent>
</Tabs>`,
    },
    {
      id: 'controlled',
      title: 'Controlled-режим (value + onValueChange)',
      description:
        'Активной вкладкой управляет внешнее состояние — value + onValueChange (например, синхронизация с URL).',
      render: () => (
        <Tabs value="list" onValueChange={() => {}} style={{ width: '100%', maxWidth: 420 }}>
          <TabsList>
            <TabsTrigger value="list">Список</TabsTrigger>
            <TabsTrigger value="grid">Плитка</TabsTrigger>
          </TabsList>
          <TabsContent value="list">Отображение списком.</TabsContent>
          <TabsContent value="grid">Отображение плиткой.</TabsContent>
        </Tabs>
      ),
      code: `const [view, setView] = useState('list');

<Tabs value={view} onValueChange={setView}>
  <TabsList>
    <TabsTrigger value="list">Список</TabsTrigger>
    <TabsTrigger value="grid">Плитка</TabsTrigger>
  </TabsList>
  <TabsContent value="list">Отображение списком.</TabsContent>
  <TabsContent value="grid">Отображение плиткой.</TabsContent>
</Tabs>`,
    },
  ],
  props: [
    {
      name: 'defaultValue',
      type: 'string',
      description: 'Изначально активная вкладка (uncontrolled).',
    },
    {
      name: 'value',
      type: 'string',
      description: 'Активная вкладка в controlled-режиме (с onValueChange).',
    },
    {
      name: 'onValueChange',
      type: '(value: string) => void',
      description: 'Колбэк смены активной вкладки (controlled-режим).',
    },
    {
      name: 'orientation',
      type: "'horizontal' | 'vertical'",
      default: 'horizontal',
      description: 'Ориентация вкладок (список сверху или сбоку).',
    },
    {
      name: 'variant (TabsList)',
      type: "'default' | 'line'",
      default: 'default',
      description: 'Стиль списка вкладок: с заливкой ("default") или подчёркиванием ("line").',
    },
    {
      name: 'value (TabsTrigger / TabsContent)',
      type: 'string',
      description:
        'Идентификатор вкладки — связывает триггер с его контентом (обязателен на обоих).',
    },
    {
      name: 'className',
      type: 'string',
      description: 'Доп. классы (tailwind-merge — класс вызывающего перекрывает).',
    },
  ],
};
