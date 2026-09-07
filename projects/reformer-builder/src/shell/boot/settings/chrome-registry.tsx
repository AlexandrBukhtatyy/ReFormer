/**
 * Реестр компонентов для формы настроек плагина.
 *
 * ## Почему НЕ реестр активного кита
 *
 * Настройки — это хром билдера, и он обязан выглядеть одинаково, какой бы кит человек ни выбрал
 * для СВОЕЙ формы. Реестр превью (`plugins/preview/runtime/registry`) отвечает на другой вопрос —
 * «как эта форма будет выглядеть у клиента», — и потому требует каталог кита (сотни килобайт),
 * его дескриптор и лениво грузимое пространство имён, а до их загрузки честно отдаёт форму
 * без кита. Для окна настроек это и лишняя цена, и неверный ответ.
 *
 * ## Словарь закрыт, и это часть контракта
 *
 * Девять имён ниже — то, из чего плагин вправе собрать свою форму настроек. Список закрыт
 * намеренно: он же граница безопасности. Схема приходит из кода в проекте пользователя, пропсы
 * компонентам не санитайзятся, и «рисуем всё, что назвали» означало бы произвольный компонент
 * оболочки под управлением чужой схемы.
 *
 * Имя, которого в словаре нет, не роняет форму и не пропадает молча: на его месте появляется
 * заметная заглушка с именем — иначе автор плагина искал бы причину в своей схеме.
 *
 * @module shell/boot/settings/chrome-registry
 */

import type { ComponentType, ReactElement } from 'react';
import {
  defineRegistry,
  FIELD_WRAPPER,
  type ComponentRegistry,
  type JsonFormSchema,
} from '@reformer/renderer-json';
import { Box } from '@reformer/ui-kit/box';
import { CheckboxField } from '@reformer/ui-kit/checkbox';
import { FormField } from '@reformer/ui-kit/form-field';
import { InputField } from '@reformer/ui-kit/input';
import { RadioGroupField } from '@reformer/ui-kit/radio-group';
import { Section } from '@reformer/ui-kit/section';
import { SelectField } from '@reformer/ui-kit/select';
import { SwitchField } from '@reformer/ui-kit/switch';
import { TextareaField } from '@reformer/ui-kit/textarea';
import { collectOperatorNames } from '@/lib/form-model/query';

/**
 * Что плагин вправе назвать в `$component(...)`.
 *
 * Имена — те же, что в каталоге `@reformer/ui-kit`: автор плагина пишет схему так же, как
 * писал бы форму в билдере, и не учит второй диалект.
 */
export const CHROME_COMPONENTS: Readonly<Record<string, ComponentType<never>>> = Object.freeze({
  Input: InputField,
  Textarea: TextareaField,
  Checkbox: CheckboxField,
  Switch: SwitchField,
  Select: SelectField,
  RadioGroup: RadioGroupField,
  Box,
  Section,
  FormField,
} as Record<string, ComponentType<never>>);

/** Имена, доступные схеме настроек. Экспортируется для документации и проверок. */
export const CHROME_COMPONENT_NAMES: readonly string[] = Object.freeze(
  Object.keys(CHROME_COMPONENTS).sort()
);

/** Заглушка вместо компонента, которого в словаре нет: видна и называет причину. */
function makeUnknown(name: string): ComponentType<Record<string, unknown>> {
  return function UnknownChrome(): ReactElement {
    return (
      <span className="text-destructive text-[13px]" data-testid={`chrome-unknown-${name}`}>
        {`«${name}» недоступен в настройках плагина`}
      </span>
    );
  };
}

/**
 * Собирает реестр под конкретную схему.
 *
 * Источники, функции и локаль объявляются заглушками по тому, что схема НАЗЫВАЕТ: конвертер
 * бросает на неизвестном имени, и форма настроек падала бы целиком из-за одного `$dataSource`,
 * который автор плагина не собирался наполнять из билдера.
 */
export function buildChromeRegistry(schema: JsonFormSchema): ComponentRegistry {
  const used = collectOperatorNames(schema);

  return defineRegistry((builder) => {
    for (const [name, component] of Object.entries(CHROME_COMPONENTS)) {
      builder.component(name, component as ComponentType<Record<string, unknown>>);
    }
    // Враппер поля адресуется рендерером служебным именем, а не каталожным. Без него поля
    // рисуются голыми — без подписи, подсказки и ошибки, — и притом молча.
    builder.component(
      FIELD_WRAPPER,
      // Через `unknown`: у враппера собственные обязательные пропсы, и рендерер подставляет
      // их сам — реестр же типизован «компонентом с любыми пропсами».
      FormField as unknown as ComponentType<Record<string, unknown>>
    );

    for (const name of used.components) {
      if (name in CHROME_COMPONENTS) continue;
      builder.component(name, makeUnknown(name));
    }
    for (const name of used.dataSources) builder.dataSource(name, []);
    for (const name of used.fns) builder.fn(name, () => '');
    if (used.locales.length > 0) builder.locale((key: string) => key);
  });
}
