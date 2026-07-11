# Аудит компонентов: Варианты и Примеры

**Вариант** = функциональная форма компонента (дефолтная + кастомизации), привязанная к реальному API — то, что можно собрать через props высокоуровневого компонента ИЛИ ручной композицией из под-компонентов. Состояния (пусто/заполнено/disabled/invalid) и стилизация (size/color/width/theme) — НЕ варианты.

**Пример** = рецепт использования возможности/поведения (data provider, clearable, валидация, зависимое поведение, нормализация значения, hooks, asChild).

Формы, недостижимые текущим API, вынесены в раздел **TODO (нужна доработка компонента)**.

---

## Input

### Варианты (6)

| # | Вариант | Форма | Сборка | Описание |
|---|---|---|---|---|
| 1 | Текст | Строковая форма по умолчанию (type=text), value: string | null | props | Дефолтная строковая раскладка ввода. |
| 2 | Email | type=email — почтовый режим ввода | props | Почтовая раскладка/семантика поля. |
| 3 | Телефон | type=tel — телефонный режим ввода | props | Цифровая клавиатура на мобильных. |
| 4 | URL | type=url — режим ввода ссылки | props | URL-раскладка. |
| 5 | Число | type=number — числовой режим, value: number | null | props | Числовой парсинг + буфер промежуточного ввода. |
| 6 | Пароль | type=password — нативно маскируемый ввод | props | Маскировка значения без встроенного toggle (toggle — у InputPassword). |

### Примеры (6)

| # | Пример | Возможность | Описание |
|---|---|---|---|
| 1 | Привязка к форме с валидацией | валидация (required/email) + M1-поток | createModel → schema → createForm → FormField, ошибки после markAsTouched. |
| 2 | Нормализация пустого значения в null | нормализация значения (→null) | Пустая строка эмитится как null (value || null), а не как "". |
| 3 | Числовое поле и реактивное чтение значения | hooks (useFormControlValue) | Реактивное чтение number | null. |
| 4 | Промежуточный / неканонический числовой ввод | number-буфер | Удержание «1.50»/«1.»/ведущих нулей; onChange эмитит только валидное число. |
| 5 | Зажим отрицательных к нулю | нормализация числа при min>=0 | resolveEmittedNumber зажимает отрицательный ввод к 0. |
| 6 | Ручная headless-привязка через useFormControl | headless / hooks | Без FormField: сами читаем value/disabled/errors/shouldShowError. |

<details><summary>Убрано из Variants (состояния — теперь в API-табе)</summary>

- placeholder (С подсказкой) — пустое состояние с хинтом
- filled (Заполнено) — состояние с введённым значением
- invalid (Ошибка) — состояние ошибки (touched + проваленный валидатор)
- disabled-empty (Отключено, пустое) — disabled-состояние
- readonly (Только чтение) — disabled+заполненное состояние

</details>


## InputPassword

### Варианты (2)

| # | Вариант | Форма | Сборка | Описание |
|---|---|---|---|---|
| 1 | С переключателем видимости | Дефолтная форма ввода пароля: showToggle=true — при непустом value есть кнопка reveal (eye/eye-off) | props | initial='secret123', componentProps={ label, placeholder }. showToggle не задаётся (true по умолчанию); значение непустое, чтобы демонстрировать наличие кнопки переключения — это конфигурация формы, а не state-карточка. |
| 2 | Без переключателя | Форма showToggle={false} — паттерн «повторите пароль»: значение всегда маскировано, reveal-кнопки нет | props | componentProps={ label:'Повторите пароль', showToggle:false }. Контрастирует с дефолтной формой отсутствием кнопки reveal — вторая (и единственная другая) форма компонента по API. |

### Примеры (3)

| # | Пример | Возможность | Описание |
|---|---|---|---|
| 1 | Переключение видимости пароля | password reveal | Приём reveal: кнопка eye переключает type password ↔ text; состояние показа локально в компоненте (React.useState внутри InputPassword). |
| 2 | Валидация: обязательность и минимальная длина | validation (required + minLength) с harness touched | Рецепт привязки валидаторов ReFormer; на touched-поле провал minLength(8) включает invalid-состояние (destructive рамка/ring). Показано через harness-флаг touched:true — это демонстрация рецепта, не state-вариант. |
| 3 | Нормализация пустого значения в null | value normalization → null | onChange в компоненте приводит '' к null; очищенное поле даёт null, а не пустую строку — удобно для required и чистой form-data. |

