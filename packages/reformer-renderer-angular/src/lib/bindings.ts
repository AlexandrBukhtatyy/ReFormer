/**
 * Привязка плоских props узла к DOM-элементу и к компоненту Angular.
 *
 * Рендерер пересчитывает props узла целиком при каждой смене сигнала; привязка применяет разницу:
 * ставит новое, снимает исчезнувшее и не трогает того, что элемент или компонент выставил сам.
 *
 * @module renderer-angular/bindings
 */

import type { ComponentRef, Type } from '@angular/core';
import { componentIoOf, splitProps, type ComponentIo } from './component-io';

type Props = Readonly<Record<string, unknown>>;

/** Имена пропсов в диалекте React, у которых атрибут называется иначе. */
const ATTRIBUTE_NAMES: Readonly<Record<string, string>> = { htmlFor: 'for' };

/**
 * События DOM для обработчиков, имя которых не сводится к имени события. Потеря и получение фокуса
 * слушаются всплывающими событиями: хост компонента — не всегда сам элемент ввода.
 */
const DOM_EVENTS: Readonly<Record<string, string>> = {
  onBlur: 'focusout',
  onFocus: 'focusin',
  onDoubleClick: 'dblclick',
};

/** Свойства CSS, числовое значение которых — не длина: `px` к нему не дописывается. */
const UNITLESS_STYLES: ReadonlySet<string> = new Set([
  'animationIterationCount',
  'aspectRatio',
  'columnCount',
  'columns',
  'fillOpacity',
  'flex',
  'flexGrow',
  'flexShrink',
  'fontWeight',
  'gridArea',
  'gridColumn',
  'gridColumnEnd',
  'gridColumnStart',
  'gridRow',
  'gridRowEnd',
  'gridRowStart',
  'lineHeight',
  'opacity',
  'order',
  'orphans',
  'scale',
  'strokeOpacity',
  'tabSize',
  'widows',
  'zIndex',
  'zoom',
]);

const ATTRIBUTE_NAME = /^[A-Za-z_:][\w:.-]*$/;

/** `onClick` → `click`; ключ, который не похож на обработчик, — `undefined`. */
function domEventOf(key: string): string | undefined {
  const known = DOM_EVENTS[key];
  if (known !== undefined) return known;
  if (key.length < 3 || !key.startsWith('on')) return undefined;
  const head = key[2];
  if (head !== head.toUpperCase() || head === head.toLowerCase()) return undefined;
  return key.slice(2).toLowerCase();
}

/**
 * Текст атрибута для значения пропа; `undefined` — атрибута быть не должно. У `aria-*` и `data-*`
 * логическое значение пишется словом, у остальных `true` — пустой атрибут, `false` — его нет.
 * Объекты и функции атрибутами не становятся.
 */
function attributeText(name: string, value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  if (typeof value === 'boolean') {
    if (name.startsWith('aria-') || name.startsWith('data-')) return String(value);
    return value ? '' : undefined;
  }
  return undefined;
}

function styleText(name: string, value: unknown): string | undefined {
  if (value == null || value === false || value === '') return undefined;
  if (typeof value === 'number') {
    return value === 0 || name.startsWith('--') || UNITLESS_STYLES.has(name)
      ? String(value)
      : `${value}px`;
  }
  return String(value);
}

/**
 * Props узла на DOM-элементе: атрибуты, классы, стили и обработчики событий в диалекте React
 * (`className`, `htmlFor`, `style` объектом, `onClick`). Так написан документ формы, и так же
 * props читают рендереры на React и Vue.
 */
export class ElementBinding {
  private attributes = new Set<string>();
  private classes = new Set<string>();
  private styles = new Set<string>();
  /** Событие DOM → обработчик из последних props; слушатель на элементе один на событие. */
  private handlers = new Map<string, (event: Event) => unknown>();
  private readonly listening = new Map<string, (event: Event) => void>();

  constructor(private readonly element: HTMLElement) {}

