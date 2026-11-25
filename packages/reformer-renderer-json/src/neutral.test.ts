/**
 * Вход `@reformer/renderer-json/neutral` — без React.
 *
 * Им пользуются рендереры Vue и Angular: в их приложениях React нет, и вход, который его
 * импортирует, там просто не загрузится. Поэтому React и всё, что без него не живёт, здесь бросают
 * на импорте: вход обязан загрузиться и собрать форму из документа, ни разу их не тронув.
 *
 * Тест смотрит исходники; собранный `dist` стережёт `npm run check:exports-dist` — общий чанк, в
 * который сборщик сложил бы React-код, вернул бы импорт при чистых исходниках.
 */
import { describe, it, expect, vi } from 'vitest';
import { createForm, createModel } from '@reformer/core';

vi.mock('react', () => {
  throw new Error('react импортирован входом без React');
});
vi.mock('react/jsx-runtime', () => {
  throw new Error('react/jsx-runtime импортирован входом без React');
});
vi.mock('react-dom', () => {
  throw new Error('react-dom импортирован входом без React');
});
vi.mock('@reformer/renderer-react', () => {
  throw new Error('@reformer/renderer-react импортирован входом без React');
});
vi.mock('@reformer/core/react', () => {
  throw new Error('@reformer/core/react импортирован входом без React');
});

interface Shape {
  email: string;
  agree: boolean;
}

/** Компонент слоя представления для реестра — не React: реестру всё равно, что в записи. */
const TextInput = { name: 'TextInput' };
const Page = { name: 'Page' };

const document = {
  format: 2,
  root: {
    component: '$component(Page)',
    children: [
      {
        model: '$model(email)',
        component: '$component(TextInput)',
        componentProps: { label: 'Email' },
      },
      {
        component: '$html(p)',
        componentProps: { className: 'hint', onclick: 'alert(1)', innerHTML: '<b>x</b>' },
        children: ['Подсказка'],
      },
    ],
  },
} as const;

describe('@reformer/renderer-json/neutral', () => {
  it('ловушка работает: импорт React в этом файле бросает', async () => {
    // Без этой проверки тест ниже был бы зелёным и при сломанной ловушке.
    await expect(import('react')).rejects.toThrow();
    await expect(import('@reformer/renderer-react')).rejects.toThrow();
  });

  it('загружается без React', async () => {
    const neutral = await import('./neutral');
    expect(typeof neutral.defineRegistry).toBe('function');
    expect(typeof neutral.composeRegistries).toBe('function');
    expect(typeof neutral.convertJsonSchema).toBe('function');
  });

  it('собирает форму из документа: компоненты реестра — любые значения', async () => {
    const { defineRegistry } = await import('./neutral');
    const registry = defineRegistry((reg) => {
      reg.component('TextInput', TextInput);
      reg.component('Page', Page);
    });
    const model = createModel<Shape>({ email: 'a@b.c', agree: false });

    const bundle = createForm<Shape>({ model, schema: document, registry });
    try {
      const root = bundle.render.tree!.root;
      if (root.kind !== 'container') throw new Error(`корень — ${root.kind}, ждали контейнер`);
      expect(root.component).toBe(Page);
      const [field, html] = root.children;
      if (field.kind !== 'field') throw new Error(`первый ребёнок — ${field.kind}, ждали поле`);
      expect(field.component).toBe(TextInput);
      if (html.kind !== 'container') throw new Error(`второй ребёнок — ${html.kind}`);
      expect(html.component).toBe('p');
      // Чистка HTML-узла во входе без React та же: обработчик и сырая разметка отброшены.
      expect(html.props).toEqual({ className: 'hint' });
    } finally {
      bundle.dispose();
    }
  });

  it('границу ошибок не подставляет: рендерер стека решает сам', async () => {
    const { defineRegistry } = await import('./neutral');
    const registry = defineRegistry((reg) => {
      reg.component('TextInput', TextInput);
      reg.component('Page', Page);
    });
    const model = createModel<Shape>({ email: '', agree: false });

    const bundle = createForm<Shape>({ model, schema: document, registry });
    try {
      expect(bundle.render.errorBoundary).toBeUndefined();
    } finally {
      bundle.dispose();
    }
  });

  it('границу ошибок слоя представления принимает параметром', async () => {
    const { defineRegistry } = await import('./neutral');
    const Boundary = { name: 'Boundary' };
    const registry = defineRegistry(
      (reg) => {
        reg.component('TextInput', TextInput);
        reg.component('Page', Page);
      },
      { errorBoundary: Boundary }
    );
    const model = createModel<Shape>({ email: '', agree: false });

    expect(registry.resolveSchema!(document, model as never).errorBoundary).toBe(Boundary);
  });

  it('композиция не теряет границу: берёт у последнего реестра, у которого она есть', async () => {
    const { defineRegistry, composeRegistries } = await import('./neutral');
    const Boundary = { name: 'Boundary' };
    const Other = { name: 'Other' };
    const base = defineRegistry((reg) => reg.component('Page', Page), { errorBoundary: Boundary });
    const plain = defineRegistry((reg) => {
      reg.component('TextInput', TextInput);
      reg.component('Page', Page);
    });
    const other = defineRegistry((reg) => reg.component('TextInput', TextInput), {
      errorBoundary: Other,
    });
    const model = createModel<Shape>({ email: '', agree: false });
    const boundaryOf = (registry: ReturnType<typeof composeRegistries>): unknown =>
      registry.resolveSchema!(document, model as never).errorBoundary;

    expect(boundaryOf(composeRegistries(base, plain))).toBe(Boundary);
    expect(boundaryOf(composeRegistries(plain, base))).toBe(Boundary);
    expect(boundaryOf(composeRegistries(base, other))).toBe(Other);
    expect(boundaryOf(composeRegistries(plain, plain))).toBeUndefined();
  });
});