<details><summary>Убрано из Variants (состояния — теперь в API-табе)</summary>

- empty (Пустое поле — state «пусто»)
- filled (Заполнено, с переключателем — state «заполнено»; суть переключателя теперь в варианте with-toggle и примере reveal)
- disabled (Disabled — state, показывается в интерактивной вкладке API через контрол disabled)
- invalid (С ошибкой — state «invalid», перенесён в Examples как рецепт валидации с touched)

</details>


## InputMask

### Варианты (3)

| # | Вариант | Форма | Сборка | Описание |
|---|---|---|---|---|
| 1 | Телефон | Дефолтная форма — маска телефона '+7 (999) 999-99-99' | props | Форма по умолчанию: маска телефона через componentProps.mask. «9» — цифра, символы +, (, ), -, пробел — литералы placeholder. |
| 2 | Дата | Маска даты '99.99.9999' с кастомным placeholder | props | Другая конфигурация маски + placeholder, переопределяющий подсказку-маску текстом формата ДД.ММ.ГГГГ. |
| 3 | Номер карты | Маска банковской карты '9999 9999 9999 9999' | props | Форма маски карты: четыре группы по четыре цифры через componentProps.mask. |

### Примеры (2)

| # | Пример | Возможность | Описание |
|---|---|---|---|
| 1 | Проверка формата валидатором | Валидация (required + pattern) | Маска — только UI-подсказка и не форсирует ввод; реальный формат проверяет валидатор pattern. Показан рецептом в состоянии touched (harness-флаг touched:true), а не как state-вариант. |
| 2 | Пустое поле → null | Нормализация значения (пустая строка → null) | onChange приводит пустую строку к null; реактивно читается через useFormControlValue — удобно для необязательных полей и условной валидации. |

<details><summary>Убрано из Variants (состояния — теперь в API-табе)</summary>

- filled (заполнено — состояние)
- disabled (заблокировано — состояние)
- invalid (ошибка — состояние, перенесено в Examples как рецепт валидации с touched)

</details>


## Textarea

### Варианты (2)

| # | Вариант | Форма | Сборка | Описание |
|---|---|---|---|---|
| 1 | С подписью | Дефолтная форма: подпись сверху (componentProps.label) + многострочное поле с placeholder | props | Базовая раскладка field-bound Textarea через makeFieldVariant — label над контролом, placeholder внутри. Пустое initial здесь не «состояние пусто», а нейтральная дефолтная форма. |
| 2 | Без подписи | Форма без label — только placeholder-подсказка внутри поля | props | Вторая (и единственная другая) структурная ось Textarea — раскладка подписи: label опущен, остаётся placeholder. Отличается от дефолта только наличием/отсутствием label. |

### Примеры (3)

| # | Пример | Возможность | Описание |
|---|---|---|---|
| 1 | Обязательное поле с бизнес-лимитом длины | валидация (required + maxLength бизнес-правило) | Валидаторы @reformer/core: required() и maxLength(500) как бизнес-правило (в отличие от нативного props maxLength). Показано с harness-флагом touched:true, чтобы отрендерить текст ошибки — это демонстрация рецепта валидации, не state-вариант. |
| 2 | Счётчик оставшихся символов | реактивное чтение значения (hooks) + нативный maxLength | useFormControlValue реактивно читает value контрола; нативный maxLength даёт hard-cap ввода. Локальный render-компонент CharCounterExample. Также покрывает возможность maxLength (ранее ошибочно жившую как отдельный variant). |
| 3 | Нормализация текста на потере фокуса | нормализация значения (onBlur trim + схлопывание пробелов) | onBlur тримит значение и схлопывает лишние пробелы/переводы строк при уходе из поля. Локальный render-компонент NormalizeOnBlurExample на useState. |

<details><summary>Убрано из Variants (состояния — теперь в API-табе)</summary>

- filled — «Заполнено» (состояние заполненного поля)
- invalid — «Ошибка» (invalid-состояние через minLength + touched)
- disabled — «Заблокировано» (disabled-состояние, пустое)
- disabled-filled — «Заблокировано с текстом» (disabled-состояние с контентом)

</details>


## Checkbox

### Варианты (2)

