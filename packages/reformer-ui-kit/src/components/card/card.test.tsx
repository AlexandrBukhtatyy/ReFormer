import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
} from './index';

describe('Card (base, compound presentational)', () => {
  it('каждая часть несёт собственный data-slot', () => {
    const html = renderToStaticMarkup(
      <Card>
        <CardHeader>
          <CardTitle>Заголовок</CardTitle>
          <CardDescription>Описание</CardDescription>
          <CardAction>Действие</CardAction>
        </CardHeader>
        <CardContent>Контент</CardContent>
        <CardFooter>Подвал</CardFooter>
      </Card>
    );
    expect(html).toContain('data-slot="card"');
    expect(html).toContain('data-slot="card-header"');
    expect(html).toContain('data-slot="card-title"');
    expect(html).toContain('data-slot="card-description"');
    expect(html).toContain('data-slot="card-action"');
    expect(html).toContain('data-slot="card-content"');
    expect(html).toContain('data-slot="card-footer"');
  });

  it('Card — <div> с базовыми стилями карточки', () => {
    const html = renderToStaticMarkup(<Card>X</Card>);
    expect(html).toMatch(/^<div/);
    expect(html).toContain('rounded-xl');
    expect(html).toContain('border');
    expect(html).toContain('bg-card');
    expect(html).toContain('>X</div>');
  });

  it('className мёржится (tailwind-merge, caller wins)', () => {
    const html = renderToStaticMarkup(<Card className="bg-red-500">X</Card>);
    expect(html).toContain('bg-red-500');
    expect(html).not.toContain('bg-card');
  });

  it('прокидывает произвольные div-props (напр. id, data-*)', () => {
    const html = renderToStaticMarkup(
      <Card id="c1" data-testid="card-x">
        X
      </Card>
    );
    expect(html).toContain('id="c1"');
    expect(html).toContain('data-testid="card-x"');
  });

  it('CardTitle рендерит текст и полужирный шрифт', () => {
    const html = renderToStaticMarkup(<CardTitle>Тариф</CardTitle>);
    expect(html).toContain('font-semibold');
    expect(html).toContain('>Тариф</div>');
  });
});
