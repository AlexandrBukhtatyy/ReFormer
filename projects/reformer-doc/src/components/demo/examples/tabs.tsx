import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Tabs — не поле формы: compound поверх Radix Tabs (Tabs / TabsList / TabsTrigger / TabsContent).
 * Variants — стиль списка и ориентация, Examples — типовые сценарии, API — таблица props.
 * Обёртка `<div style>` в render — рамка демо, в `code` её нет.
 */

function ControlledTabs() {
  const [view, setView] = useState('list');
  return (
    <div style={{ width: '100%', maxWidth: 420 }}>
      <Tabs value={view} onValueChange={setView}>
        <TabsList>
          <TabsTrigger value="list">Список</TabsTrigger>
          <TabsTrigger value="grid">Плитка</TabsTrigger>
        </TabsList>
        <TabsContent value="list">Отображение списком.</TabsContent>
        <TabsContent value="grid">Отображение плиткой.</TabsContent>
      </Tabs>
      <p className="text-sm text-muted-foreground">Выбрано: {view}</p>
    </div>
  );
}

export const tabsDocConfig: ComponentDocConfig = {
  name: 'Tabs',
  importFrom: '@reformer/ui-kit',
  description:
    'Вкладки: ряд заголовков и одна видимая панель под ними. Активная вкладка — defaultValue или value + onValueChange.',
  variants: [
    {
      id: 'default',
      title: 'Вкладки с заливкой (variant="default")',
      description:
        'Список на сером фоне, активная вкладка выделена светлой плашкой. defaultValue задаёт вкладку при первом рендере.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 420 }}>
          <Tabs defaultValue="account">
            <TabsList>
              <TabsTrigger value="account">Аккаунт</TabsTrigger>
              <TabsTrigger value="password">Пароль</TabsTrigger>
            </TabsList>
            <TabsContent value="account">Настройки аккаунта.</TabsContent>
            <TabsContent value="password">Смена пароля.</TabsContent>
          </Tabs>
        </div>
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
        'variant="line" у TabsList — без заливки, активная вкладка отмечена линией снизу.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 420 }}>
          <Tabs defaultValue="overview">
            <TabsList variant="line">
              <TabsTrigger value="overview">Обзор</TabsTrigger>
              <TabsTrigger value="activity">Активность</TabsTrigger>
              <TabsTrigger value="settings">Настройки</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">Сводка по проекту.</TabsContent>
            <TabsContent value="activity">Лента событий.</TabsContent>
            <TabsContent value="settings">Параметры проекта.</TabsContent>
          </Tabs>
        </div>
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
      title: 'Вертикальный список (orientation="vertical")',
      description:
        'orientation="vertical" — список вкладок стоит слева от панели, переключение стрелками ↑/↓.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 480 }}>
          <Tabs defaultValue="general" orientation="vertical">
            <TabsList>
              <TabsTrigger value="general">Общие</TabsTrigger>
              <TabsTrigger value="security">Безопасность</TabsTrigger>
              <TabsTrigger value="billing">Оплата</TabsTrigger>
            </TabsList>
            <TabsContent value="general">Общие настройки.</TabsContent>
            <TabsContent value="security">Пароль и двухфакторная защита.</TabsContent>
            <TabsContent value="billing">Способы оплаты и счета.</TabsContent>
          </Tabs>
        </div>
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
    {
      id: 'disabled-trigger',
      title: 'Недоступная вкладка',
      description: 'disabled у TabsTrigger — вкладку нельзя открыть, стрелки её пропускают.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 420 }}>
          <Tabs defaultValue="draft">
            <TabsList>
              <TabsTrigger value="draft">Черновик</TabsTrigger>
              <TabsTrigger value="review">Проверка</TabsTrigger>
              <TabsTrigger value="published" disabled>
                Опубликовано
              </TabsTrigger>
            </TabsList>
            <TabsContent value="draft">Документ можно править.</TabsContent>
            <TabsContent value="review">Документ ждёт проверки.</TabsContent>
            <TabsContent value="published">Документ опубликован.</TabsContent>
          </Tabs>
        </div>
      ),
      code: `<Tabs defaultValue="draft">
  <TabsList>
    <TabsTrigger value="draft">Черновик</TabsTrigger>
    <TabsTrigger value="review">Проверка</TabsTrigger>
    <TabsTrigger value="published" disabled>
      Опубликовано
    </TabsTrigger>
  </TabsList>
  <TabsContent value="draft">Документ можно править.</TabsContent>
  <TabsContent value="review">Документ ждёт проверки.</TabsContent>
  <TabsContent value="published">Документ опубликован.</TabsContent>
</Tabs>`,
    },
  ],
  examples: [
    {
      id: 'settings-panel',
      title: 'Панель настроек',
      description:
        'Типовой сценарий: разделы настроек на одном экране, у каждой вкладки своя панель.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 480 }}>
          <Tabs defaultValue="profile">
            <TabsList>
              <TabsTrigger value="profile">Профиль</TabsTrigger>
              <TabsTrigger value="notifications">Уведомления</TabsTrigger>
              <TabsTrigger value="advanced">Расширенные</TabsTrigger>
            </TabsList>
            <TabsContent value="profile">Имя, аватар и контактные данные.</TabsContent>
            <TabsContent value="notifications">Настройка email- и push-уведомлений.</TabsContent>
            <TabsContent value="advanced">Экспорт данных и удаление аккаунта.</TabsContent>
          </Tabs>
        </div>
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
      title: 'Управляемая вкладка (value + onValueChange)',
      description:
        'Активную вкладку хранит ваше состояние — например, чтобы синхронизировать её с адресом страницы.',
      render: ControlledTabs,
      code: `const [view, setView] = useState('list');

<Tabs value={view} onValueChange={setView}>
  <TabsList>
    <TabsTrigger value="list">Список</TabsTrigger>
    <TabsTrigger value="grid">Плитка</TabsTrigger>
  </TabsList>
  <TabsContent value="list">Отображение списком.</TabsContent>
  <TabsContent value="grid">Отображение плиткой.</TabsContent>
</Tabs>
<p className="text-sm text-muted-foreground">Выбрано: {view}</p>`,
    },
  ],
  props: [
    {
      name: 'defaultValue',
      type: 'string',
      description: 'Вкладка, открытая при первом рендере, если состоянием управляет сам компонент.',
    },
    {
      name: 'value',
      type: 'string',
      description:
        'Открытая вкладка, когда состоянием управляете вы. Используется с onValueChange.',
    },
    {
      name: 'onValueChange',
      type: '(value: string) => void',
      description: 'Вызывается при смене вкладки.',
    },
    {
      name: 'orientation',
      type: "'horizontal' | 'vertical'",
      default: "'horizontal'",
      description:
        'horizontal — список над панелью, стрелки ←/→. vertical — список слева, стрелки ↑/↓.',
    },
    {
      name: 'activationMode',
      type: "'automatic' | 'manual'",
      default: "'automatic'",
      description:
        'automatic — вкладка открывается, как только на неё пришёл фокус. manual — только по Enter, пробелу или щелчку.',
    },
    {
      name: 'dir',
      type: "'ltr' | 'rtl'",
      description:
        'Направление текста: при rtl стрелки ←/→ меняются местами. По умолчанию берётся из DirectionProvider.',
    },
    {
      name: 'TabsList.variant',
      type: "'default' | 'line'",
      default: "'default'",
      description: 'Вид списка: с заливкой или с линией под активной вкладкой.',
    },
    {
      name: 'TabsList.loop',
      type: 'boolean',
      default: 'true',
      description: 'Переходить стрелками с последней вкладки на первую и обратно.',
    },
    {
      name: 'TabsTrigger.value',
      type: 'string',
      description: 'Обязательный. Идентификатор вкладки; связывает заголовок с панелью.',
    },
    {
      name: 'TabsTrigger.disabled',
      type: 'boolean',
      default: 'false',
      description: 'Вкладку нельзя открыть, стрелки её пропускают.',
    },
    {
      name: 'TabsContent.value',
      type: 'string',
      description: 'Обязательный. Тот же идентификатор, что у заголовка вкладки.',
    },
    {
      name: 'TabsContent.forceMount',
      type: 'true',
      description:
        'Всегда держать панель в DOM. Без него неактивная панель удаляется; с ним — остаётся видимой, скрывайте её своим классом (data-[state=inactive]:hidden).',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Дополнительные классы любой части. Сливаются через tailwind-merge: ваш класс побеждает встроенный.',
    },
  ],
};