| # | Вариант | Форма | Сборка | Описание |
|---|---|---|---|---|
| 1 | С подписью | Дефолтная форма чекбокса: контрол + подпись справа через prop label | props | componentProps.label задаёт подпись. FormField детектит Checkbox и не рендерит дублирующий верхний Label — это базовое устройство компонента. |
| 2 | Только контрол (без подписи) | Форма без label: рендерится один квадрат-контрол, подпись собирает потребитель снаружи | props | componentProps без label. Раскладка меняется — контрол без встроенной метки; резолвится aria-labelledby на внешнюю разметку. Это структурная форма, не состояние. |

### Примеры (3)

| # | Пример | Возможность | Описание |
|---|---|---|---|
| 1 | Обязательное согласие | Валидация (required) с visible-ошибкой через harness touched | validators: [required(...)] + touched:true, чтобы статически показать destructive-состояние и текст ошибки. Рецепт «форма не пройдёт submit, пока не отмечен». |
| 2 | Внешняя подпись | Кастомный layout/композиция — подпись из произвольной разметки (ссылка) рядом с контролом | Checkbox без prop label обёрнут вместе с span+<a> в собственном render-компоненте (ExternalLabelExample). Рецепт сборки богатой подписи снаружи. |
| 3 | Переключение зависимого поля | Зависимое/реактивное поведение — boolean чекбокса управляет другим полем | useFormControlValue(form.sameEmail) + useEffect → form.billingEmail.disable()/enable(). Рецепт реактивной связи между полями. |

### TODO (нужна доработка компонента)

- Indeterminate / tri-state чекбокс (частично-выбранное родительское состояние в дереве) — API поддерживает только boolean (checked = value || false), нет проброса indeterminate на input. Нужна доработка компонента: добавить indeterminate-prop и value?: boolean | 'indeterminate'.

<details><summary>Убрано из Variants (состояния — теперь в API-табе)</summary>

- checked (Отмечен) — СОСТОЯНИЕ заполнено (initial:true), демонстрируется в API-вкладке через valuePresets
- disabled-unchecked (Заблокирован, снят) — СОСТОЯНИЕ disabled
- disabled-checked (Заблокирован, отмечен) — СОСТОЯНИЕ disabled
- invalid (Ошибка) — СОСТОЯНИЕ invalid; перенесено в Examples как рецепт валидации required

</details>


## RadioGroup

### Варианты (3)

| # | Вариант | Форма | Сборка | Описание |
|---|---|---|---|---|
| 1 | Вертикальная группа | Форма по умолчанию — опции столбцом (flex flex-col gap-2), одиночный выбор через options[] | props | Дефолтная конфигурация RadioGroup: массив options рендерится вертикально. Одиночный выбор, навигация стрелками. Привязано к реальному props options. |
| 2 | Горизонтальная группа | Раскладка в ряд — та же модель выбора, className='!flex-row gap-6' | props | Раскладка/шаблон элементов изменён на горизонтальный через className контейнера. Это форма по устройству (раскладка), достижимая штатным props. |
| 3 | Бинарная группа | Частный случай модели — ровно две опции да/нет | props | Минимальная бинарная конфигурация options (два элемента) в inline-раскладке. Модель выбора та же, отличается формой набора опций. |

### Примеры (5)

| # | Пример | Возможность | Описание |
|---|---|---|---|
| 1 | Обязательный выбор | Валидация (required) | Рецепт: валидатор required из @reformer/core/validators блокирует submit, пока не выбран вариант. |
| 2 | Интеграция с FormField | FormField wiring / вывод ошибки по submit | Рецепт: FormField оборачивает группу — label через aria-labelledby, required-маркер, вывод ошибки и aria-invalid по markAsTouched + validateFormModel. |
| 3 | Привязка к модели формы | hooks (useFormControlValue) | Рецепт: value/onChange идут от состояния формы, useFormControlValue реактивно отдаёт текущий выбор (string | null). |
| 4 | Явный name для нескольких групп | Изоляция групп через name | Рецепт: разный name у каждой группы — одиночный выбор и навигация стрелками работают внутри каждой группы отдельно. |
| 5 | Зависимая блокировка | Зависимое поведение (control.disable/enable) | Рецепт: disabled группы вычисляется от значения другого поля через useEffect + control.enable()/disable(). |

<details><summary>Убрано из Variants (состояния — теперь в API-табе)</summary>

