/**
 * Секции и массивы кита кросс-фреймворк проверки на `@reformer/ui-kit`: `Section` библиотеки с
 * кнопками `Button` и testid DOM-контракта (`btn-add-{path}`, `btn-remove-{path}-{index}`).
 *
 * Готовый `FieldArray` ui-kit не берётся: его кнопки — `array-add` без имени массива, а на странице
 * кредита массивов три.
 */
import type { ReactNode } from 'react';
import type { ArrayComponentProps } from '@reformer/renderer-react';
import { Button, Section as KitSection } from '@reformer/ui-kit';

const SECTION_CLASS = 'flex flex-col gap-4 rounded-lg border p-4';
const SECTION_TITLE_CLASS = 'text-base font-semibold';

/** Секция шага с заголовком: вложенная группа полей или условная часть шага. */
export function Section({ title, children }: { title: string; children?: ReactNode }): ReactNode {
  return (
    <KitSection title={title} className={SECTION_CLASS} titleClassName={SECTION_TITLE_CLASS}>
      {children}
    </KitSection>
  );
}

/**
 * Контейнер без своей разметки: корень части документа (адрес, строка массива) — поля стоят прямо
 * в секции.
 */
export function Group({ children }: { children?: ReactNode }): ReactNode {
  return <>{children}</>;
}

interface ArraySectionProps extends ArrayComponentProps {
  /** Путь массива DOM-контракта: `properties`. */
  path: string;
  title: string;
  /** Заголовок строки: «{rowTitle} {номер}». */
  rowTitle: string;
  addLabel: string;
}

/**
 * Массив под-форм. Строки и их ключи отдаёт рендерер (`items`), компонент только оформляет их и
 * зовёт `onAdd` / `onRemove`. Путь DOM-контракта поля строки (`properties-0-type`) рендерер выводит
 * из живого пути поля в модели — он следует за индексом строки.
 */
export function ArraySection({
  items,
  onAdd,
  onRemove,
  path,
  title,
  rowTitle,
  addLabel,
}: ArraySectionProps): ReactNode {
  return (
    <KitSection title={title} className={SECTION_CLASS} titleClassName={SECTION_TITLE_CLASS}>
      {items.map((item) => (
        <div key={item.key} className="flex flex-col gap-4 rounded-md border p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{`${rowTitle} ${item.index + 1}`}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid={`btn-remove-${path}-${item.index}`}
              onClick={() => onRemove(item.index)}
            >
              Удалить
            </Button>
          </div>
          {item.children}
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        className="self-start"
        data-testid={`btn-add-${path}`}
        onClick={onAdd}
      >
        {addLabel}
      </Button>
    </KitSection>
  );
}