  apply(props: Props): void {
    const attributes = new Set<string>();
    const classes = new Set<string>();
    const styles = new Set<string>();
    const handlers = new Map<string, (event: Event) => unknown>();

    for (const [key, value] of Object.entries(props)) {
      if (key === 'className' || key === 'class') {
        if (typeof value === 'string') {
          for (const token of value.split(/\s+/)) if (token) classes.add(token);
        }
      } else if (key === 'style' && typeof value === 'object' && value !== null) {
        this.applyStyle(value as Record<string, unknown>, styles);
      } else if (typeof value === 'function') {
        const event = domEventOf(key);
        if (event !== undefined) handlers.set(event, value as (event: Event) => unknown);
      } else {
        const name = ATTRIBUTE_NAMES[key] ?? key;
        // Обработчик события строкой (`onclick="…"`) исполнился бы как код: обработчики — только
        // функциями.
        if (!ATTRIBUTE_NAME.test(name) || /^on/i.test(name)) continue;
        const text = attributeText(name, value);
        if (text === undefined) continue;
        if (this.element.getAttribute(name) !== text) this.element.setAttribute(name, text);
        attributes.add(name);
      }
    }

    for (const name of this.attributes) {
      if (!attributes.has(name)) this.element.removeAttribute(name);
    }
    for (const token of this.classes) if (!classes.has(token)) this.element.classList.remove(token);
    for (const token of classes) if (!this.classes.has(token)) this.element.classList.add(token);
    for (const name of this.styles) if (!styles.has(name)) this.setStyle(name, undefined);
    for (const event of handlers.keys()) this.listen(event);

    this.attributes = attributes;
    this.classes = classes;
    this.styles = styles;
    this.handlers = handlers;
  }

  /** Снять слушатели. Атрибуты остаются: элемент уходит из DOM вместе с ними. */
  destroy(): void {
    for (const [event, listener] of this.listening) {
      this.element.removeEventListener(event, listener);
    }
    this.listening.clear();
    this.handlers.clear();
  }

  private applyStyle(style: Record<string, unknown>, applied: Set<string>): void {
    for (const [name, value] of Object.entries(style)) {
      const text = styleText(name, value);
      if (text === undefined) continue;
      this.setStyle(name, text);
      applied.add(name);
    }
  }

  private setStyle(name: string, text: string | undefined): void {
    const style = this.element.style;
    if (name.startsWith('--')) {
      if (text === undefined) style.removeProperty(name);
      else style.setProperty(name, text);
    } else {
      (style as unknown as Record<string, string>)[name] = text ?? '';
    }
  }

  private listen(event: string): void {
    if (this.listening.has(event)) return;
    const listener = (payload: Event): void => {
      this.handlers.get(event)?.(payload);
    };
    this.listening.set(event, listener);
    this.element.addEventListener(event, listener);
  }
}

/** Подписка на выход компонента. */
interface OutputSubscription {
  unsubscribe(): void;
}

/**
 * Props узла на компоненте Angular: объявленные входы — через `setInput`, обработчики объявленных
 * выходов — подпиской, всё остальное — на хост-элемент ({@link ElementBinding}).
 *
 * Вход, который был в прошлых props и исчез из новых, получает `undefined`.
 */
export class ComponentBinding {
  /** Описание входов и выходов компонента. */
  readonly io: ComponentIo;
  private readonly host: ElementBinding;
  private inputs = new Set<string>();
  private handlers: Record<string, (payload: unknown) => void> = {};
  private readonly subscriptions = new Map<string, OutputSubscription>();

  constructor(
    private readonly ref: ComponentRef<unknown>,
    type: Type<unknown>
  ) {
    this.io = componentIoOf(type);
    this.host = new ElementBinding(ref.location.nativeElement as HTMLElement);
  }

  apply(props: Props): void {
    const split = splitProps(this.io, props as Record<string, unknown>);

    for (const [name, value] of Object.entries(split.inputs)) this.ref.setInput(name, value);
    for (const name of this.inputs) {
      if (!(name in split.inputs)) this.ref.setInput(name, undefined);
    }
    this.inputs = new Set(Object.keys(split.inputs));

    this.handlers = split.outputs;
    for (const name of Object.keys(split.outputs)) this.subscribe(name);

    this.host.apply(split.host);
  }

  destroy(): void {
    for (const subscription of this.subscriptions.values()) subscription.unsubscribe();
    this.subscriptions.clear();
    this.handlers = {};
    this.host.destroy();
  }

  /** Подписка на выход одна на всё время жизни компонента: обработчик берётся из последних props. */
  private subscribe(name: string): void {
    if (this.subscriptions.has(name)) return;
    const property = this.io.outputs.get(name);
    if (property === undefined) return;
    const emitter = (this.ref.instance as Record<string, unknown>)[property] as
      | { subscribe(listener: (payload: unknown) => void): OutputSubscription }
      | undefined;
    if (!emitter) return;
    this.subscriptions.set(
      name,
      emitter.subscribe((payload) => this.handlers[name]?.(payload))
    );
  }
}