- filled — «С выбранным значением» (состояние заполнено)
- disabled — «Заблокирован» (состояние disabled)
- invalid — «Невалидный (ошибка)» (состояние invalid, touched+required)

</details>


## Select

### Варианты (3)

| # | Вариант | Форма | Сборка | Описание |
|---|---|---|---|---|
| 1 | Одиночный выбор (options) | Дефолтная форма Select: плоский список inline-опций через проп options, модель выбора — одно значение (value: string | null) | props | makeFieldVariant с component: Select и componentProps.options = LOAN. Базовая раскладка списка. |
| 2 | Группировка опций (options + group) | Форма с секциями: элементы с одинаковым полем group собираются в SelectGroup под заголовком SelectLabel | props | Тот же options-проп, но у элементов задан group. Раскладка секций строится компонентом автоматически — отдельная конфигурация-форма, а не состояние. |
| 3 | Кастомный шаблон элемента (ручная сборка) | Произвольная разметка item и выбранного значения (аватар-инициалы + ФИО + роль) — недостижима options-пропом, где label только строка | manual-composition | Локальный CustomItemVariant: SelectRoot + SelectTrigger + SelectValue + SelectContent + SelectItem с кастомными children. Значение связано через useState. Radix переносит содержимое item в SelectValue, поэтому выбранное значение в триггере рендерится тем же шаблоном. |

### Примеры (6)

| # | Пример | Возможность | Описание |
|---|---|---|---|
| 1 | Очистка выбора (clearable) | clearable | clearable=true добавляет крестик; клик сбрасывает выбор в null через onChange(null). |
| 2 | Resource: static (снимок) | data provider — стратегия static | type='static' — один load({}) при маунте, без поиска и пагинации. Живой staticResource. |
| 3 | Resource: preload + клиентский поиск | data provider — стратегия preload | type='preload' грузит всё сразу; поле Search фильтрует загруженные опции на клиенте. |
| 4 | Resource: partial (серверные поиск и пагинация) | data provider — стратегия partial | type='partial' — debounce-поиск уходит на сервер, следующие страницы догружаются по скроллу (infinite-scroll до totalCount). |
| 5 | Ошибка загрузки + Retry | data provider — обработка ошибки | load() падает и опций нет → «Failed to load options» + кнопка Retry (повтор первичной загрузки). |
| 6 | Обязательный выбор (валидатор) | валидация required | validators: [required()] в ноде схемы; harness-флаг touched:true визуально показывает ошибку под полем (рецепт, не state-вариант). |

### TODO (нужна доработка компонента)

- Множественный выбор (multi-select) — API Select одиночный: value: string | null, под капотом Radix Select (single). Нужна доработка компонента (поддержка value: string[] и multiple-режим Radix) — сломанную карточку не рендерил.

<details><summary>Убрано из Variants (состояния — теперь в API-табе)</summary>

- empty (Пусто/placeholder) — состояние «пусто»
- filled (С выбранным значением) — состояние «заполнено»
- disabled-empty (Заблокирован пусто) — состояние disabled
- disabled-filled (Заблокирован с значением) — состояние disabled+заполнено
- invalid (Ошибка/invalid) — состояние ошибки валидации
- required (Обязательный) — маркер/состояние поля (демонстрируется контролом required в табе API)
- empty-options (Пустой список) — крайнее состояние «No options available»

</details>


## Button

### Варианты (3)

| # | Вариант | Форма | Сборка | Описание |
|---|---|---|---|---|
| 1 | Только текст | Дефолтная форма — текстовая подпись без иконок (h-9 px-4) | props | Базовая раскладка кнопки под сплошной текст; это конфигурация-по-умолчанию, а не 'заполненное состояние'. |
| 2 | Иконка + текст | Композиция svg-ребёнок + подпись | props | Форма по составу контента: иконка авто-масштабируется до size-4, отбивается gap-2, паддинг сжимается через has-[>svg]. Собирается children'ами. |
| 3 | Только иконка | Icon-only через size="icon" | props | Квадратная форма size-9 без текстовой подписи для тулбаров/компактных действий; size="icon" + aria-label. Раскладка задаётся реальным prop size. |

### Примеры (4)

