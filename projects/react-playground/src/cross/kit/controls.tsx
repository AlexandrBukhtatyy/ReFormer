/**
 * Контролы кита кросс-фреймворк проверки на `@reformer/ui-kit`: имена реестра формы
 * (`TextInput`, `MaskedInput`, `Select`, `CaptchaWidget`, …) — тонкие адаптеры над компонентами
 * библиотеки. Флажок, число и группа радиокнопок — компоненты ui-kit как есть (./registry.ts).
 *
 * Тот же документ формы рисуют киты на Vuetify и Taiga UI, поэтому значение поля у трёх стеков
 * обязано совпадать: текст остаётся строкой, пустое поле — пустой строкой.
 */
import {
  useCallback,
  useEffect,
  useRef,
  type ChangeEvent,
  type ComponentProps,
  type ReactNode,
} from 'react';
import type { FieldAdapter } from '@reformer/core/react';
import { Button, Input, NativeSelectWithOptions, Textarea as KitTextarea } from '@reformer/ui-kit';
import {
  CAPTCHA_CANVAS,
  applyMask,
  drawCaptcha,
  getCaptcha,
} from '../../../../forms-benchmark/src/cross/page';

type InputProps = ComponentProps<typeof Input>;

/**
 * Текст поля как есть. Собственный диалект `Input` ui-kit превращает пустую строку в `null` — у
 * формы, общей для трёх стеков, пустое поле остаётся пустой строкой, как у нативного элемента.
 * Годится любому нативному элементу со строковым `value`: полю, многострочному полю, списку.
 */
const textAdapter: FieldAdapter = {
  fromEmit: (event) =>
    (event as ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>).target.value,
  toValue: (value) => value ?? '',
};

export function TextInput(props: InputProps): ReactNode {
  return <Input {...props} />;
}
TextInput.reformerAdapter = textAdapter;

/**
 * Поле с маской. `InputMask` ui-kit маску не применяет, только подсказывает формат, а у Vuetify и
 * Taiga UI формат маски свой — поэтому у трёх стеков одна функция `applyMask`: она правит текст в
 * самом элементе до того, как событие уходит в поле формы.
 */
export function MaskedInput({ mask, onChange, ...rest }: InputProps & { mask: string }): ReactNode {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const masked = applyMask(event.target.value, mask);
    if (masked !== event.target.value) event.target.value = masked;
    onChange?.(event);
  };
  return <Input inputMode="tel" {...rest} onChange={handleChange} />;
}
MaskedInput.reformerAdapter = textAdapter;

/**
 * Дата — нативный `type="date"` в поле ui-kit: значение остаётся строкой `YYYY-MM-DD`, как ждёт
 * домен формы. Календарь ui-kit хранит `Date` — другой тип значения.
 */
export function DateInput(props: Omit<InputProps, 'type'>): ReactNode {
  return <Input {...props} type="date" />;
}
DateInput.reformerAdapter = textAdapter;

export function Textarea(props: ComponentProps<typeof KitTextarea>): ReactNode {
  return <KitTextarea {...props} />;
}
Textarea.reformerAdapter = textAdapter;

type SelectProps = ComponentProps<typeof NativeSelectWithOptions>;

/**
 * Список — нативный `<select>` ui-kit. Пустой пункт стоит первым всегда: им поле сбрасывается, и
 * сценарии ждут его среди пунктов — как у списков Vuetify и Taiga UI.
 */
export function Select({ placeholder = 'Выберите…', ...rest }: SelectProps): ReactNode {
  return <NativeSelectWithOptions {...rest} placeholder={placeholder} />;
}
Select.reformerAdapter = textAdapter;

export interface ReadonlyValueProps {
  /** Путь DOM-контракта: `computed-{path}`. */
  path: string;
  label: string;
  /** Уже вычисленное значение; числа выводятся без разделителей разрядов. */
  value: string | number | null | undefined;
}

/** Вычисляемое значение: подпись и `<output>`, контрола нет. */
export function ReadonlyValue({ path, label, value }: ReadonlyValueProps): ReactNode {
  const labelId = `computed-label-${path}`;
  return (
    <div className="flex flex-col gap-1">
      <span id={labelId} className="text-sm font-medium">
        {label}
      </span>
      <output
        aria-labelledby={labelId}
        data-testid={`computed-${path}`}
        className="min-h-5 text-sm text-muted-foreground"
      >
        {value == null ? '' : String(value)}
      </output>
    </div>
  );
}

type CaptchaInputAttrs = Omit<InputProps, 'value' | 'onChange' | 'onBlur'>;

export interface CaptchaWidgetProps extends CaptchaInputAttrs {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
}

/**
 * Капча: картинка на canvas, «Обновить», поле ввода. Код выдаёт и проверяет «сервер»; виджет
 * рисует картинку и отдаёт введённый текст по значению (`value` / `onChange(value)`). Атрибуты
 * контрола от рендерера и обёртки поля (`id`, `data-testid`, `aria-*`) ложатся на поле ввода.
 */
export function CaptchaWidget({
  value,
  onChange,
  onBlur,
  ...inputAttrs
}: CaptchaWidgetProps): ReactNode {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const load = useCallback((clear: boolean) => {
    void getCaptcha().then((challenge) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      drawCaptcha(canvas, challenge);
      canvas.dataset.challenge = challenge.challengeId;
      if (clear) onChangeRef.current('');
    });
  }, []);

  // Картинка загружается один раз на монтирование; обновление — только по кнопке.
  useEffect(() => {
    load(false);
  }, [load]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <canvas
          ref={canvasRef}
          width={CAPTCHA_CANVAS.width}
          height={CAPTCHA_CANVAS.height}
          className="rounded-md border"
          data-testid="captcha-image"
          aria-label="Картинка капчи"
          role="img"
        />
        <Button
          type="button"
          variant="outline"
          data-testid="captcha-refresh"
          onClick={() => load(true)}
        >
          Обновить
        </Button>
      </div>
      <Input
        autoComplete="off"
        {...inputAttrs}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />
    </div>
  );
}
