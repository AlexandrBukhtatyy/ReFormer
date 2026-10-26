/**
 * Правила формы из кода её модуля — единственного места, где они живут.
 *
 * Файлы правил модуля (раскладка — `../layout`):
 *
 * - `validation/form.ts` и `validation/<шаг>.ts` — правила валидации (`./validation`);
 * - `behavior/index.ts` — связи и правила узлов (`./behavior`);
 * - `validation/messages.ts` — тексты замечаний по кодам (`./data`);
 * - `constants/<каталог>.ts` — значения источников данных (`./data`).
 *
 * У каждого файла правил своё происхождение — маркер генерации (`@reformer/builder-toolkit`):
 * сгенерирован, правлен руками, написан человеком. Чтение отвечает и тем, и другим: всеми
 * правилами — тому, кто их показывает и проверяет (затравка хода, валидатор, превью), и правилами
 * нетронутых файлов — генерации ({@link regenerableRules}): правленный файл генерация не
 * перепечатывает, и правило из него не должно уехать дублем в соседний файл.
 *
 * @module plugins/reformer/core/codegen/rules-code/read
 */

import { originOf, type FileOrigin } from '@reformer/builder-toolkit';
import { emptyRules, type FormRules } from '../../form-model/rules';
import { readBehaviorFile } from './behavior';
import { readConstants, readMessages } from './data';
import { normalizeRules } from './normalize';
import { DEFAULT_CROSS_CODE, readValidationFile, type ForeignCode } from './validation';

export type { FileOrigin, ForeignCode };

/** Текст файла модуля: путь от корня модуля. */
export interface ModuleFileText {
  readonly path: string;
  readonly text: string;
}

/** Тексты файлов правил модуля — то, что прочитал загрузчик (`./load`). */
export interface ModuleRuleCode {
  /** `validation/*.ts`, кроме словаря текстов. */
  readonly validation: readonly ModuleFileText[];
  readonly behavior?: ModuleFileText;
  readonly messages?: ModuleFileText;
  readonly constants: readonly ModuleFileText[];
}

/** Файл правил: происхождение, его правила и операторы, которых читатель не знает. */
export interface RuleFileRead {
  readonly path: string;
  readonly origin: FileOrigin;
  readonly rules: FormRules;
  readonly foreign: readonly ForeignCode[];
  /** Нетронутая заготовка из флагов схемы: правил в ней нет. */
  readonly scaffold: boolean;
}

/** Правила модуля из его кода. */
export interface RulesFromCode {
  /** Все правила — в канонической форме (`./normalize`). */
  readonly rules: FormRules;
  /** Файлы валидации и поведения — по одному отчёту. */
  readonly files: readonly RuleFileRead[];
  /** Словарь текстов замечаний (`validation/messages.ts`). */
  readonly messages: Readonly<Record<string, string>>;
}

/** Правила без значений источников и без текстов: то, что нашлось в одном файле. */
function fileRules(partial: Partial<FormRules>): FormRules {
  return { ...emptyRules(), ...partial };
}

/** Текст правила — из словаря формы по его коду (у кросс-полевой без кода — по `cross`). */
function withMessages(rules: FormRules, messages: Readonly<Record<string, string>>): FormRules {
  return {
    ...rules,
    validation: rules.validation.map((rule) => {
      const code = rule.code ?? (rule.cross !== undefined ? DEFAULT_CROSS_CODE : undefined);
      const message = code === undefined ? undefined : messages[code];
      return message === undefined ? rule : { ...rule, message };
    }),
  };
}

/** Сложить правила файлов в один набор. */
function combine(
  files: readonly RuleFileRead[],
  messages: Readonly<Record<string, string>>,
  dataSources: Record<string, unknown>
): FormRules {
  const rules: FormRules = {
    validation: files.flatMap((file) => file.rules.validation),
    behavior: files.flatMap((file) => file.rules.behavior),
    render: files.flatMap((file) => file.rules.render),
    ...(Object.keys(dataSources).length > 0 ? { dataSources } : {}),
  };
  return normalizeRules(withMessages(rules, messages));
}

/** Прочитать правила модуля из текстов его файлов. */
export function readRulesFromCode(code: ModuleRuleCode): RulesFromCode {
  const files: RuleFileRead[] = [];
  for (const file of code.validation) {
    const origin = originOf(file.text);
    const read = readValidationFile(file.text, { scaffold: origin !== 'generated' });
    files.push({
      path: file.path,
      origin,
      rules: fileRules({ validation: read.rules }),
      foreign: read.foreign,
      scaffold: read.scaffold,
    });
  }
  if (code.behavior !== undefined) {
    const read = readBehaviorFile(code.behavior.text);
    files.push({
      path: code.behavior.path,
      origin: originOf(code.behavior.text),
      rules: fileRules({ behavior: read.behavior, render: read.render }),
      foreign: read.foreign,
      scaffold: false,
    });
  }
  const messages = code.messages === undefined ? {} : readMessages(code.messages.text);
  const dataSources: Record<string, unknown> = {};
  for (const file of code.constants) {
    for (const [name, value] of Object.entries(readConstants(file.text))) {
      if (!(name in dataSources)) dataSources[name] = value;
    }
  }
  return { rules: combine(files, messages, dataSources), files, messages };
}

/**
 * Правила, из которых генерация перепечатывает файлы правил: правила нетронутых файлов,
 * тексты и значения источников.
 *
 * Правило из правленного руками файла сюда не входит: генерация его файл не тронет, а его
 * правило, напечатанное ещё раз в другом файле (у визарда правило уходит в файл своего шага),
 * проверялось бы дважды.
 */
export function regenerableRules(read: RulesFromCode): FormRules {
  const generated = read.files.filter((file) => file.origin === 'generated');
  return combine(generated, read.messages, read.rules.dataSources ?? {});
}

/** Файлы правил, правленные руками или написанные человеком, — их генерация не перепечатает. */
export function lockedRuleFiles(read: RulesFromCode): readonly RuleFileRead[] {
  return read.files.filter((file) => file.origin !== 'generated');
}