| # | Пример | Возможность | Описание |
|---|---|---|---|
| 1 | Submit внутри формы | type="submit" native behavior | Рецепт функционального режима: кнопка в <form> инициирует нативную отправку и срабатывает по Enter. Перенесена из Variants (это поведение native-пропа, не форма устройства). |
| 2 | asChild — стили кнопки на другом элементе | asChild / Slot polymorphism | Slot переносит классы Button на дочерний <a>/Link, сохраняя семантику ссылки вместо <button>. |
| 3 | Проброс нативных атрибутов button | React.ComponentProps<'button'> passthrough | onClick/name/value/aria-label уходят на реальный <button>. |
| 4 | Loading / busy паттерн | составное занятое состояние (disabled + spinner child) | Рецепт: disabled=true + Loader2-ребёнок с animate-spin; демонстрирует авто-размер иконки и блокировку одновременно. |

<details><summary>Убрано из Variants (состояния — теперь в API-табе)</summary>

- Disabled (заблокированное неинтерактивное состояние) — это STATE, демонстрируется в API/playground через knob disabled, а не отдельной variant-карточкой
- Default в старой формулировке 'дефолтное состояние (пусто)' — переформулирован в форму 'Только текст' (дефолтная конфигурация контента), убрана state-подача

</details>


## FormField (cdk) — headless-анатомия поля (Root/Label/Control/Error/Description + useFormField/useFormFieldContext)

### Варианты (3)

| # | Вариант | Форма | Сборка | Описание |
|---|---|---|---|---|
| 1 | Вертикальная анатомия (baseline) | Форма по умолчанию: Label над Control, Error снизу. Стандартная 3-частная сборка compound-частей. | props | Дефолтная раскладка анатомии. Label/Control берут текст/компонент из ноды схемы, Error скрыт до touch. Реальный API: FormField.Root/Label/Control/Error. |
| 2 | С описанием (Description-part) | Форма из 4 частей: добавлен FormField.Description (helper-текст под контролом), hasDescription на Root связывает aria-describedby. | props | Другой состав частей анатомии — включён экспортируемый под-компонент Description. Достижимо стандартными частями compound + флагом hasDescription. |
| 3 | Горизонтальная раскладка | Раскладка: Label слева, Control+Error справа (grid-обёртка вокруг частей). | manual-composition | Другая раскладка тех же частей. Headless не навязывает DOM — обёртка-grid ставится руками вокруг FormField.Label/Control/Error, id/aria провязываются в любом порядке. |

### Примеры (10)

| # | Пример | Возможность | Описание |
|---|---|---|---|
| 1 | Кастомный контрол через asChild | FormField.Control asChild + Slot | Подключение стороннего/незарегистрированного контрола (маска): value/onChange/onBlur/disabled/aria авто-вяжутся через Slot. |
| 2 | Свой элемент лейбла | useFormFieldContext → ids/label/required | Собственный <label> (иконка/Typography) с сохранением htmlFor/id-связи с контролом. |
| 3 | Обогащённый лейбл + forceRender | FormField.Label children + forceRender | Доп. контент в лейбле («(необязательно)») и рендер обёртки даже без label-текста из ноды. |
| 4 | Кастомный рендер ошибок | FormField.Error render-prop | Своя разметка на каждую ошибку, цвет по err.severity (warning/error). touched-демо. |
| 5 | Все ошибки списком (Error multi) | FormField.Error multi | Перечень всех проваленных валидаторов; id/aria-errormessage на первой ошибке. Перенесено из Variants (была state-карточка «несколько ошибок»). |
| 6 | Хук useFormField | useFormField prop-getters | Собственный DOM без compound-компонентов: labelProps/controlProps/errorProps/descriptionProps + state + ids. |
| 7 | Состояние через useFormFieldContext | useFormFieldContext чтение value/pending | Чтение состояния из произвольного ребёнка — счётчик символов у лейбла. |
| 8 | Индикатор async-валидации | pending из контекста | «Проверка…» пока идёт asyncValidators; taken@example.com → ошибка занятости. |
| 9 | Готовый FormField из ui-kit | @reformer/ui-kit FormField | Собранная поверх cdk обёртка Label→Control→Error одной строкой. |
| 10 | FormField как fieldWrapper | FormRenderer settings.fieldWrapper | ui-kit FormField как единый рендер всех полей декларативной схемы. |

<details><summary>Убрано из Variants (состояния — теперь в API-табе)</summary>

