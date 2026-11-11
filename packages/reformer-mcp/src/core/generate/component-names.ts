/**
 * Имя компонента, которого нет в ките: какой компонент кита имелся в виду.
 *
 * Модель пишет имя по памяти: в другом регистре (`input`), из другой библиотеки (`TextField` из MUI,
 * `Dropdown`) или словами (`текстовое поле`). Регистр сборка исправляет сама — имя однозначно.
 * Синоним только подсказывается в ошибке: `TextField` бывает и `Input`, и `Textarea`, выбор за
 * моделью (ReFormer-11oe.19).
 *
 * Таблица синонимов называет компоненты, но не объявляет их: подсказка — только имя, которое есть в
 * установленном каталоге кита. Компонент, которого кит не поставляет, не подсказывается.
 *
 * @module reformer-mcp/core/generate/component-names
 */

import { nearestKey } from './intent-messages.js';

/** Имя из `names`, равное `name` без учёта регистра; `null` — такого нет. */
export function nameIgnoringCase(name: string, names: Iterable<string>): string | null {
  const lower = name.toLowerCase();
  for (const candidate of names) {
    if (candidate.toLowerCase() === lower) return candidate;
  }
  return null;
}

/**
 * Синонимы → компоненты кита в порядке предпочтения. Ключи — в виде {@link synonymKey}: без регистра,
 * пробелов и знаков (`text-field`, `Text Field` и `TextField` — один ключ). Имя самого кита ключом
 * не бывает: его исправляет регистр.
 */
export const SYNONYM_GROUPS: ReadonlyArray<readonly [readonly string[], readonly string[]]> = [
  // Поля ввода.
  [
    [
      'textfield',
      'textinput',
      'textbox',
      'inputtext',
      'inputfield',
      'stringinput',
      'emailinput',
      'emailfield',
      'urlinput',
      'searchinput',
      'текстовоеполе',
      'текстовоеполеввода',
      'полеввода',
      'строкаввода',
    ],
    ['Input', 'Textarea'],
  ],
  [
    [
      'multiline',
      'multilinetext',
      'multilineinput',
      'longtext',
      'textareafield',
      'многострочноеполе',
      'многострочныйтекст',
      'текстоваяобласть',
    ],
    ['Textarea'],
  ],
  [
    [
      'numberinput',
      'numberfield',
      'numericinput',
      'numeric',
      'number',
      'integerinput',
      'currencyinput',
      'moneyinput',
      'amountinput',
      'числовоеполе',
      'число',
    ],
    ['InputNumber'],
  ],
  [['password', 'passwordinput', 'passwordfield', 'пароль', 'полепароля'], ['InputPassword']],
  [
    ['maskedinput', 'inputmasked', 'phoneinput', 'phonefield', 'telinput', 'телефон'],
    ['InputMask', 'Input'],
  ],
  [['otp', 'otpinput', 'pininput', 'pincode', 'codeinput', 'verificationcode'], ['InputOTP']],
  [
    ['autocomplete', 'autosuggest', 'typeahead', 'suggest', 'автодополнение'],
    ['InputSuggest', 'Combobox'],
  ],
  [['date', 'dateinput', 'datefield', 'dateselect', 'datetimepicker', 'дата'], ['DatePicker']],
  [['daterange', 'daterangepicker', 'rangepicker', 'период'], ['DatePickerRange']],
  [
    ['file', 'fileinput', 'filepicker', 'fileselect', 'upload', 'uploader', 'fileuploader', 'файл'],
    ['FileUpload', 'FileUploadDropzone'],
  ],
  [['filedropzone', 'dragdrop', 'draganddrop'], ['FileUploadDropzone']],
  [['avatarupload', 'photoupload', 'imageupload'], ['FileUploadAvatar']],
  // Выбор.
  [
    [
      'dropdown',
      'dropdownlist',
      'selectbox',
      'selectfield',
      'selectinput',
      'singleselect',
      'picker',
      'listbox',
      'выпадающийсписок',
      'список',
    ],
    ['Select', 'Combobox'],
  ],
  [
    ['multiselect', 'multipleselect', 'tagsinput', 'taginput', 'chipsinput', 'мультивыбор'],
    ['SelectMulti', 'ComboboxMulti'],
  ],
  [
    [
      'radio',
      'radios',
      'radiobutton',
      'radiobuttons',
      'radiobuttongroup',
      'radiolist',
      'радиокнопки',
    ],
    ['RadioGroup'],
  ],
  [
    ['segmented', 'segmentedcontrol'],
    ['ToggleGroup', 'RadioGroup'],
  ],
  [['check', 'checkboxfield', 'tick', 'флажок', 'галочка', 'чекбокс'], ['Checkbox']],
  [['toggleswitch', 'onoff', 'switchfield', 'переключатель', 'тумблер'], ['Switch']],
  [['range', 'rangeslider', 'rangeinput', 'ползунок', 'слайдер'], ['Slider']],
  // Раскладка.
  [
    [
      'container',
      'div',
      'view',
      'stack',
      'vstack',
      'hstack',
      'flex',
      'grid',
      'row',
      'column',
      'col',
      'wrapper',
      'layout',
      'panel',
      'group',
      'block',
      'контейнер',
      'блок',
      'группа',
    ],
    ['Box', 'Section'],
  ],
  [['paper', 'tile', 'карточка'], ['Card']],
  [['formsection', 'раздел', 'секция'], ['Section']],
  [['tab', 'tabpanel', 'tabview', 'tabset', 'вкладки', 'вкладка'], ['Tabs']],
  [
    ['expander', 'expansionpanel', 'disclosure', 'details', 'spoiler', 'аккордеон'],
    ['Accordion', 'Collapsible'],
  ],
  [['stepper', 'steps', 'мастер', 'шаги'], ['FormWizard']],
  [['repeater', 'fieldlist', 'arrayfield', 'formlist', 'dynamiclist'], ['FieldArray']],
  // Текст и оформление.
  [['divider', 'hr', 'разделитель'], ['Separator']],
  [
    ['heading', 'title', 'header', 'заголовок'],
    ['TypographyH2', 'TypographyH3'],
  ],
  [['h1'], ['TypographyH1']],
  [['h2'], ['TypographyH2']],
  [['h3'], ['TypographyH3']],
  [['h4'], ['TypographyH4']],
  [['text', 'paragraph', 'textblock', 'typography', 'абзац', 'текст'], ['TypographyP']],
  [
    ['hint', 'helptext', 'help', 'подсказка'],
    ['InfoHint', 'Tooltip'],
  ],
  [['chip', 'tag', 'тег'], ['Badge']],
  [['loader', 'loading', 'spin', 'спиннер'], ['Spinner']],
  [
    ['modal', 'popup', 'модальноеокно', 'диалог'],
    ['Dialog', 'Sheet'],
  ],
  [['datatable'], ['DataGrid', 'Table']],
  [['btn', 'submit', 'submitbutton', 'кнопка'], ['Button']],
];

