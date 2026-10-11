/**
 * Compile-time тест скомпилированной схемы `CompiledSchema` / `CompiledNode`. Проверяется `tsc`
 * (файл под `src`, `include: ["src"]`); vitest его НЕ запускает — нет суффикса `.test.`.
 *
 * Убеждается, что:
 *  - узел сужается по `kind`: привязка и `disabled` — у поля, `row()` — у массива под-форм,
 *    `content` — у подформы, `children` — у контейнера, `parts` — у текста; разбор видов полный;
 *  - идентификаторы узла и области — бренды: строку без приведения не присвоить, бренды между
 *    собой не смешиваются, а карты узлов ключуются брендом и только читаются;
 *  - `ComponentRef` — строка или объект, текст корнем области не бывает.
 */

import type { FormModel } from '../../model/types';
import type { ComponentRef, FormSchemaNode, SchemaArrayControl } from '../types/schema-node';
import { compileSchema, isCompiledNode } from './compile';
import type {
  CompiledArrayNode,
  CompiledChild,
  CompiledFieldNode,
  CompiledNode,
  CompiledPartNode,
  CompiledSchema,
  CompiledTextNode,
  SchemaNodeId,
  SchemaScopeId,
  SchemaTextPart,
} from './compiled';

interface Phone {
  number: string;
}
interface Profile {
  email: string;
  address: { city: string };
  phones: Phone[];
}

declare const rowModel: FormModel<Phone>;

/** Разбор узла по виду: у каждого вида — свои ключи. */
export function describeNode(node: CompiledNode): string {
  switch (node.kind) {
    case 'field': {
      const path: string = node.handle.__path;
      const disabled: boolean = node.disabled;
      // @ts-expect-error — у поля нет схемы строки: она — у массива под-форм
      node.row(rowModel);
      return `${path}${disabled ? ' (выключено)' : ''}`;
    }
    case 'array': {
      // Схема строки — по под-модели строки.
      const row: CompiledSchema = node.row(rowModel);
      const control: SchemaArrayControl = node.control;
      const template: unknown = node.initialValue;
      // @ts-expect-error — строку адресует под-модель, а не путь строкой
      node.row('phones.0');
      void template;
      return `${node.handle.__path}: ${control.length} строк, область ${row.scope}`;
    }
    case 'part': {
      // Содержимое подформы скомпилировано сразу — в своей области.
      const content: CompiledSchema = node.content;
      const model: object = node.model;
      // @ts-expect-error — у подформы нет флага `disabled`: он только у поля
      void node.disabled;
      void model;
      return `подформа ${content.scope}`;
    }
    case 'container': {
      const children: readonly CompiledChild[] = node.children;
      return children.map(describeChild).join(', ');
    }
    default: {
      const exhaustive: never = node;
      return exhaustive;
    }
  }
}

/** Ребёнок контейнера: текст либо узел. */
function describeChild(child: CompiledChild): string {
  if (child.kind === 'text') {
    const parts: readonly SchemaTextPart[] = child.parts;
    // @ts-expect-error — у текста нет компонента и пропсов: это не узел
    void child.component;
    return parts.map((part) => (typeof part === 'object' ? String(part.value) : part)).join('');
  }
  const component: ComponentRef | undefined = child.component;
  const props: Readonly<Record<string, unknown>> = child.props;
  const source: FormSchemaNode = child.source;
  void [component, props, source];
  return child.selector ?? child.path;
}