- Заполнено / valid — состояние значения (демонстрируется в табе API)
- Invalid (одна ошибка) — состояние валидации (таб API)
- Disabled — состояние control.disable() (таб API)
- Обязательное (componentProps.required) — конфиг-флаг/состояние, не структурная форма (таб API)
- Несколько ошибок (Error multi) — НЕ удалено, а перенесено в Examples как рецепт возможности

</details>


## FormArray

### Варианты (4)

| # | Вариант | Форма | Сборка | Описание |
|---|---|---|---|---|
| 1 | Headless-сборка (базовая форма) | Базовая ручная композиция Root + Empty + List (карточка на элемент) + AddButton — то, чем FormArray является структурно | manual-composition | Дефолтная форма CDK-компонента: разметку/стили пишете сами из экспортируемых под-компонентов. render=FormArrayHeadlessBase. |
| 2 | Секция с заголовком (FormArraySection) | Styled-пресет с header-layout: title → заголовок секции + кнопка добавления в шапке | props | Форма через props высокоуровневого FormArraySection (title). render=SectionWithTitle. |
| 3 | Секция без заголовка (footer-add) | Styled-пресет с footer-layout: без title → кнопка добавления рендерится ссылкой-футером внизу | props | Форма через props FormArraySection (title не задан, addButtonLabel). render=SectionNoTitle. |
| 4 | Секция с перестановкой (↑/↓) | Styled-пресет с reorder-layout: reorderable → на каждой карточке кнопки ↑/↓ для смены порядка | props | Форма через props FormArraySection (reorderable). render=SectionReorderable. |

### Примеры (12)

| # | Пример | Возможность | Описание |
|---|---|---|---|
| 1 | Все части compound-API | полная ручная сборка из под-компонентов (Count/Empty/ItemIndex/RemoveButton) | Рецепт композиции из всего набора частей; переименован из бывшего example 'headless' в 'all-parts', чтобы не путать с базовым variant. |
| 2 | Хук useFormArray | headless hook (items/add/clear/insert/move/swap/length) | Полностью кастомная раскладка без compound-компонентов; T выводится из control. |
| 3 | Переупорядочивание через render-props | moveUp/moveDown/canMoveUp/canMoveDown в render-prop | Reorder на уровне ручной сборки (в отличие от section-reorderable variant, где это prop-пресет). |
| 4 | Имперо-управление через ref | FormArrayHandle (add/clear через ref из тулбара вне дерева) | Управление массивом извне через imperative ref. |
| 5 | Импорт из API: insert + at (дедуп) | программное наполнение с чтением значений (at) и вставкой (insert) | Дедуп по номеру при импорте строк. |
| 6 | Своя кнопка через asChild | asChild (Slot) на AddButton/RemoveButton | Рендер собственного компонента с мержем props. |
| 7 | Типизированный initialValue | type-safe seed добавляемого элемента | Несколько кнопок с разными initialValue. |
| 8 | Кастомный счётчик / нумерация | Count.render и ItemIndex.render | Плюрализация и формат позиции (0-based/1-based). |
| 9 | Ошибки массива (FormArray.Error) | валидация уровня массива (default/multi/render) | Показ array-level ошибок (minItems и т.п.) через harness setErrors — рецепт, не state-вариант. |
| 10 | Ограничение количества (maxItems) | maxItems constraint | НОВЫЙ пример: перенесён из бывшего variant 'section-max-items' (это поведение/лимит, не форма). |
| 11 | Политика удаления на единственном (showRemoveOnSingle) | showRemoveOnSingle policy | НОВЫЙ пример: перенесён из бывшего variant 'section-remove-single' (это политика, не форма). |
| 12 | Готовая styled-секция / Условная секция (hasItems) | FormArraySection full props + hasItems toggle | Полная декларативная секция и условное скрытие под чекбоксом. |

<details><summary>Убрано из Variants (состояния — теперь в API-табе)</summary>

- filled (Заполнен) — состояние 'заполнено', удалено из Variants
- empty (Пустой массив) — состояние 'пусто', удалено из Variants
- disabled (Отключённый массив) — состояние disabled, удалено из Variants
- invalid (Ошибка уровня массива) — состояние invalid, удалено из Variants
- section-max-items — поведение/лимит, перенесено в Examples как 'max-items'
- section-remove-single — политика, перенесено в Examples как 'remove-on-single'

</details>


## FormWizard

### Варианты (3)

