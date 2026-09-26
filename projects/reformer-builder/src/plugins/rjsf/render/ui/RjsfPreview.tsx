/**
 * Форма RJSF в ките — то, что монтирует поверхность `rjsf.preview`.
 *
 * Отдельный ленивый чанк: RJSF и его валидатор (ajv) едут только к тому, кто открыл форму.
 *
 * Тема строится из активного кита (`@reformer/rjsf-kit-theme`) по его сырому каталогу и
 * пространству имён и перестраивается, когда кит сменился или его компоненты доехали. Форма
 * рисуется внутри рамки кита (`KitsService.Frame`): скоуп стилей плагина-владельца и провайдер
 * кита. Кита нет — стандартная тема RJSF без рамки.
 *
 * Тема передаётся самой форме (`widgets`, `templates`), а не через `withTheme`: тот создаёт новый
 * компонент на каждую тему, и смена кита размонтировала бы форму вместе с набранным.
 *
 * Расхождения темы (чего в ките не нашлось) — не ошибки: форма рисуется. Они показаны заметкой
 * под формой. Находкой сборки (`ctx.report`) становится только падение отрисовки.
 *
 * @module plugins/rjsf/render/ui/RjsfPreview
 */

import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type ReactElement,
  type ReactNode,
} from 'react';
import Form, { type IChangeEvent } from '@rjsf/core';
import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import { createKitTheme, type KitTheme } from '@reformer/rjsf-kit-theme';
import { initialValues, isRjsfForm, type RjsfForm, type RjsfValues } from '@/plugins/rjsf/core';
import type {
  CatalogJson,
  Disposable,
  KitFrameProps,
  KitNamespace,
  KitsService,
  PreviewContext,
} from '@reformer/builder-plugin-api';
import { RJSF_SURFACE_ID } from '../contract';

type Translate = (key: string, params?: Record<string, unknown>) => string;

const NOOP: Disposable = { dispose: () => {} };
const NO_NAMESPACE: KitNamespace = Object.freeze({});
const NO_RECORDS: CatalogJson['components'] = [];

export interface RjsfPreviewProps {
  readonly ctx: PreviewContext;
  readonly kits: KitsService | undefined;
  /** Рамка активного кита; `null` — кита нет. Стабильна на всё время жизни службы китов. */
  readonly frame: ComponentType<KitFrameProps> | null;
  readonly t: Translate;
}

/** Документ как форма RJSF; `null` — схема не разбирается как форма домена. */
function useForm(ctx: PreviewContext): RjsfForm | null {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const subscription = ctx.onDidChangeSchema(onChange);
      return () => {
        subscription.dispose();
      };
    },
    [ctx]
  );
  const snapshot = useCallback(() => ctx.schema(), [ctx]);
  const schema = useSyncExternalStore(subscribe, snapshot, snapshot);
  return isRjsfForm(schema) ? schema : null;
}

/** Тема активного кита: перестраивается на смену кита и на доезд его каталога и компонентов. */
function useKitTheme(kits: KitsService | undefined): KitTheme {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const changes = kits?.onDidChange(onChange) ?? NOOP;
      const loads = kits?.onDidLoadNamespace(onChange) ?? NOOP;
      return () => {
        changes.dispose();
        loads.dispose();
      };
    },
    [kits]
  );
  const readCatalog = useCallback(() => kits?.catalogJson() ?? null, [kits]);
  // Первый вызов заводит загрузку компонентов кита; доезд придёт `onDidLoadNamespace`.
  const readNamespace = useCallback(() => kits?.namespace() ?? null, [kits]);
  const catalog = useSyncExternalStore(subscribe, readCatalog, readCatalog);
  const namespace = useSyncExternalStore(subscribe, readNamespace, readNamespace);
  return useMemo(
    () =>
      createKitTheme({
        namespace: namespace ?? NO_NAMESPACE,
        components: catalog?.components ?? NO_RECORDS,
        ...(catalog?.kit?.infra !== undefined ? { slots: catalog.kit.infra } : {}),
        ...catalog?.kit?.renderers?.rjsf,
      }),
    [catalog, namespace]
  );
}

