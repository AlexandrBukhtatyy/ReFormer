/**
 * Compile-time тест модели `FormModel<T>`. Проверяется `tsc` (файл под `src`, `include: ["src"]`);
 * vitest его НЕ запускает — нет суффикса `.test.`.
 *
 * Убеждается, что:
 *  - value-доступ отдаёт лист значением, группу — под-моделью, массив — фасадом `ModelArray`, а
 *    ручки `model.$` — сигналами с путём;
 *  - `set(T)` требует значение целиком, а `patch(DeepPartial<T>)` — любые ключи на любой глубине, но
 *    массив целиком;
 *  - `ModelArray` (`push`, `at`, `insertAt`, `move`, …) проверяет элементы по типу строки;
 *  - `signalAt` по строковому пути типа не знает, а `get()` отдаёт снимок формы данных;
 *  - поле-массив целиком (`string[]`) и поле из начального `null` (`File[] | null`) типизированы так,
 *    как ведут себя в рантайме.
 *
 * Дефекты типов размечены `[ReFormer-xxxx]`: строка под `@ts-expect-error` с меткой обязана
 * компилироваться после исправления, строка с меткой в комментарии — перестать компилироваться.
 */

import { createModel } from './create-model';
import { arrayOf } from './model-nodes';
import type {
  DeepPartial,
  FormModel,
  ModelArray,
  ModelArraySignals,
  ModelGroupSignals,
  PathAwareSignal,
} from './types';

interface Address {
  city: string;
  street: string;
}
interface Phone {
  number: string;
}
interface Profile {
  name: string;
  /** Пустое числовое поле — `null`. */
  age: number | null;
  birthDate: Date;
  note?: string;
  address: Address;
  phones: Phone[];
  /** Массив как значение поля: мультивыбор. */
  tags: string[];
  /** Поле файлов: до загрузки — `null`. */
  files: File[] | null;
  /** Необязательная группа: до заполнения — `null`. */
  spare: Address | null;
}

/** Доступ к полям: значение, под-модель, фасад массива и ручки `$`. */
export function fieldAccessTypeChecks(model: FormModel<Profile>): void {
  const name: string = model.name;
  const age: number | null = model.age;
  const birthDate: Date = model.birthDate;
  const note: string | undefined = model.note;
  const address: FormModel<Address> = model.address;
  const city: string = model.address.city;
  const phones: ModelArray<Phone> = model.phones;
  // Лист пишется присваиванием значения своего типа.
  model.name = 'Анна';
  model.address.city = 'Казань';
  model.age = null;
  // @ts-expect-error — тип значения поля
  model.age = '42';
  // @ts-expect-error — такого поля в форме данных нет
  void model.surname;
  // @ts-expect-error — пустое значение из типа листа не пропадает
  const strictAge: number = model.age;
  // @ts-expect-error — необязательное поле читается с `undefined`
  const strictNote: string = model.note;

  // Ручки `$`: лист — сигнал с путём, группа — узел детей, массив — ручка значения целиком.
  const nameHandle: PathAwareSignal<string> = model.$.name;
  const path: string = model.$.address.city.__path;
  const addressHandle: ModelGroupSignals<Address> = model.$.address;
  const addressValue: Address = model.$.address.value;
  const tagsHandle: ModelArraySignals<string, string[]> = model.$.tags;
  const firstTag: PathAwareSignal<string> = model.$.tags[0];
  const firstNumber: PathAwareSignal<string> = model.$.phones[0].number;
  model.$.tags.value = ['vip'];
  // Под-модель группы и узел `$` группы — одни и те же ручки.
  const sameHandle: PathAwareSignal<string> = model.address.$.city;
  // @ts-expect-error — группа читается целиком, но пишется по полям или через `patch`
  model.$.address.value = { city: 'Казань', street: 'Ленина' };

  // поведение под вопросом: контейнер (группа, массив) в рантайме пишется присваиванием целиком,
  // но читается фасадом, а mapped type не задаёт отдельный тип записи — путь записи массива
  // целиком — `model.$.<массив>.value`, группы — `patch`.
  // @ts-expect-error — массив целиком присваиванием тип не пускает
  model.tags = ['vip'];

  void [name, age, birthDate, note, address, city, phones, nameHandle, path, addressHandle];
  void [addressValue, tagsHandle, firstTag, firstNumber, sameHandle, strictAge, strictNote];
}

/** `set` — значение целиком; `patch` — частичное слияние, массив целиком. */
export function setAndPatchTypeChecks(model: FormModel<Profile>): void {
  model.set({ ...model.get(), name: 'Анна' });
  model.patch({ address: { city: 'Казань' } });
  model.patch({ phones: [{ number: '+7' }], files: null, spare: { city: 'Казань' } });
  const update: DeepPartial<Profile> = { address: { street: 'Ленина' }, age: null };
  model.patch(update);
  // Под-модель — тот же API.
  model.address.patch({ city: 'Казань' });
  model.address.set({ city: 'Казань', street: 'Ленина' });

  // @ts-expect-error — `set` ждёт значение целиком: частичное обновление — `patch`
  model.set({ name: 'Анна' });
  // @ts-expect-error — массив не сливается поэлементно: элемент передают целиком
  model.patch({ phones: [{}] });
  // @ts-expect-error — неизвестный ключ вложенной группы
  model.patch({ address: { zip: '420000' } });
  // @ts-expect-error — тип значения ключа
  model.patch({ age: '42' });
  // @ts-expect-error — `set` под-модели — тоже значение целиком
  model.address.set({ city: 'Казань' });
}

