# Debouncer

Defined in: [core/utils/debounce.ts:55](https://github.com/AlexandrBukhtatyy/ReFormer/blob/6c591333cce7039afe1dde0903d75315103b9850/packages/reformer/src/core/utils/debounce.ts#L55)

Класс для debouncing (отложенного выполнения) функций

Откладывает выполнение функции на заданное время. Если функция вызывается
повторно до истечения времени, предыдущий вызов отменяется.

Полезно для:
- Отложенной валидации при вводе (debounced validation)
- Отложенного сохранения данных
- Отложенной обработки событий behaviors

## Example

```typescript
// В FieldNode
class FieldNode {
  private validationDebouncer: Debouncer;

  constructor(config) {
    this.validationDebouncer = new Debouncer(config.debounce || 0);
  }

  async validate(): Promise<boolean> {
    return this.validationDebouncer.debounce(async () => {
      // Валидация выполнится через debounce мс
      return await this.runValidation();
    });
  }
}
```

## Constructors

### Constructor

```ts
new Debouncer(delay): Debouncer;
```

Defined in: [core/utils/debounce.ts:73](https://github.com/AlexandrBukhtatyy/ReFormer/blob/6c591333cce7039afe1dde0903d75315103b9850/packages/reformer/src/core/utils/debounce.ts#L73)

Создать Debouncer с заданной задержкой

#### Parameters

##### delay

`number`

Задержка в миллисекундах (0 = без задержки)

#### Returns

`Debouncer`

#### Example

```typescript
const debouncer = new Debouncer(300); // 300мс задержка
const immediate = new Debouncer(0);  // Без задержки
```

## Methods

### cancel()

```ts
cancel(): void;
```

Defined in: [core/utils/debounce.ts:142](https://github.com/AlexandrBukhtatyy/ReFormer/blob/6c591333cce7039afe1dde0903d75315103b9850/packages/reformer/src/core/utils/debounce.ts#L142)

Отменить отложенное выполнение

Если есть запланированный вызов, он будет отменен и не выполнится.
Promise из debounce() никогда не разрешится.

#### Returns

`void`

#### Example

```typescript
const debouncer = new Debouncer(300);

debouncer.debounce(async () => {
  console.log('This will not execute');
});

debouncer.cancel(); // Отменяем вызов
```

***

### debounce()

```ts
debounce<T>(fn): Promise<T>;
```

Defined in: [core/utils/debounce.ts:97](https://github.com/AlexandrBukhtatyy/ReFormer/blob/6c591333cce7039afe1dde0903d75315103b9850/packages/reformer/src/core/utils/debounce.ts#L97)

Отложить выполнение функции

Если вызывается повторно до истечения delay, предыдущий вызов отменяется
и таймер перезапускается.

#### Type Parameters

##### T

`T`

#### Parameters

##### fn

() => `T` \| `Promise`\<`T`\>

Функция для выполнения (может быть async)

#### Returns

`Promise`\<`T`\>

Promise, который разрешается результатом функции

#### Example

```typescript
const debouncer = new Debouncer(300);

// Первый вызов - запланирован через 300мс
debouncer.debounce(async () => console.log('First'));

// Второй вызов через 100мс - отменяет первый, запланирован через 300мс
debouncer.debounce(async () => console.log('Second'));

// Через 300мс выведет только: "Second"
```

***

### flush()

```ts
flush<T>(fn): Promise<T>;
```

Defined in: [core/utils/debounce.ts:171](https://github.com/AlexandrBukhtatyy/ReFormer/blob/6c591333cce7039afe1dde0903d75315103b9850/packages/reformer/src/core/utils/debounce.ts#L171)

Выполнить функцию немедленно, отменив любой отложенный вызов

Полезно когда нужно принудительно выполнить действие сейчас,
игнорируя debounce.

#### Type Parameters

##### T

`T`

#### Parameters

##### fn

() => `T` \| `Promise`\<`T`\>

Функция для немедленного выполнения

#### Returns

`Promise`\<`T`\>

Promise с результатом функции

#### Example

```typescript
const debouncer = new Debouncer(300);

// Запланировано через 300мс
debouncer.debounce(async () => console.log('Delayed'));

// Отменяем отложенный и выполняем немедленно
await debouncer.flush(async () => console.log('Immediate'));
// Выведет: "Immediate" (сразу)
// "Delayed" не выполнится (отменен)
```

***

### isPending()

```ts
isPending(): boolean;
```

Defined in: [core/utils/debounce.ts:194](https://github.com/AlexandrBukhtatyy/ReFormer/blob/6c591333cce7039afe1dde0903d75315103b9850/packages/reformer/src/core/utils/debounce.ts#L194)

Проверить, есть ли активный (запланированный) вызов

#### Returns

`boolean`

true если есть запланированный вызов

#### Example

```typescript
const debouncer = new Debouncer(300);

console.log(debouncer.isPending()); // false

debouncer.debounce(() => console.log('Test'));
console.log(debouncer.isPending()); // true

// Через 300мс
console.log(debouncer.isPending()); // false
```
