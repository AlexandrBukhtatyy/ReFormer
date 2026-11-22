---
sidebar_position: 5
---

# Реакции на изменения

Когда меняется поле, форма делает что-то ещё: загружает варианты выбора, обновляет пропсы
компонента, перепроверяет правила соседнего поля. Это операторы [поведения](../reference/glossary.md)
`onChange` и `revalidateWhen`; вне формы — функция `watchField`.

## Когда нужно

- Сменили страну — загрузить города.
- Сменили сумму — показать подсказку у соседнего поля.
- Сменили пароль — перепроверить «Повторите пароль».

Значение, которое считается из других полей, — не реакция, а [вычисляемое поле](./computed.mdx).

## Пример

```typescript
import { defineFormBehavior, onChange } from '@reformer/core/behaviors';

type Address = { country: string; city: string };

const addressBehavior = defineFormBehavior<Address>(({ model, form }) => {
  onChange(
    model.$.country,
    async (country, { signal }) => {
      model.city = ''; // прежний город в новой стране не нужен
      if (!country) {
        form.city.updateComponentProps({ options: [] });
        return;
      }
      const cities = await fetchCities(country, { signal }); // signal отменит устаревший запрос
      form.city.updateComponentProps({ options: cities });
    },
    { debounce: 300 } // не запрашивать на каждое нажатие клавиши
  );
});
```

## onChange

`onChange(поле, колбэк, { debounce?, immediate? })` вызывает `колбэк(значение, { signal })` после
изменения поля.

| Опция             | По умолчанию | Что делает                                             |
| ----------------- | ------------ | ------------------------------------------------------ |
| `debounce`        | —            | пауза в мс: колбэк ждёт, пока поле перестанет меняться |
| `immediate: true` | `false`      | вызвать колбэк и сразу при подключении поведения       |

- В колбэке можно писать в модель и ноды: `model.city = ''`, `form.city.updateComponentProps(...)`.
- `signal` — `AbortSignal`. Он срабатывает при следующем изменении поля: передайте его в `fetch`,
  и устаревший ответ не перезапишет свежий.
- Оборванный `fetch` бросает `AbortError`. Ошибку, которую колбэк не поймал, `onChange` глотает и
  в режиме разработки пишет в консоль. Чтобы отмена не шумела, ловите ошибку и отсекайте её:
  `catch (error) { if (signal.aborted) return; … }`.

`signal` годится не только для запросов: на нём можно снять любой ресурс при следующем изменении.

```typescript
onChange(model.$.livePreview, (enabled, { signal }) => {
  if (!enabled) return;
  const timer = setInterval(refreshPreview, 1000);
  signal.addEventListener('abort', () => clearInterval(timer));
});
```

## revalidateWhen

Правило над двумя полями (`cross`) проверяет снимок формы и за соседним полем само не следит. Без
живой [стратегии](../validation/validation-strategies.md) замечание «Пароли не совпадают»
останется, даже когда пароль уже исправили. `revalidateWhen(поля, колбэк)` вызывает колбэк при
изменении любого из полей, а колбэк запускает проверку тех же правил:

```typescript
import { defineFormBehavior, revalidateWhen } from '@reformer/core/behaviors';
import { validateModel } from '@reformer/core/validation';
import { registrationRules } from './registration.validation'; // те же правила, что в createForm

const registrationBehavior = defineFormBehavior<Registration>(({ model }) => {
  revalidateWhen([model.$.password], () => void validateModel(model, registrationRules));
});
```

- В список передавайте поля, от которых зависит правило, а не само проверяемое поле.
- При подключении поведения колбэк не вызывается — только при изменениях.

## watchField — без формы

`watchField(сигнал, колбэк, { immediate? })` из `@reformer/core/model` — подписка на изменение без
паузы и без `signal`. Она возвращает функцию отписки и нужна там, где нет `defineFormBehavior`:
модель без формы, свой эффект.

```typescript
import { watchField } from '@reformer/core/model';

const stop = watchField(model.$.country, () => {
  model.city = '';
});
// stop() — отписаться
```

Источником может быть и группа, и вся модель: `watchField(model.$.address, …)` срабатывает на любое
поле адреса, `watchField(model.$, …)` — на любое поле формы.

## Подводные камни

- **Производное значение — через `compute`, а не `onChange`.** У `compute` есть защита от лишних
  записей и циклов.
- **Сбрасывайте зависимое поле.** Сменили страну — очистите город, иначе останется значение,
  которого нет в новом списке.
- **`onChange` не срабатывает при подключении.** Чтобы загрузить варианты для начального значения,
  передайте `{ immediate: true }`.

## См. также

- [Асинхронная предзагрузка](../patterns/async-preload.md) — загрузка значений и справочников.
- [Стратегии валидации](../validation/validation-strategies.md) — живая перепроверка правил.
- [Вычисляемые поля](./computed.mdx) — значение из других полей.
