import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarBadge,
  AvatarGroup,
  AvatarGroupCount,
} from './index';

describe('Avatar (base, compound на Radix Avatar)', () => {
  it('Root несёт data-slot="avatar" + дефолтный data-size; fallback рендерится в SSR', () => {
    // В SSR AvatarImage возвращает null (статус загрузки 'idle'), поэтому
    // видимая часть — Root + Fallback.
    const html = renderToStaticMarkup(
      <Avatar>
        <AvatarImage src="/user.png" alt="Иван" />
        <AvatarFallback>ИП</AvatarFallback>
      </Avatar>
    );
    expect(html).toContain('data-slot="avatar"');
    expect(html).toContain('data-size="default"');
    expect(html).toContain('data-slot="avatar-fallback"');
    expect(html).toContain('>ИП<');
  });

  it('size прокидывается в data-size', () => {
    const html = renderToStaticMarkup(
      <Avatar size="lg">
        <AvatarFallback>A</AvatarFallback>
      </Avatar>
    );
    expect(html).toContain('data-size="lg"');
  });

  it('className мёржится (tailwind-merge, caller wins)', () => {
    const html = renderToStaticMarkup(
      <Avatar className="size-16">
        <AvatarFallback>A</AvatarFallback>
      </Avatar>
    );
    expect(html).toContain('size-16');
    expect(html).not.toContain('size-8');
  });

  it('прокидывает произвольные props на Root (напр. id, data-testid)', () => {
    const html = renderToStaticMarkup(
      <Avatar id="a1" data-testid="avatar-x">
        <AvatarFallback>A</AvatarFallback>
      </Avatar>
    );
    expect(html).toContain('id="a1"');
    expect(html).toContain('data-testid="avatar-x"');
  });

  it('презентационные части несут собственные data-slot (badge/group/group-count)', () => {
    const html = renderToStaticMarkup(
      <AvatarGroup>
        <Avatar>
          <AvatarFallback>A</AvatarFallback>
          <AvatarBadge />
        </Avatar>
        <AvatarGroupCount>+3</AvatarGroupCount>
      </AvatarGroup>
    );
    expect(html).toContain('data-slot="avatar-group"');
    expect(html).toContain('data-slot="avatar-badge"');
    expect(html).toContain('data-slot="avatar-group-count"');
    expect(html).toContain('>+3<');
  });
});
