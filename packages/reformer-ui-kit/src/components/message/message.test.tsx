import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  MessageGroup,
  Message,
  MessageAvatar,
  MessageContent,
  MessageHeader,
  MessageFooter,
} from './index';

// Message — презентационный compound (AI chat message) из обычных <div> (без Radix,
// без Portal), поэтому весь контент присутствует в SSR-разметке.

describe('Message (base, presentational compound)', () => {
  it('каждая под-часть несёт собственный data-slot', () => {
    const html = renderToStaticMarkup(
      <MessageGroup>
        <Message>
          <MessageAvatar>ИИ</MessageAvatar>
          <MessageContent>
            <MessageHeader>Ассистент</MessageHeader>
            Привет! Чем могу помочь?
            <MessageFooter>только что</MessageFooter>
          </MessageContent>
        </Message>
      </MessageGroup>
    );
    expect(html).toContain('data-slot="message-group"');
    expect(html).toContain('data-slot="message"');
    expect(html).toContain('data-slot="message-avatar"');
    expect(html).toContain('data-slot="message-content"');
    expect(html).toContain('data-slot="message-header"');
    expect(html).toContain('data-slot="message-footer"');
  });

  it('Message по умолчанию выравнивается к началу (data-align="start")', () => {
    const html = renderToStaticMarkup(
      <Message>
        <MessageContent>Ответ</MessageContent>
      </Message>
    );
    expect(html).toContain('data-align="start"');
  });

  it('align="end" переключает выравнивание (data-align="end")', () => {
    const html = renderToStaticMarkup(
      <Message align="end">
        <MessageContent>Моё сообщение</MessageContent>
      </Message>
    );
    expect(html).toContain('data-align="end"');
    expect(html).toContain('data-[align=end]:flex-row-reverse');
  });

  it('рендерит переданный контент (children)', () => {
    const html = renderToStaticMarkup(
      <Message>
        <MessageContent>Текст ответа модели</MessageContent>
      </Message>
    );
    expect(html).toContain('Текст ответа модели');
  });

  it('className мёржится на под-части (tailwind-merge, caller wins)', () => {
    const html = renderToStaticMarkup(
      <Message className="opacity-50">
        <MessageContent className="max-w-md">c</MessageContent>
      </Message>
    );
    expect(html).toContain('opacity-50');
    expect(html).toContain('max-w-md');
  });

  it('прокидывает произвольные props (напр. data-testid) на под-части', () => {
    const html = renderToStaticMarkup(
      <MessageGroup data-testid="thread">
        <Message data-testid="msg-1">
          <MessageContent data-testid="msg-1-content">x</MessageContent>
        </Message>
      </MessageGroup>
    );
    expect(html).toContain('data-testid="thread"');
    expect(html).toContain('data-testid="msg-1"');
    expect(html).toContain('data-testid="msg-1-content"');
  });

  it('все под-части — <div>', () => {
    const html = renderToStaticMarkup(
      <Message>
        <MessageContent>c</MessageContent>
      </Message>
    );
    expect(html).toMatch(/<div[^>]*data-slot="message"/);
    expect(html).toMatch(/<div[^>]*data-slot="message-content"/);
  });
});
