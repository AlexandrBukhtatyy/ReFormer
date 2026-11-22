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
 * InputGroup — не поле формы, а раскладка: поле ввода и аддоны (иконки, текст, кнопки) по его
 * краям. Поэтому у страницы таблица props, а не вкладка API с формой.
 */

const BOX = { width: '100%', maxWidth: 360 } as const;

function SearchClearExample() {
  const [value, setValue] = useState('reformer');
  return (
    <div style={BOX}>
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
      </InputGroup>
    </div>
  );
}

function PasswordToggleExample() {
  const [visible, setVisible] = useState(false);
  return (
    <div style={BOX}>
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
}

export const inputGroupDocConfig: ComponentDocConfig = {
  name: 'InputGroup',
  importFrom: '@reformer/ui-kit',
  description:
    'Поле ввода с аддонами по краям: иконкой, текстом или кнопкой. Рамка, фокус и ошибка — общие на всю группу.',
  variants: [
    {
      id: 'icon-addon',
      title: 'Иконка',
      description:
        'InputGroupAddon с иконкой. По умолчанию аддон слева (align="inline-start"), "inline-end" ставит его справа.',
      render: () => (
        <div style={BOX}>
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
      title: 'Текст до и после',
      description: 'InputGroupText — неизменяемый текст у края поля: протокол, домен, единицы.',
      render: () => (
        <div style={BOX}>
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
      title: 'Кнопка',
      description:
        'InputGroupButton — кнопка внутри аддона. По умолчанию variant="ghost", size="xs", type="button".',
      render: () => (
        <div style={BOX}>
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
      title: 'Поиск с кнопкой очистки',
      description:
        'Два аддона: иконка слева и кнопка-иконка справа. У кнопки без текста обязателен aria-label.',
      render: SearchClearExample,
      code: `import { useState } from 'react';
import { SearchIcon, XIcon } from 'lucide-react';

const [value, setValue] = useState('reformer');

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
      title: 'Своя кнопка «показать пароль»',
      description:
        'Кнопка переключает type между "password" и "text". Для поля формы есть готовый InputPassword.',
      render: PasswordToggleExample,
      code: `import { useState } from 'react';
import { EyeIcon, EyeOffIcon } from 'lucide-react';

const [visible, setVisible] = useState(false);

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
</InputGroup>`,
    },
    {
      id: 'textarea-footer',
      title: 'Textarea с панелью снизу',
      description:
        'align="block-end" (или "block-start") ставит группу в колонку: аддон занимает строку под полем (или над ним).',
      render: () => (
        <div style={BOX}>
          <InputGroup>
            <InputGroupTextarea placeholder="Опишите проблему..." rows={3} />
            <InputGroupAddon align="block-end">
              <InputGroupText>
                <InfoIcon /> Поддерживается Markdown
              </InputGroupText>
              <InputGroupButton size="sm" variant="default" className="ml-auto">
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
      <InfoIcon /> Поддерживается Markdown
    </InputGroupText>
    <InputGroupButton size="sm" variant="default" className="ml-auto">
      Отправить
    </InputGroupButton>
  </InputGroupAddon>
</InputGroup>`,
    },
    {
      id: 'invalid',
      title: 'Состояние ошибки',
      description:
        'aria-invalid на InputGroupInput красит рамку всей группы. Текст ошибки выводите сами рядом с группой.',
      render: () => (
        <div style={BOX}>
          <InputGroup>
            <InputGroupInput placeholder="example" aria-invalid defaultValue="my site" />
            <InputGroupAddon align="inline-end">
              <InputGroupText>.ru</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
        </div>
      ),
      code: `<InputGroup>
  <InputGroupInput placeholder="example" aria-invalid defaultValue="my site" />
  <InputGroupAddon align="inline-end">
    <InputGroupText>.ru</InputGroupText>
  </InputGroupAddon>
</InputGroup>`,
    },
  ],
  props: [
    {
      name: 'InputGroup',
      type: "React.ComponentProps<'div'>",
      description:
        'Контейнер с role="group": рисует общую рамку, кольцо фокуса и красную рамку при aria-invalid у поля. Для приглушённых аддонов выключенной группы поставьте data-disabled="true".',
    },
    {
      name: 'InputGroupAddon · align',
      type: "'inline-start' | 'inline-end' | 'block-start' | 'block-end'",
      default: "'inline-start'",
      description:
        'Где стоит аддон. inline-* — слева или справа от поля; block-* ставят группу в колонку — аддон над полем или под ним. Клик по аддону (не по кнопке) переводит фокус в поле группы — input или textarea.',
    },
    {
      name: 'InputGroupButton · size',
      type: "'xs' | 'sm' | 'icon-xs' | 'icon-sm'",
      default: "'xs'",
      description: 'Размер кнопки. icon-* — квадратная кнопка под одну иконку.',
    },
    {
      name: 'InputGroupButton · variant',
      type: "'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'",
      default: "'ghost'",
      description: 'Вид кнопки — те же варианты, что у Button.',
    },
    {
      name: 'InputGroupButton · type',
      type: "'button' | 'submit' | 'reset'",
      default: "'button'",
      description: 'HTML-тип кнопки. По умолчанию button: кнопка внутри формы её не отправляет.',
    },
    {
      name: 'InputGroupInput / InputGroupTextarea',
      type: "React.ComponentProps<'input'> / React.ComponentProps<'textarea'>",
      description:
        'Поле группы на основе Input и Textarea кита, без своей рамки. Принимает все свойства нативного поля: value, onChange(event), placeholder, aria-invalid и другие.',
    },
    {
      name: 'InputGroupText',
      type: "React.ComponentProps<'span'>",
      description: 'Неизменяемый текст в аддоне: префикс, суффикс, подпись.',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Дополнительные классы Tailwind. Есть у всех частей; при конфликте побеждает переданный класс.',
    },
  ],
};