/** Ключ синонима: без регистра, пробелов, дефисов и прочих знаков. */
export function synonymKey(name: string): string {
  return name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

const SYNONYMS: ReadonlyMap<string, readonly string[]> = new Map(
  SYNONYM_GROUPS.flatMap(([keys, components]) => keys.map((key) => [key, components] as const))
);

/**
 * Компоненты кита, которые, вероятно, имелись в виду под `name`: то же имя в другом регистре,
 * опечатка, затем синоним. Пусто — подсказать нечего.
 *
 * @param kitNames - Имена каталога кита: подсказка называет только их.
 */
export function suggestComponents(name: string, kitNames: readonly string[]): string[] {
  const inCase = nameIgnoringCase(name, kitNames);
  if (inCase) return inCase === name ? [] : [inCase];
  const known = new Set(kitNames);
  const synonyms = (SYNONYMS.get(synonymKey(name)) ?? []).filter((component) =>
    known.has(component)
  );
  if (synonyms.length > 0) return synonyms;
  const near = nearestKey(name, new Map(kitNames.map((kitName) => [kitName, kitName])));
  return near ? [near] : [];
}

/** «did you mean `Input`?» / «did you mean `Input` or `Textarea`?»; пусто — подсказки нет. */
export function didYouMean(suggestions: readonly string[]): string {
  if (suggestions.length === 0) return '';
  const names = suggestions.map((name) => `\`${name}\``);
  const list =
    names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} or ${names.at(-1)}`;
  return `did you mean ${list}?`;
}
