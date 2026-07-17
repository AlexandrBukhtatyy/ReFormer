import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExampleCard } from './index';

describe('ExampleCard (base)', () => {
  it('рендерит корень с data-slot и заголовком', () => {
    const html = renderToStaticMarkup(
      <ExampleCard title="Input — базовый" code={`<Input />`}>
        <span>пример</span>
      </ExampleCard>
    );
    expect(html).toContain('data-slot="example-card"');
    expect(html).toContain('Input — базовый');
  });

  it('в дефолтном режиме показывает children (пример), а не код', () => {
    const html = renderToStaticMarkup(
      <ExampleCard title="Заголовок" code={`<Button>Клик</Button>`}>
        <span>живой-пример</span>
      </ExampleCard>
    );
    expect(html).toContain('живой-пример');
    // код скрыт до переключения на режим «код»
    expect(html).not.toContain('<Button>Клик</Button>');
  });

  it('рендерит описание, когда оно задано', () => {
    const html = renderToStaticMarkup(
      <ExampleCard title="Т" description="Однострочное поле с placeholder" code={`x`}>
        <span>x</span>
      </ExampleCard>
    );
    expect(html).toContain('Однострочное поле с placeholder');
  });

  it('bgColor задаёт tailwind-класс фона (по умолчанию bg-card — токен темы)', () => {
    const def = renderToStaticMarkup(
      <ExampleCard title="Т" code={`x`}>
        <span>x</span>
      </ExampleCard>
    );
    expect(def).toContain('bg-card');

    const custom = renderToStaticMarkup(
      <ExampleCard title="Т" bgColor="bg-red-50" code={`x`}>
        <span>x</span>
      </ExampleCard>
    );
    expect(custom).toContain('bg-red-50');
  });

  it('className мёржится в контейнер (caller wins)', () => {
    const html = renderToStaticMarkup(
      <ExampleCard title="Т" className="max-w-md" code={`x`}>
        <span>x</span>
      </ExampleCard>
    );
    expect(html).toContain('max-w-md');
  });
});