interface BoundaryProps {
  /** Сброс падения: форма или тема сменились — новая попытка отрисовки. */
  readonly form: RjsfForm;
  readonly theme: KitTheme;
  readonly onError: (error: Error) => void;
  readonly fallback: (error: Error) => ReactNode;
  readonly children: ReactNode;
}

/**
 * Граница ошибок формы: неизвестный виджет, компонент кита, упавший на чужих пропсах.
 *
 * Класс, а не хук: границ ошибок функциональными компонентами React не выражает.
 */
class FormBoundary extends Component<BoundaryProps, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  componentDidCatch(error: Error): void {
    this.props.onError(error);
  }

  componentDidUpdate(previous: BoundaryProps): void {
    const changed = previous.form !== this.props.form || previous.theme !== this.props.theme;
    if (changed && this.state.error !== null) this.setState({ error: null });
  }

  render(): ReactNode {
    const { error } = this.state;
    return error === null ? this.props.children : this.props.fallback(error);
  }
}

/** Падение отрисовки — и для чего оно случилось: для другой формы или темы оно уже не в силе. */
interface Failure {
  readonly error: Error;
  readonly form: RjsfForm;
  readonly theme: KitTheme;
}

export default function RjsfPreview({ ctx, kits, frame, t }: RjsfPreviewProps): ReactElement {
  const form = useForm(ctx);
  const theme = useKitTheme(kits);
  const [values, setValues] = useState<RjsfValues | undefined>(() => ctx.values());
  const [failure, setFailure] = useState<Failure | null>(null);
  const error =
    failure !== null && failure.form === form && failure.theme === theme ? failure.error : null;
  // Значения удалённых полей отпадают, новые поля получают свой `default`.
  const formData = useMemo(
    () => (form === null ? {} : initialValues(form, values)),
    [form, values]
  );

  useEffect(() => {
    // Находки публикуются эффектом: `report` меняет состояние превью, а менять состояние во время
    // отрисовки — гарантированный цикл перерисовок.
    ctx.report(
      RJSF_SURFACE_ID,
      error === null ? [] : [{ file: '', phase: 'render', message: error.message }]
    );
  }, [ctx, error]);

  if (form === null) {
    return <p className="p-4 text-sm text-muted-foreground">{t('surface.invalid')}</p>;
  }

  const onChange = (event: IChangeEvent) => {
    const next = (event.formData ?? {}) as Record<string, unknown>;
    setValues(next);
    // Хосту — на хранение: переход между видами и пересборка не стирают набранное.
    ctx.keepValues(next);
  };
  const content = (
    <FormBoundary
      form={form}
      theme={theme}
      onError={(caught) => {
        setFailure({ error: caught, form, theme });
      }}
      fallback={(caught) => (
        <p className="text-sm text-destructive" role="alert">
          {t('surface.failed', { message: caught.message })}
        </p>
      )}
    >
      <Form
        className="rjsf flex flex-col gap-4"
        schema={form.schema as unknown as RJSFSchema}
        uiSchema={form.uiSchema as UiSchema | undefined}
        formData={formData}
        validator={validator}
        widgets={theme.theme.widgets}
        templates={theme.theme.templates}
        showErrorList={false}
        noHtml5Validate
        onChange={onChange}
        // Ошибки отправки видны у полей; без обработчика RJSF пишет каждую ещё и в консоль.
        onError={() => undefined}
      />
    </FormBoundary>
  );
  const Frame = frame;

  return (
    <div className="p-4" data-testid="rjsf-preview">
      {Frame === null ? content : <Frame>{content}</Frame>}
      {theme.problems.length > 0 && (
        <details className="mt-4 text-xs text-muted-foreground" data-testid="rjsf-theme-notes">
          <summary>{t('theme.summary', { count: theme.problems.length })}</summary>
          <ul className="mt-1 list-disc pl-4">
            {theme.problems.map((problem) => (
              <li key={JSON.stringify(problem)}>{t(`theme.${problem.code}`, { ...problem })}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