/** Фасад массива: мутации и обход с типом строки. */
export function modelArrayTypeChecks(model: FormModel<Profile>): void {
  model.phones.push({ number: '+7' });
  // Без значения — элемент по шаблону `arrayOf`.
  model.phones.push();
  model.phones.insertAt(0, { number: '+7' });
  model.phones.insertAt(1);
  model.phones.move(0, 1);
  model.phones.swap(0, 1);
  model.phones.removeAt(0);
  model.phones.clear();
  // at: строка-объект — под-модель, лист — значение или `undefined`.
  const phone: FormModel<Phone> = model.phones.at(0);
  const byIndex: FormModel<Phone> = model.phones[0];
  const numbers: string[] = model.phones.map((item) => item.number);
  model.phones.forEach((item, index) => void [item.$.number, index]);
  const plain: Phone[] = model.phones.toArray();
  const length: number = model.phones.length;
  const arrayPath: string = model.phones.__path;

  // @ts-expect-error — у телефона нет поля `type`: элемент проверяется по типу строки
  model.phones.push({ type: 'mobile' });
  // @ts-expect-error — вставка — тоже элемент целиком
  model.phones.insertAt(0, {});
  // @ts-expect-error — индексы — числа
  model.phones.move('0', 1);
  // @ts-expect-error — фасад массива — не `Array`: методов массива, кроме перечисленных, нет
  model.phones.filter(Boolean);
  // поведение под вопросом: за пределами массива рантайм отдаёт `undefined`, а тип строки-объекта
  // `undefined` не включает — в отличие от строки-листа (ниже) и от `FormArray.at`.
  const missing: FormModel<Phone> = model.phones.at(99);

  void [phone, byIndex, numbers, plain, length, arrayPath, missing];
}

/** `signalAt` и `get`: путь строкой — без типа; снимок — форма данных. */
export function pathAndSnapshotTypeChecks(model: FormModel<Profile>): void {
  const bySignal: PathAwareSignal<unknown> | undefined = model.signalAt('address.city');
  const snapshot: Profile = model.get();
  const subSnapshot: Address = model.address.get();
  const dirty: boolean = model.isDirty();
  model.reset();
  model.captureInitial();

  // @ts-expect-error — путь строкой не типизирован: значение сигнала — `unknown`
  const typedByPath: PathAwareSignal<string> | undefined = model.signalAt('name');
  // @ts-expect-error — путь — строка через точку
  model.signalAt(['address', 'city']);
  // @ts-expect-error — снимок — значения, а не модель
  const facade: FormModel<Profile> = model.get();

  void [bySignal, snapshot, subSnapshot, dirty, typedByPath, facade];
}

/** `createModel`: форма данных выводится из начальных значений либо задаётся явно. */
export function createModelTypeChecks(): void {
  const inferred = createModel({ title: '', items: arrayOf(() => ({ quantity: 0 })) });
  const quantity: number = inferred.items.at(0).quantity;
  const title: string = inferred.title;
  const explicit: FormModel<Address> = createModel<Address>({ city: '', street: '' });

  // @ts-expect-error — начальные значения — целиком
  createModel<Address>({ city: '' });
  // @ts-expect-error — шаблон строки — элемент того же типа
  createModel<{ phones: Phone[] }>({ phones: arrayOf(() => ({ code: '' })) });

  void [quantity, title, explicit];
}

/** Массив целиком (`string[]`) и поле из начального `null` (`File[] | null`, `Address | null`). */
export function arrayValueTypeChecks(model: FormModel<Profile>): void {
  // string[]: фасад массива строк и ручка значения целиком.
  const tags: ModelArray<string> = model.tags;
  model.tags.push('vip');
  // Лист за пределами массива — `undefined`.
  const firstTag: string | undefined = model.tags.at(0);
  const tagValues: string[] = model.$.tags.value;
  // @ts-expect-error — элемент — строка
  model.tags.push(1);
  // @ts-expect-error — лист за пределами массива — `undefined`
  const strictTag: string = model.tags.at(0);
  // Фасад итерируем: `for…of` и spread дают элементы, как `forEach` [ReFormer-ix06].
  for (const tag of model.tags) {
    const iterated: string = tag;
    void iterated;
  }
  const spreadPhones: FormModel<Phone>[] = [...model.phones];

  // File[] | null: ручка честная — значение поля целиком, включая `null`.
  const files: File[] | null = model.$.files.value;
  model.$.files.value = null;
  model.$.files.value = [new File([], 'passport.pdf')];
  // поведение под вопросом: длина и индексы у ручки есть только при начальном массиве; у поля из
  // `null` ручка — лист, `length` в рантайме `undefined` (оговорено в JSDoc `ModelArraySignals`).
  const handleLength: number = model.$.files.length;

  // Value-фасад: `ModelValue<File[] | null>` сейчас — `ModelArray<File>` без `null`, а в рантайме
  // поле из начального `null` — лист: значение `null` или обычный массив после записи.
  // [ReFormer-sme2] сейчас компилируется, а не должно: фасада массива у поля из `null` нет.
  const filesFacade: ModelArray<File> = model.files;
  // [ReFormer-sme2] сейчас компилируется, а не должно: `null.length` — TypeError в рантайме.
  void model.files.length;
  // @ts-expect-error [ReFormer-sme2] запись `null` в поле `File[] | null` должна компилироваться
  model.files = null;
  // То же у группы `Address | null`: тип — под-модель без `null`.
  // [ReFormer-sme2] сейчас компилируется, а не должно: у группы из `null` в рантайме значение `null`.
  void model.spare.city;

  void [tags, firstTag, tagValues, strictTag, spreadPhones, files, handleLength, filesFacade];
}
