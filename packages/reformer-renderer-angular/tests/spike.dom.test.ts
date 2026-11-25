/**
 * Проверка механизмов Angular, на которых строится рендерер: каждый тест отвечает на вопрос,
 * который документация не закрывает, и закрепляет ответ.
 */
import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  EnvironmentInjector,
  InjectionToken,
  Input,
  TemplateRef,
  ViewContainerRef,
  inject,
  input,
  model,
  output,
  reflectComponentType,
  signal,
  viewChild,
  type OnInit,
  type Type,
} from '@angular/core';
import { signal as coreSignal } from '@reformer/core/signals';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fromCoreSignal } from '../src/lib/bridge/signals';
import { componentIoOf, splitProps } from '../src/lib/component-io';
import { createHtmlElement } from '../src/lib/html-element.component';
import { mount, unmountAll } from './mount';

afterEach(() => {
  unmountAll();
  vi.restoreAllMocks();
});

/** Место вставки: контейнер представлений внутри обычного элемента. */
@Component({
  selector: 'spike-host',
  template: `<div data-testid="host"><ng-container #anchor /></div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {
  readonly anchor = viewChild.required('anchor', { read: ViewContainerRef });
}

const hostOf = (root: HTMLElement): HTMLElement =>
  root.querySelector<HTMLElement>('[data-testid="host"]')!;

@Component({
  selector: 'spike-probe',
  template: `<span data-testid="probe"
    >{{ label() }}|{{ count() }}|{{ legacy }}|{{ value() }}</span
  >`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Probe {
  readonly label = input('label-default');
  readonly count = input(0, { alias: 'amount' });
  @Input() legacy = 'legacy-default';
  readonly value = model('');
  readonly picked = output<string>();
}

describe('входы и выходы компонента', () => {
  it('описание компонента перечисляет входы-сигналы, входы-декораторы и выходы', () => {
    const mirror = reflectComponentType(Probe)!;
    const inputs = mirror.inputs
      .map(
        (entry) =>
          `${entry.templateName}:${entry.propName}:${entry.isSignal ? 'signal' : 'decorator'}`
      )
      .sort();
    expect(inputs).toEqual([
      'amount:count:signal',
      'label:label:signal',
      'legacy:legacy:decorator',
      'value:value:signal',
    ]);
    expect(mirror.outputs.map((entry) => `${entry.templateName}:${entry.propName}`).sort()).toEqual(
      ['picked:picked', 'valueChange:value']
    );
  });

  it('setInput пишет во вход по имени шаблона и сам планирует перерисовку', async () => {
    const { root, ref, settle } = await mount(Host);
    const probe = ref.instance.anchor().createComponent(Probe);
    await settle();
    const text = (): string => root.querySelector('[data-testid="probe"]')!.textContent!.trim();
    expect(text()).toBe('label-default|0|legacy-default|');

    probe.setInput('label', 'Имя');
    probe.setInput('amount', 5);
    probe.setInput('legacy', 'старый');
    probe.setInput('value', 'текст');
    await settle();
    expect(text()).toBe('Имя|5|старый|текст');
  });

  it('setInput для необъявленного входа не бросает, а пишет ошибку NG0303 в консоль', async () => {
    const { ref } = await mount(Host);
    const probe = ref.instance.anchor().createComponent(Probe);
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => probe.setInput('nope', 1)).not.toThrow();
    expect(errors).toHaveBeenCalledTimes(1);
    expect(String(errors.mock.calls[0][0])).toContain('NG0303');
  });

  it('выход и двусторонний вход слушаются подпиской на свойство экземпляра', async () => {
    const { ref } = await mount(Host);
    const probe = ref.instance.anchor().createComponent(Probe);
    const io = componentIoOf(Probe);
    const instance = probe.instance as unknown as Record<
      string,
      { subscribe(listener: (payload: unknown) => void): { unsubscribe(): void } }
    >;

    const picked = vi.fn();
    const changed = vi.fn();
    instance[io.outputs.get('picked')!].subscribe(picked);
    const subscription = instance[io.outputs.get('valueChange')!].subscribe(changed);

    probe.instance.picked.emit('строка');
    probe.instance.value.set('ввод');
    expect(picked).toHaveBeenCalledWith('строка');
    expect(changed).toHaveBeenCalledWith('ввод');

    subscription.unsubscribe();
    probe.instance.value.set('после отписки');
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('props раскладываются на входы, выходы и хост-элемент', () => {
    const onValueChange = (): void => {};
    const picked = (): void => {};
    const onClick = (): void => {};
    const split = splitProps(componentIoOf(Probe), {
      label: 'Имя',
      amount: 2,
      onValueChange,
      picked,
      onClick,
      'data-testid': 'input-name',
      class: 'wide',
    });
    expect(split.inputs).toEqual({ label: 'Имя', amount: 2 });
    expect(split.outputs).toEqual({ valueChange: onValueChange, picked });
    expect(split.host).toEqual({ onClick, 'data-testid': 'input-name', class: 'wide' });
  });
});

describe('HTML-узел без обёртки', () => {
  it('элемент узла — сам хост компонента, дети — внутри него', async () => {
    const { root, ref, settle } = await mount(Host);
    const anchor = ref.instance.anchor();
    const html = createHtmlElement({
      tag: 'section',
      document,
      environmentInjector: anchor.injector.get(EnvironmentInjector),
      elementInjector: anchor.injector,
      children: [document.createTextNode('привет')],
    });
    html.location.nativeElement.setAttribute('class', 'b-grid');
    anchor.insert(html.hostView);
    await settle();

    const host = hostOf(root);
    expect(host.innerHTML).toBe('<section class="b-grid">привет</section><!--ng-container-->');
    expect(host.children).toHaveLength(1);
    expect(host.firstElementChild!.tagName).toBe('SECTION');
    expect(host.firstElementChild!.className).toBe('b-grid');
    expect(host.firstElementChild!.textContent).toBe('привет');
    expect(root.querySelector('reformer-html')).toBeNull();

    html.destroy();
    expect(host.children).toHaveLength(0);
  });
});

@Component({
  selector: 'spike-section',
  template: `<section>
    <h2>{{ title() }}</h2>
    <div class="body"><ng-content /></div>
  </section>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Section {
  readonly title = input('');
}

@Component({
  selector: 'spike-children-host',
  template: `
    <ng-template #children>
      @for (item of items(); track item) {
        <p>{{ item }}</p>
      }
    </ng-template>
    <div data-testid="host"><ng-container #anchor /></div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class ChildrenHost {
  readonly items = signal(['a']);
  readonly children = viewChild.required('children', { read: TemplateRef });
  readonly anchor = viewChild.required('anchor', { read: ViewContainerRef });
}

describe('дети компонента — проекцией', () => {
  it('живое содержимое остаётся живым внутри ng-content компонента', async () => {
    const { root, ref, settle } = await mount(ChildrenHost);
    const host = ref.instance;
    const anchor = host.anchor();
    const view = anchor.createEmbeddedView(host.children());
    const section = anchor.createComponent(Section, { projectableNodes: [view.rootNodes] });
    section.setInput('title', 'Раздел');
    await settle();

    const body = root.querySelector('.body')!;
    const texts = (): string[] => [...body.querySelectorAll('p')].map((p) => p.textContent!);
    expect(root.querySelector('h2')!.textContent).toBe('Раздел');
    expect(texts()).toEqual(['a']);

    host.items.set(['a', 'b']);
    await settle();
    expect(texts()).toEqual(['a', 'b']);
    const [first, second] = [...body.querySelectorAll('p')];

    host.items.set(['b', 'a']);
    await settle();
    expect(texts()).toEqual(['b', 'a']);
    expect([...body.querySelectorAll('p')]).toEqual([second, first]);

    host.items.set([]);
    await settle();
    expect(texts()).toEqual([]);

    host.items.set(['c']);
    await settle();
    expect(texts()).toEqual(['c']);

    anchor.clear();
    await settle();
    expect(root.querySelector('section')).toBeNull();
    expect(root.querySelectorAll('p')).toHaveLength(0);
  });
});

@Component({
  selector: 'spike-row',
  template: `<input [attr.data-row]="id()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Row {
  readonly id = input.required<string>();
}

/** Директива на `ng-container`: создаёт компонент по классу, как это делает рендерер узла. */
@Directive({ selector: '[spikeOutlet]' })
class Outlet implements OnInit {
  readonly spikeOutlet = input.required<Type<unknown>>();
  readonly spikeOutletInputs = input<Record<string, unknown>>({});
  private readonly container = inject(ViewContainerRef);

  ngOnInit(): void {
    const ref = this.container.createComponent(this.spikeOutlet());
    for (const [name, value] of Object.entries(this.spikeOutletInputs())) ref.setInput(name, value);
  }
}

@Component({
  selector: 'spike-rows',
  imports: [Outlet],
  template: `<ul data-testid="host">
    @for (row of rows(); track row) {
      <ng-container [spikeOutlet]="type" [spikeOutletInputs]="{ id: row }" />
    }
  </ul>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Rows {
  readonly rows = signal(['1', '2', '3']);
  readonly type = Row;
}

const rowInputs = (root: HTMLElement): HTMLInputElement[] => [
  ...root.querySelectorAll<HTMLInputElement>('input[data-row]'),
];

describe('строки массива', () => {
  it('перестановка в @for переносит строки, созданные директивой, не пересоздавая их', async () => {
    const { root, ref, settle } = await mount(Rows);
    const before = rowInputs(root);
    expect(before.map((el) => el.dataset['row'])).toEqual(['1', '2', '3']);
    // Состояние, которого нет в модели: если строку пересоздать, оно пропадёт.
    for (const el of before) el.value = `введено-${el.dataset['row']}`;

    ref.instance.rows.set(['3', '1', '2']);
    await settle();
    const after = rowInputs(root);
    expect(after.map((el) => el.dataset['row'])).toEqual(['3', '1', '2']);
    expect(after).toEqual([before[2], before[0], before[1]]);
    expect(after.map((el) => el.value)).toEqual(['введено-3', 'введено-1', 'введено-2']);
  });

  it('ViewContainerRef.move переносит созданный компонент на новое место', async () => {
    const { root, ref, settle } = await mount(Host);
    const anchor = ref.instance.anchor();
    for (const id of ['1', '2', '3']) anchor.createComponent(Row).setInput('id', id);
    await settle();
    const before = rowInputs(root);
    expect(before.map((el) => el.dataset['row'])).toEqual(['1', '2', '3']);

    anchor.move(anchor.get(2)!, 0);
    await settle();
    const after = rowInputs(root);
    expect(after.map((el) => el.dataset['row'])).toEqual(['3', '1', '2']);
    expect(after).toEqual([before[2], before[0], before[1]]);
  });
});

const source = coreSignal('a');
let reads = 0;

@Component({
  selector: 'spike-bridge',
  template: `<output data-testid="text">{{ text() }}</output>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Bridge {
  readonly text = fromCoreSignal(() => {
    reads += 1;
    return source.value;
  });
}

describe('мост сигналов без зоны', () => {
  it('запись в сигнал ядра вне Angular перерисовывает шаблон без ручного вызова', async () => {
    source.value = 'a';
    const { root, settle, unmount } = await mount(Bridge);
    const text = (): string => root.querySelector('[data-testid="text"]')!.textContent!;
    expect(text()).toBe('a');

    source.value = 'b';
    // Перерисовка запланирована, а не выполнена на месте: несколько записей подряд дают одну.
    expect(text()).toBe('a');
    await settle();
    expect(text()).toBe('b');

    unmount();
    const readsAtUnmount = reads;
    source.value = 'c';
    expect(reads).toBe(readsAtUnmount);
  });
});

const CONTAINER_VALUE = new InjectionToken<string>('spike.container-value');

/** Контейнер кита, который отдаёт значение своим детям через внедрение — как форма кнопке сброса. */
@Component({
  selector: 'spike-provider',
  template: `<div class="provided"><ng-content /></div>`,
  providers: [{ provide: CONTAINER_VALUE, useValue: 'из контейнера' }],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Provider {}

@Component({
  selector: 'spike-consumer',
  template: `<output data-testid="consumed">{{ value }}</output>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Consumer {
  readonly value = inject(CONTAINER_VALUE, { optional: true }) ?? 'нет';
}

@Component({
  selector: 'spike-provider-host',
  imports: [Consumer],
  template: `
    <ng-template #children>
      @for (item of items(); track item) {
        <spike-consumer />
      }
    </ng-template>
    <div data-testid="host"><ng-container #anchor /></div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class ProviderHost {
  readonly items = signal([1]);
  readonly children = viewChild.required('children', { read: TemplateRef });
  readonly anchor = viewChild.required('anchor', { read: ViewContainerRef });
}

const consumed = (root: HTMLElement): string[] =>
  [...root.querySelectorAll('.provided [data-testid="consumed"]')].map((el) => el.textContent!);

describe('внедрение от контейнера к детям', () => {
  it('дети, созданные раньше контейнера, его провайдеров не видят', async () => {
    const { root, ref, settle } = await mount(ProviderHost);
    const anchor = ref.instance.anchor();
    const view = anchor.createEmbeddedView(ref.instance.children());
    anchor.createComponent(Provider, { projectableNodes: [view.rootNodes] });
    await settle();
    expect(consumed(root)).toEqual(['нет']);
  });

  it('дети, созданные после контейнера с его инжектором, провайдеры видят', async () => {
    const { root, ref, settle } = await mount(ProviderHost);
    const anchor = ref.instance.anchor();
    // Место детей занимает заглушка: контейнер создаётся первым, дети встают на её место.
    const placeholder = document.createComment('');
    const container = anchor.createComponent(Provider, { projectableNodes: [[placeholder]] });
    const view = anchor.createEmbeddedView(ref.instance.children(), undefined, {
      injector: container.injector,
    });
    placeholder.replaceWith(...view.rootNodes);
    await settle();
    expect(consumed(root)).toEqual(['из контейнера']);

    // Дети, появившиеся позже, встают туда же и видят те же провайдеры.
    ref.instance.items.set([1, 2]);
    await settle();
    expect(consumed(root)).toEqual(['из контейнера', 'из контейнера']);

    anchor.clear();
    await settle();
    expect(root.querySelectorAll('[data-testid="consumed"]')).toHaveLength(0);
    expect(root.querySelector('.provided')).toBeNull();
  });
});

@Component({
  selector: 'spike-native',
  template: `<input [attr.data-testid]="testId()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Native {
  /** Атрибут, который контрол забирает себе, чтобы поставить на нативный элемент. */
  readonly testId = input<string | null>(null, { alias: 'data-testid' });
}

describe('атрибут как вход', () => {
  it('вход с псевдонимом-атрибутом перехватывает data-testid, остальное идёт на хост', async () => {
    const { root, ref, settle } = await mount(Host);
    const native = ref.instance.anchor().createComponent(Native);
    const split = splitProps(componentIoOf(Native), {
      'data-testid': 'input-email',
      'aria-label': 'Email',
    });
    expect(split.inputs).toEqual({ 'data-testid': 'input-email' });
    expect(split.host).toEqual({ 'aria-label': 'Email' });

    for (const [name, value] of Object.entries(split.inputs)) native.setInput(name, value);
    await settle();
    expect(root.querySelector('input')!.dataset['testid']).toBe('input-email');
    expect(native.location.nativeElement.hasAttribute('data-testid')).toBe(false);
  });
});
