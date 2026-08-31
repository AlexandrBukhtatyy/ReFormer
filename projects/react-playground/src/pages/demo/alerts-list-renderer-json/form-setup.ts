/**
 * Сборка примера «Список алертов из модели».
 *
 * Массив `alerts` — часть модели. `behavior` (реактивность ДАННЫХ) пересобирает его при изменении
 * `amount`/`email`, а JSON-схема рендерит его узлом `{ array: '$model(alerts)', component:
 * '$component(List)', item: { $template } }`: `List` оформляет список, `Alert` на каждый элемент
 * получает `type`/`message` через `$model(...)`. Показ/скрытие алертов = мутация массива в behavior
 * (H1) — список ре-рендерится сам.
 */
import { createModel, type FormModel } from '@reformer/core';
import { defineFormBehavior, onChange } from '@reformer/core/behaviors';
import { createJsonForm, type JsonForm, type JsonFormSchema } from '@reformer/renderer-json';
import type { FormEntry } from '@reformer/form-registry';
import { createAlertsRegistry } from './registry';
import rawJsonSchema from './json-schema.json';

export interface AlertItem {
  type: 'info' | 'warning' | 'error';
  message: string;
}

export interface AlertsFormData {
  amount: string;
  email: string;
  alerts: AlertItem[];
}

export const alertsJsonSchema = rawJsonSchema as unknown as JsonFormSchema<AlertsFormData>;

const INITIAL: AlertsFormData = { amount: '', email: '', alerts: [] };

/** Чистая функция: из текущих значений модели считает набор алертов. */
function computeAlerts(amountRaw: string, emailRaw: string): AlertItem[] {
  const amount = Number.parseFloat(amountRaw) || 0;
  const email = emailRaw ?? '';
  const next: AlertItem[] = [];
  if (amount > 1_000_000) {
    next.push({ type: 'error', message: 'Сумма превышает лимит 1 000 000 ₽' });
  } else if (amount > 0 && amount < 10_000) {
    next.push({ type: 'warning', message: 'Сумма меньше минимальной — 10 000 ₽' });
  }
  if (email.length > 0 && !email.includes('@')) {
    next.push({ type: 'warning', message: 'В email нет символа @' });
  }
  if (next.length === 0) {
    next.push({ type: 'info', message: 'Всё в порядке — можно отправлять заявку' });
  }
  return next;
}

/** Заменяет содержимое массива модели `alerts` — список ре-рендерится реактивно. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyAlerts(model: any): void {
  const snap = model.get() as AlertsFormData;
  const next = computeAlerts(snap.amount ?? '', snap.email ?? '');
  model.alerts.clear();
  next.forEach((a: AlertItem) => model.alerts.push(a));
}

const alertsBehavior = defineFormBehavior<AlertsFormData>(({ model }) => {
  onChange(model.$.amount, () => applyAlerts(model));
  onChange(model.$.email, () => applyAlerts(model));
});

export function createAlertsSetup(): JsonForm<AlertsFormData> {
  // Сборка одним проходом (§7): схема конвертируется внутри createJsonForm, наружу — готовый бандл.
  const jsonForm = createJsonForm<AlertsFormData>({
    schema: alertsJsonSchema,
    registry: createAlertsRegistry(),
    model: createAlertsModel(),
    behavior: alertsBehavior,
  });
  return jsonForm;
}

/**
 * Модель с уже наполненным списком алертов.
 *
 * Наполнение вынесено сюда из пост-обработки готовой формы: `onChange` не срабатывает на
 * инициализации, а список должен быть непустым с первого кадра. Заодно это делает пример
 * пригодным для реестра форм — там форму собирает сам реестр, и вклиниться после `createJsonForm`
 * потребителю негде.
 */
export function createAlertsModel(): FormModel<AlertsFormData> {
  const model = createModel<AlertsFormData>({ ...INITIAL });
  applyAlerts(model);
  return model;
}

/**
 * Запись реестра форм для этого примера.
 *
 * Схема — данные (`inline`, но с тем же успехом могла бы приехать по сети). Реестр компонентов,
 * поведение и фабрика модели — код: их нельзя передать JSON-ом, поэтому они `CodeSource`.
 */
export const alertsFormEntry: FormEntry<AlertsFormData> = {
  id: 'alerts-list',
  version: '1.0.0',
  owner: 'react-playground',
  schema: { kind: 'inline', value: alertsJsonSchema },
  registry: { kind: 'inline', value: createAlertsRegistry() },
  model: { kind: 'inline', value: createAlertsModel },
  behavior: { kind: 'inline', value: alertsBehavior },
  meta: { name: 'Список алертов из модели', tags: ['renderer-json', 'array'] },
};
