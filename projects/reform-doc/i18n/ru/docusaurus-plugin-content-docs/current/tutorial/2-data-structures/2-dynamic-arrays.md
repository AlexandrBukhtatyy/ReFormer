---
sidebar_position: 2
---

# Динамические массивы

В этом уроке вы узнаете, как работать со списками элементов, которые пользователи могут добавлять, удалять и переупорядочивать с помощью `ArrayNode`.

## Что вы узнаете

- Как создавать массивы полей с помощью `ArrayNode`
- Как динамически добавлять и удалять элементы
- Как валидировать элементы массива
- Как работать с массивами в React-компонентах

## Зачем использовать ArrayNode?

Многим формам требуется обрабатывать списки элементов:

- Список контактов с несколькими номерами телефонов
- Форма заказа с несколькими товарами
- Резюме с несколькими местами работы
- Форма с несколькими прикрепленными файлами

`ArrayNode` управляет этими динамическими списками за вас.

## Создание поля-массива

Создадим форму для управления списком телефонных номеров:

```typescript title="src/components/PhoneListForm/form.ts"
import { GroupNode } from 'reformer';
import { required, pattern } from 'reformer/validators';

interface PhoneNumber {
  type: string;
  number: string;
}

interface ContactFormData {
  name: string;
  phones: PhoneNumber[];
}

const phonePattern = /^\+?[\d\s\-()]+$/;

export const contactForm = new GroupNode<ContactFormData>({
  form: {
    name: { value: '' },
    phones: [
      {
        type: { value: 'mobile' },
        number: { value: '' },
      },
    ],
  },
  validation: (path) => {
    required(path.name);

    required(path.phones.$each.type);
    required(path.phones.$each.number);
    pattern(path.phones.$each.number, phonePattern);
  },
});
```

### Понимание ArrayNode

- **Синтаксис массива `[{...}]`** — определяет схему элементов массива
- **Шаблон элемента** — объект внутри `[]` определяет структуру каждого элемента массива
- **Автоматическое преобразование** — ReFormer автоматически преобразует схему массива в `ArrayNode`
- **`$each`** — специальный сегмент пути для валидации всех элементов массива
- **Каждый элемент — это узел** — может быть полем, группой или даже другим массивом

## Добавление и удаление элементов

`ArrayNode` предоставляет методы для манипуляции массивом:

```typescript
const phones = contactForm.controls.phones;

// Добавить новый номер телефона
phones.push();

// Получить длину массива
console.log(phones.length); // 1

// Получить доступ к элементу массива
console.log(phones.at(0).value);
// { type: 'mobile', number: '' }

// Удалить элемент по индексу
phones.removeAt(0);

// Вставить элемент в определенную позицию
phones.insertAt(1);

// Очистить все элементы
phones.clear();
```

## React-компонент

Создадим компонент, позволяющий пользователям управлять номерами телефонов:

```tsx title="src/components/PhoneListForm/index.tsx"
import { useFormControl } from 'reformer';
import { contactForm } from './form';

export function PhoneListForm() {
  const name = useFormControl(contactForm.controls.name);
  const phones = useFormControl(contactForm.controls.phones);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    contactForm.markAsTouched();

    if (!contactForm.valid) {
      return;
    }

    console.log('Данные контакта:', contactForm.value);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="name">Имя</label>
        <input
          id="name"
          value={name.value}
          onChange={(e) => name.setValue(e.target.value)}
          onBlur={() => name.markAsTouched()}
        />
        {name.touched && name.errors?.required && <span className="error">Имя обязательно</span>}
      </div>

      <div>
        <h3>Номера телефонов</h3>

        {phones.items.map((phone, index) => {
          const phoneNode = useFormControl(phone);
          const type = useFormControl(phone.controls.type);
          const number = useFormControl(phone.controls.number);

          return (
            <div
              key={phone.id}
              style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #ccc' }}
            >
              <div>
                <label>Тип</label>
                <select value={type.value} onChange={(e) => type.setValue(e.target.value)}>
                  <option value="mobile">Мобильный</option>
                  <option value="home">Домашний</option>
                  <option value="work">Рабочий</option>
                </select>
              </div>

              <div>
                <label>Номер</label>
                <input
                  value={number.value}
                  onChange={(e) => number.setValue(e.target.value)}
                  onBlur={() => number.markAsTouched()}
                  placeholder="+7 123 456 7890"
                />
                {number.touched && number.errors?.required && (
                  <span className="error">Номер обязателен</span>
                )}
                {number.touched && number.errors?.pattern && (
                  <span className="error">Некорректный формат телефона</span>
                )}
              </div>

              <button type="button" onClick={() => phones.removeAt(index)}>
                Удалить
              </button>
            </div>
          );
        })}

        <button type="button" onClick={() => phones.push()}>
          Добавить номер телефона
        </button>
      </div>

      <button type="submit" disabled={!contactForm.valid}>
        Сохранить контакт
      </button>
    </form>
  );
}
```