| # | Вариант | Форма | Сборка | Описание |
|---|---|---|---|---|
| 1 | Полная композиция (default) | Дефолтная форма мастера: все четыре compound-слота собраны вручную — Indicator + Step(×N) + Actions + Progress | manual-composition | Ручная сборка из экспортируемых под-компонентов FormWizard.Indicator / .Step / .Actions / .Progress. Рендер FullComposition через WizardShell. Это структурная форма 'по устройству' — полная раскладка мастера, не состояние. |
| 2 | Минимальная композиция | Голый собранный мастер: только Step + Actions (без Indicator и Progress) | manual-composition | Ручная сборка из FormWizard.Step + FormWizard.Actions с compound-кнопками Prev/Next/Submit. Наличие степпера/прогресса — композиционная настройка, поэтому минимальная форма — отдельный вариант устройства. |
| 3 | Декларативная ui-kit-обёртка | Тот же мастер одной строкой <FormWizard steps={STEPS} onSubmit={...} /> — весь layout свёрнут в проп-массив steps | props | Высокоуровневая обёртка @reformer/ui-kit/form-wizard: Indicator + Steps + Actions + Progress собираются из единственного props-массива steps. Другая структурная форма сборки того же мастера (props высокоуровневого компонента vs ручная композиция слотов). |

### Примеры (11)

| # | Пример | Возможность | Описание |
|---|---|---|---|
| 1 | Пошаговая валидация (config) | config.validateStep / validateAll | Рецепт: «Далее» не переводит пока текущий шаг невалиден, submit проходит только после validateAll. Оба колбэка из validateFormModel. |
| 2 | Indicator — кастомный степпер | FormWizard.Indicator render-props | Рецепт кликабельного индикатора из steps со статусами isCurrent/isCompleted/canNavigate и goToStep. |
| 3 | Progress — кастомный прогресс-бар | FormWizard.Progress render-props | Рецепт своей визуализации прогресса из current/total/percent/completedCount. |
| 4 | Actions в режиме render-props | FormWizard.Actions render-props | Рецепт полного контроля разметки кнопок из { prev, next, submit, isFirstStep, isLastStep, isValidating, isSubmitting }. |
| 5 | Compound-кнопки Prev / Next / Submit | FormWizard.Prev/Next/Submit | Рецепт декларативных кнопок с авто-disabled логикой без ручного wiring. |
| 6 | Submit с индикатором отправки | FormWizard.Submit loadingText + isSubmitting | Рецепт: во время isSubmitting контент Submit подменяется на loadingText, кнопка disabled. |
| 7 | asChild — своя кнопка навигации | asChild / Slot | Рецепт проброса onClick/disabled/type в кастомный Button через Slot. |
| 8 | Внешнее управление через ref | FormWizardHandle (useRef) | Рецепт hooks/императивного API: submit()/goToStep()/goToNextStep() из шапки вне дерева мастера. |
| 9 | Реакция на смену шага + автоскролл | onStepChange + scrollToTop | Рецепт хука на смену шага (аналитика/фокус) и управления автопрокруткой. |
| 10 | Полиморфное тело шага (ui-kit) | FormWizardStepBody (FC | ReactNode | RenderNode) | Рецепт: step.body покрывает TS-flow, renderer-react и renderer-json одним мастером. |
| 11 | Кастомные подписи и aria (ui-kit) | prevLabel/nextLabel/submitLabel/format/navAriaLabel | Рецепт переопределения user-facing строк кнопок, формата прогресса и a11y-меток индикатора. |

### TODO (нужна доработка компонента)

- Ветвящийся / условный мастер (пропуск или подмена шагов по данным формы) — нет first-class API: config.validateStep принимает только 1-based индекс, навигация строго линейная (currentStep±1, goToStep с guard по completedSteps). Нужна доработка компонента для non-linear flow.
- Горизонтальная vs вертикальная раскладка индикатора как проп — StepIndicator управляет только через className, ориентация не является частью API (это стилизация, не форма).

<details><summary>Убрано из Variants (состояния — теперь в API-табе)</summary>

- first-step (currentStep=1 — состояние навигации, не форма)
- middle-step (currentStep=2 / completedSteps=[1] — состояние)
- last-step (isLastStep — состояние)
- blocked-invalid (validateStep=false, touched+error — состояние невалидности)
- loading (isValidating/isSubmitting — состояние загрузки)

</details>

