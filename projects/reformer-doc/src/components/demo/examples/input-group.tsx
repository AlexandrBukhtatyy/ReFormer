import { useState } from 'react';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
} from '@reformer/ui-kit';
import { SearchIcon, EyeIcon, EyeOffIcon, XIcon, InfoIcon } from 'lucide-react';
import type { ComponentDocConfig } from '../types';

/**
 * InputGroup — не form-control: презентационная композиция контрола (input/textarea) с аддонами.
 * Compound-набор: InputGroup / InputGroupAddon / InputGroupButton / InputGroupText /
 * InputGroupInput / InputGroupTextarea. Таб Variants показывает типы аддонов (иконка / текст /
 * кнопка), Examples — рецепты (поиск, пароль, textarea с футером), props — таблица.
 */
export const inputGroupDocConfig: ComponentDocConfig = {
  name: 'InputGroup',
  importFrom: '@reformer/ui-kit',
  description:
    'Обёртка контрола с аддонами на shadcn. Compound-набор: InputGroup + InputGroupAddon (иконки/кнопки/текст по краям) + InputGroupInput / InputGroupTextarea. Выравнивание аддона — через align, единый фокус-ринг и состояние ошибки — на всей группе.',
  variants: [
    {
      id: 'icon-addon',
      title: 'Иконка-аддон',
      description:
        'InputGroupAddon с иконкой. align="inline-start" ставит аддон слева, "inline-end" — справа.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 360 }}>
          <InputGroup>
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput placeholder="Поиск..." />
          </InputGroup>
        </div>
      ),
      code: `import { SearchIcon } from 'lucide-react';

<InputGroup>
  <InputGroupAddon>
    <SearchIcon />
  </InputGroupAddon>
  <InputGroupInput placeholder="Поиск..." />
</InputGroup>`,
    },
    {
      id: 'text-addon',
      title: 'Текстовый префикс / суффикс',
      description:
        'InputGroupText внутри аддона — статичный текст по краю поля (протокол, домен, единицы).',
      render: () => (
        <div style={{ width: '100%', maxWidth: 360 }}>
          <InputGroup>
            <InputGroupAddon>
              <InputGroupText>https://</InputGroupText>
            </InputGroupAddon>
            <InputGroupInput placeholder="example" />
            <InputGroupAddon align="inline-end">
              <InputGroupText>.com</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
        </div>
      ),
      code: `<InputGroup>
  <InputGroupAddon>
    <InputGroupText>https://</InputGroupText>
  </InputGroupAddon>
  <InputGroupInput placeholder="example" />
  <InputGroupAddon align="inline-end">
    <InputGroupText>.com</InputGroupText>
  </InputGroupAddon>
</InputGroup>`,
    },
    {
      id: 'button-addon',
      title: 'Кнопка-аддон',
      description:
        'InputGroupButton — кнопка внутри аддона (по умолчанию variant="ghost", size="xs"). Клик по кнопке не фокусирует поле.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 360 }}>
          <InputGroup>
            <InputGroupInput placeholder="Промокод" />
            <InputGroupAddon align="inline-end">
              <InputGroupButton size="sm" variant="outline">
                Применить
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </div>
      ),
      code: `<InputGroup>
  <InputGroupInput placeholder="Промокод" />
  <InputGroupAddon align="inline-end">
    <InputGroupButton size="sm" variant="outline">
      Применить
    </InputGroupButton>
  </InputGroupAddon>
</InputGroup>`,
    },
  ],
  examples: [
    {
      id: 'search-clear',
      title: 'Поиск: иконка слева + кнопка очистки справа',
      description:
        'Комбинация двух аддонов: неинтерактивная иконка (inline-start) и icon-кнопка сброса (inline-end).',
      render: () => {
        // eslint-disable-next-line react-hooks/rules-of-hooks -- VariantGallery рендерит render как <Render/> (компонент), useState безопасен
        const [value, setValue] = useState('reformer');
        return (
          <div style={{ width: '100%', maxWidth: 360 }}>
            <InputGroup>
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Поиск по каталогу"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
              {value && (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    aria-label="Очистить"
                    onClick={() => setValue('')}
                  >
                    <XIcon />
                  </InputGroupButton>
                </InputGroupAddon>
              )}
            </InputGroup>
          </div>
        );
      },
      code: `import { SearchIcon, XIcon } from 'lucide-react';

const [value, setValue] = useState('');

<InputGroup>
  <InputGroupAddon>
    <SearchIcon />
  </InputGroupAddon>
  <InputGroupInput
    placeholder="Поиск по каталогу"
    value={value}
    onChange={(e) => setValue(e.target.value)}
  />
  {value && (
    <InputGroupAddon align="inline-end">
      <InputGroupButton size="icon-xs" aria-label="Очистить" onClick={() => setValue('')}>
        <XIcon />
      </InputGroupButton>
    </InputGroupAddon>
  )}
</InputGroup>`,
    },
    {
      id: 'password-toggle',
      title: 'Пароль с переключателем видимости',
      description: 'Кнопка-аддон переключает type поля между "password" и "text".',
      render: () => {
        // eslint-disable-next-line react-hooks/rules-of-hooks -- VariantGallery рендерит render как <Render/> (компонент), useState безопасен
        const [visible, setVisible] = useState(false);
        return (
          <div style={{ width: '100%', maxWidth: 360 }}>
            <InputGroup>
              <InputGroupInput
                type={visible ? 'text' : 'password'}
                placeholder="Пароль"
                defaultValue="secret42"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-xs"
                  aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'}
                  onClick={() => setVisible((v) => !v)}
                >
                  {visible ? <EyeOffIcon /> : <EyeIcon />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </div>
        );
      },
      code: `import { EyeIcon, EyeOffIcon } from 'lucide-react';

const [visible, setVisible] = useState(false);

<InputGroup>
  <InputGroupInput type={visible ? 'text' : 'password'} placeholder="Пароль" />
  <InputGroupAddon align="inline-end">
    <InputGroupButton
      size="icon-xs"
      aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'}
      onClick={() => setVisible((v) => !v)}
    >
      {visible ? <EyeOffIcon /> : <EyeIcon />}
    </InputGroupButton>
  </InputGroupAddon>
</InputGroup>`,
    },
    {
      id: 'textarea-footer',
      title: 'Textarea с нижним аддоном (block-end)',
      description:
        'align="block-start" / "block-end" переводят группу в колонку — аддон рендерится над/под многострочным полем.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 360 }}>
          <InputGroup>
            <InputGroupTextarea placeholder="Опишите проблему..." rows={3} />
            <InputGroupAddon align="block-end">
              <InputGroupText>
                <InfoIcon /> Markdown поддерживается
              </InputGroupText>
              <InputGroupButton size="sm" variant="default" style={{ marginLeft: 'auto' }}>
                Отправить
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </div>
      ),
      code: `import { InfoIcon } from 'lucide-react';

<InputGroup>
  <InputGroupTextarea placeholder="Опишите проблему..." rows={3} />
  <InputGroupAddon align="block-end">
    <InputGroupText>
      <InfoIcon /> Markdown поддерживается
    </InputGroupText>
    <InputGroupButton size="sm" variant="default" style={{ marginLeft: 'auto' }}>
      Отправить
    </InputGroupButton>
  </InputGroupAddon>
</InputGroup>`,
    },
  ],
  props: [
    {
      name: 'InputGroupAddon · align',
      type: "'inline-start' | 'inline-end' | 'block-start' | 'block-end'",
      default: 'inline-start',
      description:
        'Расположение аддона. inline-* — по горизонтальным краям; block-* переводят группу в колонку (для textarea).',
    },
    {
      name: 'InputGroupButton · size',
      type: "'xs' | 'sm' | 'icon-xs' | 'icon-sm'",
      default: 'xs',
      description: 'Размер кнопки-аддона (icon-* — квадратные под одну иконку).',
    },
    {
      name: 'InputGroupButton · variant',
      type: "'ghost' | 'default' | 'secondary' | 'outline' | 'destructive' | 'link'",
      default: 'ghost',
      description: 'Вариант стиля кнопки (проброс в Button).',
    },
    {
      name: 'InputGroupInput / InputGroupTextarea',
      type: "React.ComponentProps<'input' | 'textarea'>",
      description:
        'Контрол группы. Проставляет data-slot="input-group-control" (единый фокус-ринг и состояние ошибки на группе). Принимает все нативные props (value, onChange, placeholder, aria-invalid, ...).',
    },
    {
      name: 'InputGroupText',
      type: "React.ComponentProps<'span'>",
      description: 'Статичный текст-аддон (префикс/суффикс, подпись).',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Доп. классы (tailwind-merge — класс вызывающего перекрывает). Есть у всех под-компонентов.',
    },
  ],
};