### Работа с элементами массива

- **`phones.items`** — массив дочерних узлов для итерации
- **`phone.id`** — уникальный ID для каждого элемента массива (используйте как React key)
- **`useFormControl(phone)`** — подписка на изменения отдельного элемента
- **`phones.push()`** — добавляет новый элемент
- **`phones.removeAt(index)`** — удаляет элемент по индексу

## Валидация массива

Можно валидировать все элементы массива с помощью `$each`:

```typescript
validation: (path) => {
  // Валидация каждого номера телефона в массиве
  required(path.phones.$each.type);
  required(path.phones.$each.number);
  pattern(path.phones.$each.number, phonePattern);
};
```

Сегмент `$each` указывает ReFormer применить валидацию к каждому элементу массива.

## Доступ к данным массива

```typescript
// Получить значение всего массива
console.log(contactForm.controls.phones.value);
// [
//   { type: 'mobile', number: '+7 123 456 7890' },
//   { type: 'home', number: '+7 987 654 3210' }
// ]

// Получить конкретный элемент
console.log(contactForm.controls.phones.at(0).value);
// { type: 'mobile', number: '+7 123 456 7890' }

// Получить длину массива
console.log(contactForm.controls.phones.length);
// 2

// Проверить, валиден ли массив
console.log(contactForm.controls.phones.valid);
// true
```

## Вложенные массивы

Массивы могут содержать любой тип узлов, включая другие массивы или группы:

```typescript
interface OrderFormData {
  items: {
    product: string;
    quantity: number;
    variants: string[]; // Вложенный массив!
  }[];
}

export const orderForm = new GroupNode<OrderFormData>({
  form: {
    items: [
      {
        product: { value: '' },
        quantity: { value: 1 },
        variants: [{ value: '' }], // Вложенный массив строк
      },
    ],
  },
});
```

## Попробуйте

1. Нажмите "Добавить номер телефона" → появится новая запись телефона
2. Заполните данные телефона → значения обновятся реактивно
3. Добавьте несколько телефонов → увидите, как растет массив
4. Удалите телефон → массив обновится мгновенно
5. Попробуйте отправить с некорректным номером → увидите валидацию

## Ключевые концепции

- **Синтаксис массива `[{...}]`** — определяет схему массива с шаблоном элемента
- **Автоматические массивы** — ReFormer автоматически преобразует схемы массивов в `ArrayNode`
- **`push()`** — добавляет новый элемент в массив
- **`removeAt(index)`** — удаляет элемент по индексу
- **`at(index)`** — получает доступ к элементу по индексу
- **`items`** — массив дочерних узлов для итерации
- **`$each`** — валидирует все элементы массива
- **`item.id`** — уникальный идентификатор для React keys

## Что дальше?

Отличная работа! Вы освоили структуры данных. В следующем разделе мы изучим **Продвинутые возможности**, такие как вычисляемые поля, условная логика и асинхронная валидация.