/** Бренды идентификаторов и карты схемы области. */
export function brandTypeChecks(compiled: CompiledSchema, model: FormModel<Profile>): void {
  const scope: SchemaScopeId = compiled.scope;
  const root: CompiledNode = compiled.root;
  const id: SchemaNodeId = root.id;
  // Бренд — строка: читается как строка без приведения.
  const asText: string = id;
  // Строка становится идентификатором только явным приведением.
  const summaryId = 'summary' as SchemaNodeId;
  const summary: CompiledNode | undefined = compiled.nodes.get(summaryId);
  // Поля и массивы — по ручке модели.
  const field: CompiledFieldNode | undefined = compiled.fields.get(model.$.email);
  const array: CompiledArrayNode | undefined = compiled.arrays.get(model.$.phones);
  const rowSchema: CompiledSchema | undefined = array?.row(rowModel);

  // @ts-expect-error — строку без бренда в идентификатор узла не присвоить
  const plainId: SchemaNodeId = 'summary';
  // @ts-expect-error — и в идентификатор области
  const plainScope: SchemaScopeId = '#';
  // @ts-expect-error — бренды узла и области не смешиваются
  const crossBrand: SchemaScopeId = id;
  // @ts-expect-error — карта узлов ключуется брендом: строкой узел не найти
  compiled.nodes.get('summary');
  // @ts-expect-error — карты схемы только для чтения
  compiled.nodes.set(summaryId, root);
  // @ts-expect-error — область скомпилированной схемы только для чтения
  compiled.scope = '#/address' as SchemaScopeId;

  void [scope, asText, summary, field, array, rowSchema, plainId, plainScope, crossBrand];
}

/** Ссылка на компонент, текст и предикат узла. */
export function componentRefTypeChecks(text: CompiledTextNode, value: unknown): void {
  // Ссылка на компонент — тег строкой или объект (компонент — функция, memo/forwardRef — объект).
  const byTag: ComponentRef = 'section';
  const byComponent: ComponentRef = () => null;
  const byObject: ComponentRef = { $$typeof: Symbol.for('react.memo') };
  // @ts-expect-error — число компонентом не бывает
  const byNumber: ComponentRef = 42;
  // @ts-expect-error — пустой ссылки нет: узел без компонента — `component: undefined`
  const byNull: ComponentRef = null;

  // Текст — ребёнок контейнера, но не узел: корнем области он не бывает.
  const child: CompiledChild = text;
  // @ts-expect-error — текст не узел
  const asNode: CompiledNode = text;
  // @ts-expect-error — вид корня — узел: `text` в нём нет
  const rootKind: CompiledSchema['root']['kind'] = 'text';

  // Предикат сужает неизвестное значение до узла.
  if (isCompiledNode(value)) {
    const kind: CompiledNode['kind'] = value.kind;
    const scope: SchemaScopeId = value.scope;
    void [kind, scope];
  }
  // @ts-expect-error — без проверки неизвестное значение — не узел
  const unchecked: CompiledNode = value;

  void [byTag, byComponent, byObject, byNumber, byNull, child, asNode, rootKind, unchecked];
}

/** Компиляция: дерево, модель области и идентификатор области — бренд. */
export function compileTypeChecks(tree: FormSchemaNode, model: FormModel<Profile>): void {
  const compiled: CompiledSchema = compileSchema(tree, model);
  const scoped: CompiledSchema = compileSchema(tree, model.address, {
    scope: '#/address' as SchemaScopeId,
  });
  const withoutModel: CompiledSchema = compileSchema({ children: ['Только текст'] });
  // @ts-expect-error — область — бренд, а не строка
  compileSchema(tree, model.address, { scope: '#/address' });
  // @ts-expect-error — компилируется дерево узлов, а не билдер `(model) => узел`
  compileSchema((profile: FormModel<Profile>) => ({ model: profile.$.email }), model);

  void [compiled, scoped, withoutModel];
}

/** Части узлов: поле, массив и подформа — их собственные ключи. */
export function nodeShapeTypeChecks(part: CompiledPartNode, array: CompiledArrayNode): void {
  const contentRoot: CompiledNode = part.content.root;
  const handlePeek: object | null | undefined = part.handle.peek();
  const rowControlLength: number = array.control.length;
  // @ts-expect-error — у массива под-форм нет `content`: схема строки строится по под-модели
  void array.content;
  // @ts-expect-error — у подформы нет `row`
  part.row(rowModel);
  void [contentRoot, handlePeek, rowControlLength];
}
