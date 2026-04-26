# Форма: Заявка на страхование

## Основная информация

**Статус документа:** ✅ Актуальный
**Название формы:** Многошаговая форма заявки на страхование
**Версия документа:** 2.0
**Дата создания:** 2025-11-16
**Автор:** Claude Code
**Последнее обновление:** 2025-12-04
**Следующий ревью:** 2026-02-04
**Макеты:** -

---

## Пользовательская история

**Как клиент страховой компании**, я хочу оформить страховой полис онлайн, **чтобы** быстро получить страховую защиту без посещения офиса.

### Сценарий использования

1. **Начало работы**: Пользователь открывает форму заявки на страхование
2. **Шаг 1 - Тип страхования**: Выбирает тип страхования (КАСКО, ОСАГО, недвижимость, жизнь, путешествия), указывает срок, страховую сумму и способ оплаты
3. **Шаг 2 - Данные страхователя**: Заполняет персональные или корпоративные данные, паспортные данные, контактную информацию
4. **Шаг 3 - Объект страхования**: В зависимости от типа страхования вводит данные о транспорте, недвижимости, здоровье или путешествии
5. **Шаг 4 - Водители/Выгодоприобретатели**: Добавляет водителей (для КАСКО/ОСАГО) или выгодоприобретателей (для страхования жизни)
6. **Шаг 5 - История**: Указывает информацию о предыдущих полисах и страховых случаях
7. **Шаг 6 - Расчет и подтверждение**: Видит расчет стоимости полиса, соглашается с условиями и подтверждает заявку кодом из СМС
8. **Результат**: Получает уведомление об успешном оформлении полиса

### Критерии приемки

- ✅ Форма разделена на 6 логических шагов с индикатором прогресса
- ✅ На каждом шаге доступна валидация полей перед переходом к следующему
- ✅ Пользователь может вернуться на предыдущие шаги для корректировки данных
- ✅ Условные поля отображаются только при выборе соответствующего типа страхования или статуса
- ✅ Вычисляемые поля (дата окончания, возраст, стаж, ИМТ, стоимость полиса) обновляются автоматически
- ✅ При наличии сохраненной заявки, форма предзаполняется данными
- ✅ Форма отображает понятные сообщения об ошибках и подсказки для пользователя
- ✅ После успешной отправки пользователь получает подтверждение с номером полиса

---

## Тип формы

- [ ] **Простая форма** - все поля отображаются на одной странице
- [x] **Пошаговая форма** - поля разделены на несколько шагов с навигацией

## Сценарии использования формы

- [x] **Просмотр** - Форма загружает данные и блокирует все поля для редактирования
- [x] **Создание** - Форма изначально пустая
- [x] **Редактирование** - Форма предварительно заполняется данными

## Расположение формы

- [x] **Компонент**
- [ ] **Модальное окно**
- [ ] **Боковое меню**
- [ ] **Отдельная страница**
- [ ] **Пошаговая форма где каждый шаг это отдельная страница**

## Поля формы

### Шаг 1: Тип страхования и основные параметры

<table>
    <tr>
        <th>№</th>
        <th>Раздел</th>
        <th>Ключ в форме</th>
        <th>Название поля</th>
        <th>Тип поля</th>
        <th>Значение</th>
        <th>Валидация</th>
        <th>Подсказка</th>
        <th>Примечание</th>
    </tr>
    <tr>
        <td>1.1</td>
        <td>Основное</td>
        <td>insuranceType</td>
        <td>Тип страхования</td>
        <td>Select</td>
        <td>'casco'</td>
        <td>Обязательное</td>
        <td>Выберите тип страхования</td>
        <td>Варианты: КАСКО, ОСАГО, Недвижимость, Жизнь и здоровье, Путешествия</td>
    </tr>
    <tr>
        <td>1.2</td>
        <td>Основное</td>
        <td>insurancePeriod</td>
        <td>Срок страхования</td>
        <td>Select</td>
        <td>12</td>
        <td>Обязательное</td>
        <td>Выберите срок</td>
        <td>Варианты: 3 месяца, 6 месяцев, 1 год, 2 года, 3 года</td>
    </tr>
    <tr>
        <td>1.3</td>
        <td>Основное</td>
        <td>startDate</td>
        <td>Дата начала действия полиса</td>
        <td>Input[date]</td>
        <td>''</td>
        <td>Обязательное, >= сегодня</td>
        <td>-</td>
        <td>Используется для вычисления даты окончания</td>
    </tr>
    <tr>
        <td>1.4</td>
        <td>Основное</td>
        <td>endDate</td>
        <td>Дата окончания</td>
        <td>Input[date]</td>
        <td>''</td>
        <td>Computed</td>
        <td>-</td>
        <td>Вычисляется: startDate + insurancePeriod месяцев</td>
    </tr>
    <tr>
        <td>1.5</td>
        <td>Основное</td>
        <td>coverageAmount</td>
        <td>Страховая сумма (₽)</td>
        <td>Input[number]</td>
        <td>undefined</td>
        <td>Обязательное, min: 100000, max: 50000000</td>
        <td>от 100 000 до 50 000 000</td>
        <td>-</td>
    </tr>
    <tr>
        <td>1.6</td>
        <td>Основное</td>
        <td>deductible</td>
        <td>Франшиза (₽)</td>
        <td>Input[number]</td>
        <td>undefined</td>
        <td>Необязательное, min: 0</td>
        <td>0</td>
        <td>Безусловная франшиза, влияет на стоимость полиса</td>
    </tr>
    <tr>
        <td>1.7</td>
        <td>Оплата</td>
        <td>paymentType</td>
        <td>Способ оплаты</td>
        <td>RadioGroup</td>
        <td>'single'</td>
        <td>Обязательное</td>
        <td>-</td>
        <td>Варианты: Единовременно, В рассрочку</td>
    </tr>
    <tr>
        <td>1.8</td>
        <td>Оплата</td>
        <td>installments</td>
        <td>Количество платежей</td>
        <td>Select</td>
        <td>undefined</td>
        <td>Условное (при paymentType='installments')</td>
        <td>Выберите количество</td>
        <td>Варианты: 2, 3, 4, 6, 12 платежей</td>
    </tr>
</table>

### Шаг 2: Данные страхователя

<table>
    <tr>
        <th>№</th>
        <th>Раздел</th>
        <th>Ключ в форме</th>
        <th>Название поля</th>
        <th>Тип поля</th>
        <th>Значение</th>
        <th>Валидация</th>
        <th>Подсказка</th>
        <th>Примечание</th>
    </tr>
    <tr>
        <td>2.1</td>
        <td>Тип</td>
        <td>insuredType</td>
        <td>Тип страхователя</td>
        <td>RadioGroup</td>
        <td>'individual'</td>
        <td>Обязательное</td>
        <td>-</td>
        <td>Варианты: Физическое лицо, Юридическое лицо</td>
    </tr>
    <tr>
        <td>2.2</td>
        <td>Личные данные</td>
        <td>personalData.lastName</td>
        <td>Фамилия</td>
        <td>Input</td>
        <td>''</td>
        <td>Условное (при insuredType='individual')</td>
        <td>Введите фамилию</td>
        <td>Вложенная форма PersonalData</td>
    </tr>
    <tr>
        <td>2.3</td>
        <td>Личные данные</td>
        <td>personalData.firstName</td>
        <td>Имя</td>
        <td>Input</td>
        <td>''</td>
        <td>Условное (при insuredType='individual')</td>
        <td>Введите имя</td>
        <td>-</td>
    </tr>
    <tr>
        <td>2.4</td>
        <td>Личные данные</td>
        <td>personalData.middleName</td>
        <td>Отчество</td>
        <td>Input</td>
        <td>''</td>
        <td>Необязательное</td>
        <td>Введите отчество</td>
        <td>-</td>
    </tr>
    <tr>
        <td>2.5</td>
        <td>Личные данные</td>
        <td>personalData.birthDate</td>
        <td>Дата рождения</td>
        <td>Input[date]</td>
        <td>''</td>
        <td>Условное (при insuredType='individual')</td>
        <td>-</td>
        <td>Используется для вычисления возраста</td>
    </tr>
    <tr>
        <td>2.6</td>
        <td>Личные данные</td>
        <td>personalData.gender</td>
        <td>Пол</td>
        <td>RadioGroup</td>
        <td>'male'</td>
        <td>Условное (при insuredType='individual')</td>
        <td>-</td>
        <td>Варианты: Мужской, Женский</td>
    </tr>
    <tr>
        <td>2.7</td>
        <td>Компания</td>
        <td>companyData.name</td>
        <td>Название организации</td>
        <td>Input</td>
        <td>''</td>
        <td>Условное (при insuredType='company')</td>
        <td>ООО "Компания"</td>
        <td>Вложенная форма CompanyData</td>
    </tr>
    <tr>
        <td>2.8</td>
        <td>Компания</td>
        <td>companyData.inn</td>
        <td>ИНН организации</td>
        <td>InputMask</td>
        <td>''</td>
        <td>Условное (при insuredType='company'), mask: '9999999999'</td>
        <td>1234567890</td>
        <td>10 цифр</td>
    </tr>
    <tr>
        <td>2.9</td>
        <td>Компания</td>
        <td>companyData.ogrn</td>
        <td>ОГРН</td>
        <td>InputMask</td>
        <td>''</td>
        <td>Условное (при insuredType='company'), mask: '9999999999999'</td>
        <td>1234567890123</td>
        <td>13 цифр</td>
    </tr>
    <tr>
        <td>2.10</td>
        <td>Компания</td>
        <td>companyData.kpp</td>
        <td>КПП</td>
        <td>InputMask</td>
        <td>''</td>
        <td>Условное (при insuredType='company'), mask: '999999999'</td>
        <td>123456789</td>
        <td>9 цифр</td>
    </tr>
    <tr>
        <td>2.11</td>
        <td>Компания</td>
        <td>companyData.ceoName</td>
        <td>ФИО руководителя</td>
        <td>Input</td>
        <td>''</td>
        <td>Условное (при insuredType='company')</td>
        <td>Иванов Иван Иванович</td>
        <td>-</td>
    </tr>
    <tr>
        <td>2.12</td>
        <td>Паспортные данные</td>
        <td>passportData.series</td>
        <td>Серия паспорта</td>
        <td>InputMask</td>
        <td>''</td>
        <td>Условное (при insuredType='individual'), mask: '99 99'</td>
        <td>12 34</td>
        <td>Вложенная форма PassportData</td>
    </tr>
    <tr>
        <td>2.13</td>
        <td>Паспортные данные</td>
        <td>passportData.number</td>
        <td>Номер паспорта</td>
        <td>InputMask</td>
        <td>''</td>
        <td>Условное (при insuredType='individual'), mask: '999999'</td>
        <td>123456</td>
        <td>6 цифр</td>
    </tr>
    <tr>
        <td>2.14</td>
        <td>Паспортные данные</td>
        <td>passportData.issueDate</td>
        <td>Дата выдачи</td>
        <td>Input[date]</td>
        <td>''</td>
        <td>Условное (при insuredType='individual')</td>
        <td>-</td>
        <td>-</td>
    </tr>
    <tr>
        <td>2.15</td>
        <td>Паспортные данные</td>
        <td>passportData.issuedBy</td>
        <td>Кем выдан</td>
        <td>Input</td>
        <td>''</td>
        <td>Условное (при insuredType='individual')</td>
        <td>Отделением УФМС...</td>
        <td>-</td>
    </tr>
    <tr>
        <td>2.16</td>
        <td>Контакты</td>
        <td>phone</td>
        <td>Телефон</td>
        <td>InputMask</td>
        <td>''</td>
        <td>Обязательное, mask: '+7 (999) 999-99-99'</td>
        <td>+7 (___) ___-__-__</td>
        <td>-</td>
    </tr>
    <tr>
        <td>2.17</td>
        <td>Контакты</td>
        <td>email</td>
        <td>Email</td>
        <td>Input[email]</td>
        <td>''</td>
        <td>Обязательное, email format</td>
        <td>example@mail.com</td>
        <td>-</td>
    </tr>
    <tr>
        <td>2.18</td>
        <td>Вычисляемые</td>
        <td>fullName</td>
        <td>Полное имя (ФИО)</td>
        <td>Input readonly</td>
        <td>''</td>
        <td>Computed</td>
        <td>-</td>
        <td>Вычисляется из personalData: lastName + firstName + middleName</td>
    </tr>
    <tr>
        <td>2.19</td>
        <td>Вычисляемые</td>
        <td>age</td>
        <td>Возраст</td>
        <td>Input[number] readonly</td>
        <td>undefined</td>
        <td>Computed, min: 18, max: 75</td>
        <td>-</td>
        <td>Вычисляется из personalData.birthDate</td>
    </tr>
</table>

### Шаг 3: Объект страхования - Транспорт (КАСКО/ОСАГО)

<table>
    <tr>
        <th>№</th>
        <th>Раздел</th>
        <th>Ключ в форме</th>
        <th>Название поля</th>
        <th>Тип поля</th>
        <th>Значение</th>
        <th>Валидация</th>
        <th>Подсказка</th>
        <th>Примечание</th>
    </tr>
    <tr>
        <td>3.1</td>
        <td>Транспорт</td>
        <td>vehicle.vin</td>
        <td>VIN-номер</td>
        <td>Input</td>
        <td>''</td>
        <td>Обязательное, 17 символов</td>
        <td>XXXXXXXXXXXXXXXXX</td>
        <td>Условно: insuranceType in ['casco', 'osago']</td>
    </tr>
    <tr>
        <td>3.2</td>
        <td>Транспорт</td>
        <td>vehicle.brand</td>
        <td>Марка автомобиля</td>
        <td>Select</td>
        <td>''</td>
        <td>Обязательное</td>
        <td>Выберите марку</td>
        <td>Динамическая загрузка моделей при выборе</td>
    </tr>
    <tr>
        <td>3.3</td>
        <td>Транспорт</td>
        <td>vehicle.model</td>
        <td>Модель автомобиля</td>
        <td>Select</td>
        <td>''</td>
        <td>Обязательное</td>
        <td>Выберите модель</td>
        <td>Зависит от выбранной марки</td>
    </tr>
    <tr>
        <td>3.4</td>
        <td>Транспорт</td>
        <td>vehicle.year</td>
        <td>Год выпуска</td>
        <td>Input[number]</td>
        <td>undefined</td>
        <td>Обязательное, min: 1990, max: текущий год</td>
        <td>2020</td>
        <td>-</td>
    </tr>
    <tr>
        <td>3.5</td>
        <td>Транспорт</td>
        <td>vehicle.mileage</td>
        <td>Пробег (км)</td>
        <td>Input[number]</td>
        <td>undefined</td>
        <td>Обязательное, min: 0</td>
        <td>50000</td>
        <td>-</td>
    </tr>
    <tr>
        <td>3.6</td>
        <td>Транспорт</td>
        <td>vehicle.enginePower</td>
        <td>Мощность двигателя (л.с.)</td>
        <td>Input[number]</td>
        <td>undefined</td>
        <td>Обязательное, min: 1</td>
        <td>150</td>
        <td>Влияет на коэффициент расчета</td>
    </tr>
    <tr>
        <td>3.7</td>
        <td>Транспорт</td>
        <td>vehicle.bodyType</td>
        <td>Тип кузова</td>
        <td>Select</td>
        <td>'sedan'</td>
        <td>Обязательное</td>
        <td>Выберите тип</td>
        <td>Варианты: Седан, Хэтчбек, Внедорожник, Универсал, Купе, Минивэн, Пикап</td>
    </tr>
    <tr>
        <td>3.8</td>
        <td>Транспорт</td>
        <td>vehicle.transmission</td>
        <td>Коробка передач</td>
        <td>RadioGroup</td>
        <td>'manual'</td>
        <td>Обязательное</td>
        <td>-</td>
        <td>Варианты: Механика, Автомат</td>
    </tr>
    <tr>
        <td>3.9</td>
        <td>Транспорт</td>
        <td>vehicle.marketValue</td>
        <td>Рыночная стоимость (₽)</td>
        <td>Input[number]</td>
        <td>undefined</td>
        <td>Условное (при insuranceType='casco'), min: 0</td>
        <td>1500000</td>
        <td>Только для КАСКО</td>
    </tr>
    <tr>
        <td>3.10</td>
        <td>Транспорт</td>
        <td>vehicle.licensePlate</td>
        <td>Госномер</td>
        <td>Input</td>
        <td>''</td>
        <td>Обязательное</td>
        <td>А000АА000</td>
        <td>-</td>
    </tr>
    <tr>
        <td>3.11</td>
        <td>Транспорт</td>
        <td>vehicle.registrationCert</td>
        <td>Номер СТС</td>
        <td>Input</td>
        <td>''</td>
        <td>Обязательное</td>
        <td>00 00 000000</td>
        <td>-</td>
    </tr>
    <tr>
        <td>3.12</td>
        <td>Противоугонка</td>
        <td>vehicle.hasAntiTheft</td>
        <td>Наличие противоугонной системы</td>
        <td>Checkbox</td>
        <td>false</td>
        <td>-</td>
        <td>-</td>
        <td>Влияет на скидку</td>
    </tr>
    <tr>
        <td>3.13</td>
        <td>Противоугонка</td>
        <td>vehicle.antiTheftBrand</td>
        <td>Марка противоугонной системы</td>
        <td>Input</td>
        <td>''</td>
        <td>Условное (при hasAntiTheft=true)</td>
        <td>StarLine</td>
        <td>-</td>
    </tr>
    <tr>
        <td>3.14</td>
        <td>Хранение</td>
        <td>vehicle.garageParking</td>
        <td>Гаражное хранение</td>
        <td>Checkbox</td>
        <td>false</td>
        <td>-</td>
        <td>-</td>
        <td>Влияет на коэффициент</td>
    </tr>
    <tr>
        <td>3.15</td>
        <td>Использование</td>
        <td>vehicle.usagePurpose</td>
        <td>Цель использования</td>
        <td>Select</td>
        <td>'personal'</td>
        <td>Обязательное</td>
        <td>Выберите цель</td>
        <td>Варианты: Личное, Такси, Учебный, Коммерческое</td>
    </tr>
</table>

### Шаг 3: Объект страхования - Недвижимость

<table>
    <tr>
        <th>№</th>
        <th>Раздел</th>
        <th>Ключ в форме</th>
        <th>Название поля</th>
        <th>Тип поля</th>
        <th>Значение</th>
        <th>Валидация</th>
        <th>Подсказка</th>
        <th>Примечание</th>
    </tr>
    <tr>
        <td>3.16</td>
        <td>Недвижимость</td>
        <td>property.type</td>
        <td>Тип недвижимости</td>
        <td>Select</td>
        <td>'apartment'</td>
        <td>Обязательное</td>
        <td>Выберите тип</td>
        <td>Условно: insuranceType='property'. Варианты: Квартира, Дом, Таунхаус, Коммерческая, Земельный участок</td>
    </tr>
    <tr>
        <td>3.17</td>
        <td>Адрес</td>
        <td>property.address.region</td>
        <td>Регион</td>
        <td>Input</td>
        <td>''</td>
        <td>Обязательное</td>
        <td>Московская область</td>
        <td>Вложенная форма PropertyAddress</td>
    </tr>
    <tr>
        <td>3.18</td>
        <td>Адрес</td>
        <td>property.address.city</td>
        <td>Город</td>
        <td>Input</td>
        <td>''</td>
        <td>Обязательное</td>
        <td>Москва</td>
        <td>-</td>
    </tr>
    <tr>
        <td>3.19</td>
        <td>Адрес</td>
        <td>property.address.street</td>
        <td>Улица</td>
        <td>Input</td>
        <td>''</td>
        <td>Обязательное</td>
        <td>ул. Ленина</td>
        <td>-</td>
    </tr>
    <tr>
        <td>3.20</td>
        <td>Адрес</td>
        <td>property.address.house</td>
        <td>Дом</td>
        <td>Input</td>
        <td>''</td>
        <td>Обязательное</td>
        <td>1</td>
        <td>-</td>
    </tr>
    <tr>
        <td>3.21</td>
        <td>Адрес</td>
        <td>property.address.apartment</td>
        <td>Квартира</td>
        <td>Input</td>
        <td>''</td>
        <td>Необязательное</td>
        <td>1</td>
        <td>-</td>
    </tr>
    <tr>
        <td>3.22</td>
        <td>Характеристики</td>
        <td>property.area</td>
        <td>Площадь (м²)</td>
        <td>Input[number]</td>
        <td>undefined</td>
        <td>Обязательное, min: 1</td>
        <td>50</td>
        <td>-</td>
    </tr>
    <tr>
        <td>3.23</td>
        <td>Характеристики</td>
        <td>property.floors</td>
        <td>Этажность здания</td>
        <td>Input[number]</td>
        <td>undefined</td>
        <td>Обязательное, min: 1</td>
        <td>9</td>
        <td>-</td>
    </tr>
    <tr>
        <td>3.24</td>
        <td>Характеристики</td>
        <td>property.floor</td>
        <td>Этаж квартиры</td>
        <td>Input[number]</td>
        <td>undefined</td>
        <td>Условное (при property.type='apartment'), min: 1</td>
        <td>5</td>
        <td>Только для квартир</td>
    </tr>
    <tr>
        <td>3.25</td>
        <td>Характеристики</td>
        <td>property.yearBuilt</td>
        <td>Год постройки</td>
        <td>Input[number]</td>
        <td>undefined</td>
        <td>Обязательное, min: 1800, max: текущий год</td>
        <td>2010</td>
        <td>-</td>
    </tr>
    <tr>
        <td>3.26</td>
        <td>Характеристики</td>
        <td>property.wallMaterial</td>
        <td>Материал стен</td>
        <td>Select</td>
        <td>'brick'</td>
        <td>Обязательное</td>
        <td>Выберите материал</td>
        <td>Варианты: Кирпич, Бетон, Дерево, Панель, Монолит, Другое</td>
    </tr>
    <tr>
        <td>3.27</td>
        <td>Характеристики</td>
        <td>property.marketValue</td>
        <td>Рыночная стоимость (₽)</td>
        <td>Input[number]</td>
        <td>undefined</td>
        <td>Обязательное, min: 0</td>
        <td>5000000</td>
        <td>-</td>
    </tr>
    <tr>
        <td>3.28</td>
        <td>Безопасность</td>
        <td>property.hasAlarm</td>
        <td>Охранная сигнализация</td>
        <td>Checkbox</td>
        <td>false</td>
        <td>-</td>
        <td>-</td>
        <td>Влияет на скидку</td>
    </tr>
    <tr>
        <td>3.29</td>
        <td>Безопасность</td>
        <td>property.hasFireAlarm</td>
        <td>Пожарная сигнализация</td>
        <td>Checkbox</td>
        <td>false</td>
        <td>-</td>
        <td>-</td>
        <td>Влияет на скидку</td>
    </tr>
    <tr>
        <td>3.30</td>
        <td>Документы</td>
        <td>property.ownershipDoc</td>
        <td>Номер документа о собственности</td>
        <td>Input</td>
        <td>''</td>
        <td>Обязательное</td>
        <td>00-00/000-00/000/000/0000-0000</td>
        <td>-</td>
    </tr>
    <tr>
        <td>3.31</td>
        <td>Покрытие</td>
        <td>propertyCoverageOptions.structure</td>
        <td>Страхование конструктива</td>
        <td>Checkbox</td>
        <td>true</td>
        <td>Хотя бы один выбран</td>
        <td>-</td>
        <td>-</td>
    </tr>
    <tr>
        <td>3.32</td>
        <td>Покрытие</td>
        <td>propertyCoverageOptions.interior</td>
        <td>Страхование отделки</td>
        <td>Checkbox</td>
        <td>false</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
    </tr>
    <tr>
        <td>3.33</td>
        <td>Покрытие</td>
        <td>propertyCoverageOptions.movables</td>
        <td>Страхование движимого имущества</td>
        <td>Checkbox</td>
        <td>false</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
    </tr>
    <tr>
        <td>3.34</td>
        <td>Покрытие</td>
        <td>propertyCoverageOptions.liability</td>
        <td>Гражданская ответственность</td>
        <td>Checkbox</td>
        <td>false</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
    </tr>
</table>

### Шаг 3: Объект страхования - Жизнь и здоровье

<table>
    <tr>
        <th>№</th>
        <th>Раздел</th>
        <th>Ключ в форме</th>
        <th>Название поля</th>
        <th>Тип поля</th>
        <th>Значение</th>
        <th>Валидация</th>
        <th>Подсказка</th>
        <th>Примечание</th>
    </tr>
    <tr>
        <td>3.35</td>
        <td>Здоровье</td>
        <td>health.height</td>
        <td>Рост (см)</td>
        <td>Input[number]</td>
        <td>undefined</td>
        <td>Обязательное, min: 100, max: 250</td>
        <td>175</td>
        <td>Условно: insuranceType='life'. Используется для BMI</td>
    </tr>
    <tr>
        <td>3.36</td>
        <td>Здоровье</td>
        <td>health.weight</td>
        <td>Вес (кг)</td>
        <td>Input[number]</td>
        <td>undefined</td>
        <td>Обязательное, min: 30, max: 300</td>
        <td>70</td>
        <td>Используется для BMI</td>
    </tr>
    <tr>
        <td>3.37</td>
        <td>Здоровье</td>
        <td>health.bmi</td>
        <td>Индекс массы тела</td>
        <td>Input[number] readonly</td>
        <td>undefined</td>
        <td>Computed</td>
        <td>-</td>
        <td>Вычисляется: weight / (height/100)²</td>
    </tr>
    <tr>
        <td>3.38</td>
        <td>Здоровье</td>
        <td>health.bloodPressure</td>
        <td>Артериальное давление</td>
        <td>Input</td>
        <td>''</td>
        <td>Необязательное</td>
        <td>120/80</td>
        <td>-</td>
    </tr>
    <tr>
        <td>3.39</td>
        <td>Привычки</td>
        <td>health.isSmoker</td>
        <td>Курящий</td>
        <td>Checkbox</td>
        <td>false</td>
        <td>-</td>
        <td>-</td>
        <td>Влияет на коэффициент</td>
    </tr>
    <tr>
        <td>3.40</td>
        <td>Привычки</td>
        <td>health.smokingYears</td>
        <td>Стаж курения (лет)</td>
        <td>Input[number]</td>
        <td>undefined</td>
        <td>Условное (при isSmoker=true), min: 0</td>
        <td>5</td>
        <td>-</td>
    </tr>
    <tr>
        <td>3.41</td>
        <td>Заболевания</td>
        <td>health.hasChronicDiseases</td>
        <td>Хронические заболевания</td>
        <td>Checkbox</td>
        <td>false</td>
        <td>-</td>
        <td>-</td>
        <td>Влияет на коэффициент</td>
    </tr>
    <tr>
        <td>3.42</td>
        <td>Заболевания</td>
        <td>health.chronicDiseases</td>
        <td>Описание заболеваний</td>
        <td>Textarea</td>
        <td>''</td>
        <td>Условное (при hasChronicDiseases=true)</td>
        <td>Перечислите заболевания</td>
        <td>-</td>
    </tr>
    <tr>
        <td>3.43</td>
        <td>Операции</td>
        <td>health.hadSurgeries</td>
        <td>Перенесенные операции</td>
        <td>Checkbox</td>
        <td>false</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
    </tr>
    <tr>
        <td>3.44</td>
        <td>Операции</td>
        <td>health.surgeries</td>
        <td>Описание операций</td>
        <td>Textarea</td>
        <td>''</td>
        <td>Условное (при hadSurgeries=true)</td>
        <td>Перечислите операции</td>
        <td>-</td>
    </tr>
    <tr>
        <td>3.45</td>
        <td>Работа</td>
        <td>health.occupation</td>
        <td>Род занятий</td>
        <td>Input</td>
        <td>''</td>
        <td>Обязательное</td>
        <td>Менеджер</td>
        <td>-</td>
    </tr>
    <tr>
        <td>3.46</td>
        <td>Работа</td>
        <td>health.isHighRiskJob</td>
        <td>Опасная профессия</td>
        <td>Checkbox</td>
        <td>false</td>
        <td>-</td>
        <td>-</td>
        <td>Влияет на коэффициент</td>
    </tr>
    <tr>
        <td>3.47</td>
        <td>Спорт</td>
        <td>health.practicesSports</td>
        <td>Занятия спортом</td>
        <td>Checkbox</td>
        <td>false</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
    </tr>
    <tr>
        <td>3.48</td>
        <td>Спорт</td>
        <td>health.extremeSports</td>
        <td>Экстремальные виды спорта</td>
        <td>Checkbox</td>
        <td>false</td>
        <td>Условное (при practicesSports=true)</td>
        <td>-</td>
        <td>Влияет на коэффициент</td>
    </tr>
    <tr>
        <td>3.49</td>
        <td>Покрытие</td>
        <td>lifeCoverageOptions.death</td>
        <td>Страхование на случай смерти</td>
        <td>Checkbox</td>
        <td>true</td>
        <td>Хотя бы один выбран</td>
        <td>-</td>
        <td>-</td>
    </tr>
    <tr>
        <td>3.50</td>
        <td>Покрытие</td>
        <td>lifeCoverageOptions.disability</td>
        <td>Страхование инвалидности</td>
        <td>Checkbox</td>
        <td>false</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
    </tr>
    <tr>
        <td>3.51</td>
        <td>Покрытие</td>
        <td>lifeCoverageOptions.criticalIllness</td>
        <td>Критические заболевания</td>
        <td>Checkbox</td>
        <td>false</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
    </tr>
    <tr>
        <td>3.52</td>
        <td>Покрытие</td>
        <td>lifeCoverageOptions.accident</td>
        <td>Несчастные случаи</td>
        <td>Checkbox</td>
        <td>false</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
    </tr>
</table>

### Шаг 3: Объект страхования - Путешествия

<table>
    <tr>
        <th>№</th>
        <th>Раздел</th>
        <th>Ключ в форме</th>
        <th>Название поля</th>
        <th>Тип поля</th>
        <th>Значение</th>
        <th>Валидация</th>
        <th>Подсказка</th>
        <th>Примечание</th>
    </tr>
    <tr>
        <td>3.53</td>
        <td>Поездка</td>
        <td>travel.destination</td>
        <td>Страна/регион назначения</td>
        <td>Select</td>
        <td>'europe'</td>
        <td>Обязательное</td>
        <td>Выберите регион</td>
        <td>Условно: insuranceType='travel'. Варианты: Европа, Азия, США и Канада, СНГ, Весь мир</td>
    </tr>
    <tr>
        <td>3.54</td>
        <td>Поездка</td>
        <td>travel.tripPurpose</td>
        <td>Цель поездки</td>
        <td>Select</td>
        <td>'tourism'</td>
        <td>Обязательное</td>
        <td>Выберите цель</td>
        <td>Варианты: Туризм, Бизнес, Обучение, Работа, Другое</td>
    </tr>
    <tr>
        <td>3.55</td>
        <td>Даты</td>
        <td>travel.departureDate</td>
        <td>Дата отъезда</td>
        <td>Input[date]</td>
        <td>''</td>
        <td>Обязательное, >= сегодня</td>
        <td>-</td>
        <td>-</td>
    </tr>
    <tr>
        <td>3.56</td>
        <td>Даты</td>
        <td>travel.returnDate</td>
        <td>Дата возвращения</td>
        <td>Input[date]</td>
        <td>''</td>
        <td>Обязательное, > departureDate</td>
        <td>-</td>
        <td>-</td>
    </tr>
    <tr>
        <td>3.57</td>
        <td>Даты</td>
        <td>travel.tripDuration</td>
        <td>Длительность поездки (дни)</td>
        <td>Input[number] readonly</td>
        <td>undefined</td>
        <td>Computed</td>
        <td>-</td>
        <td>Вычисляется из дат</td>
    </tr>
    <tr>
        <td>3.58</td>
        <td>Тип полиса</td>
        <td>travel.isMultipleTrips</td>
        <td>Мультипоездка (годовой полис)</td>
        <td>Checkbox</td>
        <td>false</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
    </tr>
    <tr>
        <td>3.59</td>
        <td>Путешественники</td>
        <td>travelers[].fullName</td>
        <td>ФИО</td>
        <td>Input</td>
        <td>''</td>
        <td>Обязательное</td>
        <td>Ivanov Ivan</td>
        <td>ArrayNode - массив форм Traveler</td>
    </tr>
    <tr>
        <td>3.60</td>
        <td>Путешественники</td>
        <td>travelers[].birthDate</td>
        <td>Дата рождения</td>
        <td>Input[date]</td>
        <td>''</td>
        <td>Обязательное</td>
        <td>-</td>
        <td>-</td>
    </tr>
    <tr>
        <td>3.61</td>
        <td>Путешественники</td>
        <td>travelers[].passportNumber</td>
        <td>Номер загранпаспорта</td>
        <td>Input</td>
        <td>''</td>
        <td>Обязательное</td>
        <td>00 0000000</td>
        <td>-</td>
    </tr>
    <tr>
        <td>3.62</td>
        <td>Покрытие</td>
        <td>travelCoverageOptions.medical</td>
        <td>Медицинские расходы</td>
        <td>Checkbox</td>
        <td>true</td>
        <td>Хотя бы один выбран</td>
        <td>-</td>
        <td>-</td>
    </tr>
    <tr>
        <td>3.63</td>
        <td>Покрытие</td>
        <td>travelCoverageOptions.baggage</td>
        <td>Багаж</td>
        <td>Checkbox</td>
        <td>false</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
    </tr>
    <tr>
        <td>3.64</td>
        <td>Покрытие</td>
        <td>travelCoverageOptions.tripCancellation</td>
        <td>Отмена поездки</td>
        <td>Checkbox</td>
        <td>false</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
    </tr>
    <tr>
        <td>3.65</td>
        <td>Покрытие</td>
        <td>travelCoverageOptions.flightDelay</td>
        <td>Задержка рейса</td>
        <td>Checkbox</td>
        <td>false</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
    </tr>
    <tr>
        <td>3.66</td>
        <td>Покрытие</td>
        <td>travelCoverageOptions.carRental</td>
        <td>Аренда авто</td>
        <td>Checkbox</td>
        <td>false</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
    </tr>
</table>

### Шаг 4: Водители и застрахованные лица

<table>
    <tr>
        <th>№</th>
        <th>Раздел</th>
        <th>Ключ в форме</th>
        <th>Название поля</th>
        <th>Тип поля</th>
        <th>Значение</th>
        <th>Валидация</th>
        <th>Подсказка</th>
        <th>Примечание</th>
    </tr>
    <tr>
        <td>4.1</td>
        <td>Водители</td>
        <td>drivers[].fullName</td>
        <td>ФИО водителя</td>
        <td>Input</td>
        <td>''</td>
        <td>Обязательное</td>
        <td>Иванов Иван Иванович</td>
        <td>Условно: insuranceType in ['casco', 'osago']. ArrayNode</td>
    </tr>
    <tr>
        <td>4.2</td>
        <td>Водители</td>
        <td>drivers[].birthDate</td>
        <td>Дата рождения</td>
        <td>Input[date]</td>
        <td>''</td>
        <td>Обязательное</td>
        <td>-</td>
        <td>Используется для вычисления возраста</td>
    </tr>
    <tr>
        <td>4.3</td>
        <td>Водители</td>
        <td>drivers[].licenseNumber</td>
        <td>Номер ВУ</td>
        <td>Input</td>
        <td>''</td>
        <td>Обязательное</td>
        <td>00 00 000000</td>
        <td>-</td>
    </tr>
    <tr>
        <td>4.4</td>
        <td>Водители</td>
        <td>drivers[].licenseIssueDate</td>
        <td>Дата выдачи ВУ</td>
        <td>Input[date]</td>
        <td>''</td>
        <td>Обязательное</td>
        <td>-</td>
        <td>Используется для вычисления стажа</td>
    </tr>
    <tr>
        <td>4.5</td>
        <td>Водители</td>
        <td>drivers[].drivingExperience</td>
        <td>Стаж вождения (лет)</td>
        <td>Input[number] readonly</td>
        <td>undefined</td>
        <td>Computed</td>
        <td>-</td>
        <td>Вычисляется из licenseIssueDate</td>
    </tr>
    <tr>
        <td>4.6</td>
        <td>Водители</td>
        <td>drivers[].accidentsCount</td>
        <td>Кол-во ДТП за 3 года</td>
        <td>Input[number]</td>
        <td>0</td>
        <td>Обязательное, min: 0</td>
        <td>0</td>
        <td>Влияет на КБМ</td>
    </tr>
    <tr>
        <td>4.7</td>
        <td>Водители</td>
        <td>drivers[].isMainDriver</td>
        <td>Основной водитель</td>
        <td>Checkbox</td>
        <td>false</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
    </tr>
    <tr>
        <td>4.8</td>
        <td>Водители</td>
        <td>unlimitedDrivers</td>
        <td>Неограниченное количество водителей</td>
        <td>Checkbox</td>
        <td>false</td>
        <td>-</td>
        <td>-</td>
        <td>При true — список водителей не требуется</td>
    </tr>
    <tr>
        <td>4.9</td>
        <td>Водители</td>
        <td>minDriverAge</td>
        <td>Мин. возраст водителя</td>
        <td>Input[number] readonly</td>
        <td>undefined</td>
        <td>Computed</td>
        <td>-</td>
        <td>Минимальный возраст среди всех водителей</td>
    </tr>
    <tr>
        <td>4.10</td>
        <td>Водители</td>
        <td>minDriverExperience</td>
        <td>Мин. стаж водителя</td>
        <td>Input[number] readonly</td>
        <td>undefined</td>
        <td>Computed</td>
        <td>-</td>
        <td>Минимальный стаж среди всех водителей</td>
    </tr>
    <tr>
        <td>4.11</td>
        <td>Выгодоприобретатели</td>
        <td>beneficiaries[].fullName</td>
        <td>ФИО</td>
        <td>Input</td>
        <td>''</td>
        <td>Обязательное</td>
        <td>Иванов Иван Иванович</td>
        <td>Условно: insuranceType='life'. ArrayNode</td>
    </tr>
    <tr>
        <td>4.12</td>
        <td>Выгодоприобретатели</td>
        <td>beneficiaries[].birthDate</td>
        <td>Дата рождения</td>
        <td>Input[date]</td>
        <td>''</td>
        <td>Обязательное</td>
        <td>-</td>
        <td>-</td>
    </tr>
    <tr>
        <td>4.13</td>
        <td>Выгодоприобретатели</td>
        <td>beneficiaries[].relationship</td>
        <td>Степень родства</td>
        <td>Select</td>
        <td>'spouse'</td>
        <td>Обязательное</td>
        <td>Выберите</td>
        <td>Варианты: Супруг(а), Ребенок, Родитель, Брат/сестра, Другое</td>
    </tr>
    <tr>
        <td>4.14</td>
        <td>Выгодоприобретатели</td>
        <td>beneficiaries[].share</td>
        <td>Доля (%)</td>
        <td>Input[number]</td>
        <td>undefined</td>
        <td>Обязательное, min: 1, max: 100</td>
        <td>50</td>
        <td>Сумма всех долей должна быть 100%</td>
    </tr>
    <tr>
        <td>4.15</td>
        <td>Выгодоприобретатели</td>
        <td>beneficiaries[].phone</td>
        <td>Телефон</td>
        <td>InputMask</td>
        <td>''</td>
        <td>Обязательное, mask: '+7 (999) 999-99-99'</td>
        <td>+7 (___) ___-__-__</td>
        <td>-</td>
    </tr>
    <tr>
        <td>4.16</td>
        <td>Выгодоприобретатели</td>
        <td>totalBeneficiaryShare</td>
        <td>Сумма долей (%)</td>
        <td>Input[number] readonly</td>
        <td>undefined</td>
        <td>Computed, должно быть 100%</td>
        <td>-</td>
        <td>Сумма всех beneficiaries[].share</td>
    </tr>
</table>

### Шаг 5: История и дополнительная информация

<table>
    <tr>
        <th>№</th>
        <th>Раздел</th>
        <th>Ключ в форме</th>
        <th>Название поля</th>
        <th>Тип поля</th>
        <th>Значение</th>
        <th>Валидация</th>
        <th>Подсказка</th>
        <th>Примечание</th>
    </tr>
    <tr>
        <td>5.1</td>
        <td>Предыдущий полис</td>
        <td>hasPreviousInsurance</td>
        <td>Был ли полис ранее</td>
        <td>Checkbox</td>
        <td>false</td>
        <td>-</td>
        <td>-</td>
        <td>Управляет отображением полей предыдущего полиса</td>
    </tr>
    <tr>
        <td>5.2</td>
        <td>Предыдущий полис</td>
        <td>previousInsurer</td>
        <td>Предыдущий страховщик</td>
        <td>Input</td>
        <td>''</td>
        <td>Условное (при hasPreviousInsurance=true)</td>
        <td>Название компании</td>
        <td>-</td>
    </tr>
    <tr>
        <td>5.3</td>
        <td>Предыдущий полис</td>
        <td>previousPolicyNumber</td>
        <td>Номер предыдущего полиса</td>
        <td>Input</td>
        <td>''</td>
        <td>Условное (при hasPreviousInsurance=true)</td>
        <td>XXX-000000</td>
        <td>-</td>
    </tr>
    <tr>
        <td>5.4</td>
        <td>Предыдущий полис</td>
        <td>previousPolicyEndDate</td>
        <td>Дата окончания предыдущего полиса</td>
        <td>Input[date]</td>
        <td>''</td>
        <td>Условное (при hasPreviousInsurance=true)</td>
        <td>-</td>
        <td>-</td>
    </tr>
    <tr>
        <td>5.5</td>
        <td>Страховые случаи</td>
        <td>hadClaims</td>
        <td>Были ли страховые случаи</td>
        <td>Checkbox</td>
        <td>false</td>
        <td>-</td>
        <td>-</td>
        <td>Управляет отображением массива claims</td>
    </tr>
    <tr>
        <td>5.6</td>
        <td>Страховые случаи</td>
        <td>claims[].date</td>
        <td>Дата события</td>
        <td>Input[date]</td>
        <td>''</td>
        <td>Обязательное</td>
        <td>-</td>
        <td>ArrayNode - массив форм Claim</td>
    </tr>
    <tr>
        <td>5.7</td>
        <td>Страховые случаи</td>
        <td>claims[].type</td>
        <td>Тип события</td>
        <td>Select</td>
        <td>'accident'</td>
        <td>Обязательное</td>
        <td>Выберите тип</td>
        <td>Варианты: ДТП, Угон/кража, Повреждение, Стихийное бедствие, Медицинский случай, Другое</td>
    </tr>
    <tr>
        <td>5.8</td>
        <td>Страховые случаи</td>
        <td>claims[].description</td>
        <td>Описание</td>
        <td>Textarea</td>
        <td>''</td>
        <td>Обязательное</td>
        <td>Опишите событие</td>
        <td>-</td>
    </tr>
    <tr>
        <td>5.9</td>
        <td>Страховые случаи</td>
        <td>claims[].amount</td>
        <td>Сумма выплаты (₽)</td>
        <td>Input[number]</td>
        <td>undefined</td>
        <td>Обязательное, min: 0</td>
        <td>100000</td>
        <td>-</td>
    </tr>
    <tr>
        <td>5.10</td>
        <td>Страховые случаи</td>
        <td>claims[].atFault</td>
        <td>По вине страхователя</td>
        <td>Checkbox</td>
        <td>false</td>
        <td>-</td>
        <td>-</td>
        <td>Влияет на КБМ</td>
    </tr>
    <tr>
        <td>5.11</td>
        <td>Дополнительно</td>
        <td>promoCode</td>
        <td>Промокод</td>
        <td>Input</td>
        <td>''</td>
        <td>Необязательное</td>
        <td>PROMO2024</td>
        <td>Проверяется на сервере</td>
    </tr>
    <tr>
        <td>5.12</td>
        <td>Дополнительно</td>
        <td>referralSource</td>
        <td>Откуда узнали о нас</td>
        <td>Select</td>
        <td>'internet'</td>
        <td>Необязательное</td>
        <td>Выберите источник</td>
        <td>Варианты: Интернет, Рекомендации друзей, Телевидение, Страховой агент, Другое</td>
    </tr>
    <tr>
        <td>5.13</td>
        <td>Дополнительно</td>
        <td>agentCode</td>
        <td>Код агента</td>
        <td>Input</td>
        <td>''</td>
        <td>Необязательное</td>
        <td>AGT-000</td>
        <td>-</td>
    </tr>
    <tr>
        <td>5.14</td>
        <td>Дополнительно</td>
        <td>additionalNotes</td>
        <td>Дополнительные комментарии</td>
        <td>Textarea</td>
        <td>''</td>
        <td>Необязательное</td>
        <td>Ваши пожелания...</td>
        <td>-</td>
    </tr>
</table>

### Шаг 6: Расчет и подтверждение

<table>
    <tr>
        <th>№</th>
        <th>Раздел</th>
        <th>Ключ в форме</th>
        <th>Название поля</th>
        <th>Тип поля</th>
        <th>Значение</th>
        <th>Валидация</th>
        <th>Подсказка</th>
        <th>Примечание</th>
    </tr>
    <tr>
        <td>6.1</td>
        <td>Расчет</td>
        <td>basePremium</td>
        <td>Базовая премия (₽)</td>
        <td>Input[number] readonly</td>
        <td>undefined</td>
        <td>Computed</td>
        <td>-</td>
        <td>Зависит от типа страхования и страховой суммы</td>
    </tr>
    <tr>
        <td>6.2</td>
        <td>Коэффициенты</td>
        <td>ageCoefficient</td>
        <td>Коэффициент возраста</td>
        <td>Input[number] readonly</td>
        <td>undefined</td>
        <td>Computed</td>
        <td>-</td>
        <td>Диапазон: 1.0 - 1.8</td>
    </tr>
    <tr>
        <td>6.3</td>
        <td>Коэффициенты</td>
        <td>experienceCoefficient</td>
        <td>Коэффициент стажа</td>
        <td>Input[number] readonly</td>
        <td>undefined</td>
        <td>Computed</td>
        <td>-</td>
        <td>Диапазон: 1.0 - 1.6</td>
    </tr>
    <tr>
        <td>6.4</td>
        <td>Коэффициенты</td>
        <td>regionCoefficient</td>
        <td>Региональный коэффициент</td>
        <td>Input[number] readonly</td>
        <td>undefined</td>
        <td>Computed</td>
        <td>-</td>
        <td>Диапазон: 0.8 - 2.0</td>
    </tr>
    <tr>
        <td>6.5</td>
        <td>Коэффициенты</td>
        <td>claimsCoefficient</td>
        <td>Коэффициент аварийности (КБМ)</td>
        <td>Input[number] readonly</td>
        <td>undefined</td>
        <td>Computed</td>
        <td>-</td>
        <td>Диапазон: 0.5 - 2.5</td>
    </tr>
    <tr>
        <td>6.6</td>
        <td>Скидки</td>
        <td>deductibleDiscount</td>
        <td>Скидка за франшизу (%)</td>
        <td>Input[number] readonly</td>
        <td>undefined</td>
        <td>Computed</td>
        <td>-</td>
        <td>deductible / coverageAmount * 50%</td>
    </tr>
    <tr>
        <td>6.7</td>
        <td>Скидки</td>
        <td>promoDiscount</td>
        <td>Скидка по промокоду (%)</td>
        <td>Input[number] readonly</td>
        <td>undefined</td>
        <td>Computed</td>
        <td>-</td>
        <td>Диапазон: 0 - 15%</td>
    </tr>
    <tr>
        <td>6.8</td>
        <td>Скидки</td>
        <td>multiPolicyDiscount</td>
        <td>Скидка за комплексное страхование (%)</td>
        <td>Input[number] readonly</td>
        <td>undefined</td>
        <td>Computed</td>
        <td>-</td>
        <td>10% при наличии других полисов</td>
    </tr>
    <tr>
        <td>6.9</td>
        <td>Итого</td>
        <td>totalPremium</td>
        <td>Итоговая премия (₽)</td>
        <td>Input[number] readonly</td>
        <td>undefined</td>
        <td>Computed</td>
        <td>-</td>
        <td>Финальная стоимость полиса</td>
    </tr>
    <tr>
        <td>6.10</td>
        <td>Итого</td>
        <td>installmentAmount</td>
        <td>Сумма платежа (₽)</td>
        <td>Input[number] readonly</td>
        <td>undefined</td>
        <td>Computed</td>
        <td>-</td>
        <td>totalPremium / installments * 1.05 (при рассрочке)</td>
    </tr>
    <tr>
        <td>6.11</td>
        <td>Согласия</td>
        <td>agreePersonalData</td>
        <td>Согласие на обработку персональных данных</td>
        <td>Checkbox</td>
        <td>false</td>
        <td>Обязательное (must be true)</td>
        <td>-</td>
        <td>-</td>
    </tr>
    <tr>
        <td>6.12</td>
        <td>Согласия</td>
        <td>agreeTerms</td>
        <td>Согласие с правилами страхования</td>
        <td>Checkbox</td>
        <td>false</td>
        <td>Обязательное (must be true)</td>
        <td>-</td>
        <td>-</td>
    </tr>
    <tr>
        <td>6.13</td>
        <td>Согласия</td>
        <td>agreeElectronicPolicy</td>
        <td>Согласие на электронный полис</td>
        <td>Checkbox</td>
        <td>false</td>
        <td>Обязательное (must be true)</td>
        <td>-</td>
        <td>-</td>
    </tr>
    <tr>
        <td>6.14</td>
        <td>Согласия</td>
        <td>agreeMarketing</td>
        <td>Согласие на рекламу</td>
        <td>Checkbox</td>
        <td>false</td>
        <td>Необязательное</td>
        <td>-</td>
        <td>-</td>
    </tr>
    <tr>
        <td>6.15</td>
        <td>Подтверждение</td>
        <td>confirmAccuracy</td>
        <td>Подтверждение достоверности данных</td>
        <td>Checkbox</td>
        <td>false</td>
        <td>Обязательное (must be true)</td>
        <td>-</td>
        <td>-</td>
    </tr>
    <tr>
        <td>6.16</td>
        <td>Подтверждение</td>
        <td>electronicSignature</td>
        <td>SMS-код подтверждения</td>
        <td>InputMask</td>
        <td>''</td>
        <td>Обязательное, mask: '999999'</td>
        <td>000000</td>
        <td>6-значный код</td>
    </tr>
</table>

### Вычисляемые поля (Computed Fields)

<table>
    <tr>
        <th>№</th>
        <th>Ключ в форме</th>
        <th>Название поля</th>
        <th>Тип поля</th>
        <th>Зависимости</th>
        <th>Формула вычисления</th>
        <th>Примечание</th>
    </tr>
    <tr>
        <td>C.1</td>
        <td>endDate</td>
        <td>Дата окончания полиса</td>
        <td>Input[date] readonly</td>
        <td>startDate, insurancePeriod</td>
        <td>startDate + insurancePeriod месяцев</td>
        <td>-</td>
    </tr>
    <tr>
        <td>C.2</td>
        <td>fullName</td>
        <td>Полное имя (ФИО)</td>
        <td>Input readonly</td>
        <td>personalData.lastName, firstName, middleName</td>
        <td>Конкатенация: Фамилия Имя Отчество</td>
        <td>-</td>
    </tr>
    <tr>
        <td>C.3</td>
        <td>age</td>
        <td>Возраст</td>
        <td>Input[number] readonly</td>
        <td>personalData.birthDate</td>
        <td>Разница между текущей датой и датой рождения</td>
        <td>Используется для валидации (18-75 лет)</td>
    </tr>
    <tr>
        <td>C.4</td>
        <td>health.bmi</td>
        <td>Индекс массы тела</td>
        <td>Input[number] readonly</td>
        <td>health.height, health.weight</td>
        <td>weight / (height / 100)²</td>
        <td>Только для страхования жизни</td>
    </tr>
    <tr>
        <td>C.5</td>
        <td>travel.tripDuration</td>
        <td>Длительность поездки (дни)</td>
        <td>Input[number] readonly</td>
        <td>travel.departureDate, travel.returnDate</td>
        <td>Разница в днях между датами</td>
        <td>Только для путешествий</td>
    </tr>
    <tr>
        <td>C.6</td>
        <td>drivers[].drivingExperience</td>
        <td>Стаж вождения (лет)</td>
        <td>Input[number] readonly</td>
        <td>drivers[].licenseIssueDate</td>
        <td>Разница между текущей датой и датой выдачи ВУ</td>
        <td>Для каждого водителя</td>
    </tr>
    <tr>
        <td>C.7</td>
        <td>minDriverAge</td>
        <td>Мин. возраст водителя</td>
        <td>Input[number] readonly</td>
        <td>drivers[].birthDate</td>
        <td>Math.min(...drivers.map(d => calculateAge(d.birthDate)))</td>
        <td>-</td>
    </tr>
    <tr>
        <td>C.8</td>
        <td>minDriverExperience</td>
        <td>Мин. стаж водителя</td>
        <td>Input[number] readonly</td>
        <td>drivers[].drivingExperience</td>
        <td>Math.min(...drivers.map(d => d.drivingExperience))</td>
        <td>-</td>
    </tr>
    <tr>
        <td>C.9</td>
        <td>totalBeneficiaryShare</td>
        <td>Сумма долей выгодоприобретателей</td>
        <td>Input[number] readonly</td>
        <td>beneficiaries[].share</td>
        <td>sum(beneficiaries.map(b => b.share))</td>
        <td>Должна быть равна 100%</td>
    </tr>
    <tr>
        <td>C.10</td>
        <td>basePremium</td>
        <td>Базовая премия</td>
        <td>Input[number] readonly</td>
        <td>insuranceType, coverageAmount</td>
        <td>calculateBasePremium(insuranceType, coverageAmount)</td>
        <td>Зависит от типа страхования</td>
    </tr>
    <tr>
        <td>C.11</td>
        <td>totalPremium</td>
        <td>Итоговая премия</td>
        <td>Input[number] readonly</td>
        <td>basePremium, все коэффициенты и скидки</td>
        <td>basePremium * коэффициенты * (1 - скидки)</td>
        <td>Финальная стоимость полиса</td>
    </tr>
    <tr>
        <td>C.12</td>
        <td>installmentAmount</td>
        <td>Сумма платежа</td>
        <td>Input[number] readonly</td>
        <td>totalPremium, installments, paymentType</td>
        <td>paymentType='installments' ? totalPremium / installments * 1.05 : totalPremium</td>
        <td>+5% за рассрочку</td>
    </tr>
</table>

## 🔄 Сценарии формы

### Инициализация формы

| Сценарий                     | Описание                                          | Условия выполнения                       |
| ---------------------------- | ------------------------------------------------- | ---------------------------------------- |
| **Загрузка пустой формы**    | Форма отображается без предзаполненных данных     | applicationId = null                     |
| **Загрузка с данными**       | Форма загружается с предзаполненными данными      | applicationId задан                      |
| **Восстановление состояния** | Форма восстанавливает данные из предыдущей сессии | Не реализовано                           |
| **Загрузка словарей**        | Загружаются актуальные справочные данные          | При загрузке данных заявки (параллельно) |

### Сохранение формы

| Сценарий                 | Описание                                | Условия             | Обработка ошибок          |
| ------------------------ | --------------------------------------- | ------------------- | ------------------------- |
| **Автосохранение**       | Автоматическое сохранение при изменении | Не реализовано      | -                         |
| **Сохранение по кнопке** | Сохранение при нажатии "Отправить"      | Все 6 шагов валидны | Показать ошибки валидации |
| **Сохранение черновика** | Сохранение неполной формы               | Не реализовано      | -                         |
| **Отправка на сервер**   | Финальное сохранение                    | Все поля валидны    | Alert с сообщением        |

### Поведение при изменении полей и зависимости

| Статус | Управляющее поле                        | Зависимые поля / Действие                                        | Тип поведения         | Условие                                | Описание                                                               |
| ------ | --------------------------------------- | ---------------------------------------------------------------- | --------------------- | -------------------------------------- | ---------------------------------------------------------------------- |
| ✅     | `insuranceType`                         | vehicle.*, property.*, health.*, travel.*                        | Условные поля         | При смене типа страхования             | Показываются только поля соответствующего типа                         |
| ✅     | `insuranceType`                         | drivers, beneficiaries                                           | Условные поля         | casco/osago → drivers, life → beneficiaries | Показывается соответствующий массив                                   |
| ✅     | `insuredType`                           | personalData.*, passportData.*, companyData.*                    | Условные поля         | individual/company                     | Показываются поля для физ/юр лица                                      |
| ✅     | `paymentType`                           | installments                                                     | Условные поля         | paymentType='installments'             | Показывается выбор количества платежей                                 |
| ✅     | `vehicle.hasAntiTheft`                  | vehicle.antiTheftBrand                                           | Условные поля         | hasAntiTheft=true                      | Показывается поле марки противоугонки                                  |
| ✅     | `health.isSmoker`                       | health.smokingYears                                              | Условные поля         | isSmoker=true                          | Показывается поле стажа курения                                        |
| ✅     | `health.hasChronicDiseases`             | health.chronicDiseases                                           | Условные поля         | hasChronicDiseases=true                | Показывается описание заболеваний                                      |
| ✅     | `health.hadSurgeries`                   | health.surgeries                                                 | Условные поля         | hadSurgeries=true                      | Показывается описание операций                                         |
| ✅     | `health.practicesSports`                | health.extremeSports                                             | Условные поля         | practicesSports=true                   | Показывается чекбокс экстремальных видов                               |
| ✅     | `property.type`                         | property.floor                                                   | Условные поля         | type='apartment'                       | Этаж только для квартир                                                |
| ✅     | `hasPreviousInsurance`                  | previousInsurer, previousPolicyNumber, previousPolicyEndDate     | Условные поля         | hasPreviousInsurance=true              | Показываются поля предыдущего полиса                                   |
| ✅     | `hadClaims`                             | claims[]                                                         | Управление массивом   | hadClaims=true                         | Показывается список страховых случаев                                  |
| ✅     | `startDate, insurancePeriod`            | endDate                                                          | Вычисляемое поле      | -                                      | Автоматический расчет даты окончания                                   |
| ✅     | `personalData.*`                        | fullName                                                         | Вычисляемое поле      | -                                      | Конкатенация ФИО                                                       |
| ✅     | `personalData.birthDate`                | age                                                              | Вычисляемое поле      | -                                      | Вычисление возраста                                                    |
| ✅     | `health.height, health.weight`          | health.bmi                                                       | Вычисляемое поле      | insuranceType='life'                   | Расчет индекса массы тела                                              |
| ✅     | `travel.departureDate, returnDate`      | travel.tripDuration                                              | Вычисляемое поле      | insuranceType='travel'                 | Расчет длительности поездки                                            |
| ✅     | `drivers[].licenseIssueDate`            | drivers[].drivingExperience                                      | Вычисляемое поле      | -                                      | Расчет стажа каждого водителя                                          |
| ✅     | `drivers[]`                             | minDriverAge, minDriverExperience                                | Вычисляемое поле      | -                                      | Расчет минимальных показателей                                         |
| ✅     | `beneficiaries[].share`                 | totalBeneficiaryShare                                            | Вычисляемое поле      | -                                      | Сумма долей выгодоприобретателей                                       |
| ✅     | Все параметры                           | basePremium, коэффициенты, скидки, totalPremium                  | Вычисляемое поле      | -                                      | Расчет стоимости полиса                                                |
| ✅     | `totalPremium, installments`            | installmentAmount                                                | Вычисляемое поле      | paymentType='installments'             | Расчет суммы платежа при рассрочке                                     |
| ✅     | `vehicle.brand`                         | Загрузка моделей автомобилей                                     | Динамическая загрузка | insuranceType in ['casco', 'osago']    | Асинхронная загрузка списка моделей                                    |
| ✅     | `promoCode`                             | promoDiscount                                                    | Проверка на сервере   | -                                      | Валидация промокода и получение скидки                                 |
| 🆕     | `totalBeneficiaryShare`                 | Валидация = 100%                                                 | Кросс-валидация       | insuranceType='life'                   | Сумма долей выгодоприобретателей должна быть 100%                      |
| 🆕     | `travel.returnDate`                     | Валидация > departureDate                                        | Кросс-валидация       | insuranceType='travel'                 | Дата возвращения должна быть позже даты отъезда                        |
| 🆕     | `age`                                   | Валидация 18-75                                                  | Кросс-валидация       | insuredType='individual'               | Возраст страхователя должен быть от 18 до 75 лет                       |
| 🆕     | `vehicle.year`                          | Валидация 1990-текущий год                                       | Кросс-валидация       | insuranceType in ['casco', 'osago']    | Год выпуска в допустимом диапазоне                                     |
| 🆕     | `insuranceType`                         | Сброс специфичных полей                                          | Сброс зависимых       | При смене типа                         | Очистка полей другого типа страхования                                 |
| 🆕     | `vehicle.brand`                         | Очистка vehicle.model                                            | Сброс зависимых       | При изменении марки                    | Очистка модели при смене марки                                         |
| 🆕     | Вычисляемые поля                        | Поля readonly                                                    | Блокировка            | -                                      | Все вычисляемые поля недоступны для редактирования                     |
| 🆕     | mode='view'                             | Все поля readonly                                                | Блокировка            | Режим просмотра                        | В режиме просмотра все поля заблокированы                              |
| 🆕     | `health.bmi`                            | Warning сообщение                                                | Предупреждение        | bmi > 30 или bmi < 18                  | Показать предупреждение о рисках                                       |
| 🆕     | `minDriverAge`                          | Warning сообщение                                                | Предупреждение        | minDriverAge < 22                      | Показать предупреждение о повышенном коэффициенте                      |
| 🆕     | `drivers[].accidentsCount`              | Ревалидация claimsCoefficient                                    | Ревалидация           | При изменении количества ДТП           | Пересчет коэффициента аварийности                                      |

### Сценарии ошибок

| Сценарий                     | Причина                                                              | Реакция системы                           | Fallback стратегия                                 |
| ---------------------------- | -------------------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------- |
| Ошибка загрузки данных       | Сеть недоступна или сервер не отвечает                               | Отображение экрана ошибки с красным фоном | Кнопка "Попробовать снова" (перезагрузка страницы) |
| Ошибка загрузки справочников | Сеть недоступна или сервер не отвечает                               | Отображение экрана ошибки                 | Кнопка "Попробовать снова"                         |
| Ошибка валидации шага        | Пользователь пытается перейти на следующий шаг с невалидными данными | Подсветка ошибок, блокировка перехода     | Исправить ошибки перед переходом                   |
| Ошибка валидации промокода   | Промокод недействителен или истек                                    | Сообщение об ошибке под полем             | Продолжить без скидки                              |
| Ошибка отправки формы        | Сеть недоступна или сервер не отвечает                               | Alert с сообщением об ошибке              | Повторить отправку                                 |
| Неверный SMS-код             | Пользователь ввел неправильный код                                   | Сообщение об ошибке, счетчик попыток      | Запросить новый код                                |

---

## 🔗 API интеграция

### Таблица API эндпоинтов

| Эндпоинт                                 | HTTP метод | Назначение                                    | Основные параметры                | HTTP статусы  |
| ---------------------------------------- | ---------- | --------------------------------------------- | --------------------------------- | ------------- |
| `/api/insurance/applications/{id}`       | GET        | Получение данных заявки по ID                 | id: string                        | 200, 404, 500 |
| `/api/insurance/dictionaries`            | GET        | Получение справочников                        | -                                 | 200, 500      |
| `/api/insurance/car-models/{brand}`      | GET        | Получение моделей автомобилей по марке        | brand: string                     | 200, 500      |
| `/api/insurance/validate-promo`          | POST       | Валидация промокода                           | { code: string }                  | 200, 400, 500 |
| `/api/insurance/calculate-premium`       | POST       | Расчет стоимости полиса                       | InsuranceApplicationFormType      | 200, 400, 500 |
| `/api/insurance/send-verification`       | POST       | Отправка SMS-кода подтверждения               | { phone: string }                 | 200, 400, 500 |
| `/api/insurance/applications`            | POST       | Создание заявки                               | InsuranceApplicationFormType      | 201, 400, 500 |

**Примечания:**

- Все API эндпоинты в текущей реализации заменены на mock-функции с задержкой
- Mock API находится в файле: `src/forms/insurance-application/api.ts`
- Реальные эндпоинты должны быть реализованы на бэкенде

### Детали API запросов

#### GET /api/insurance/applications/{id}

**Описание:** Загружает данные существующей заявки для редактирования или просмотра

**Параметры:**

- `id` - идентификатор заявки (string)

**Пример ответа (200):**

```json
{
  "success": true,
  "data": {
    "insuranceType": "casco",
    "insurancePeriod": 12,
    "startDate": "2024-01-01",
    "coverageAmount": 2000000,
    "personalData": {
      "lastName": "Иванов",
      "firstName": "Иван",
      "middleName": "Иванович"
    },
    ...
  }
}
```

**Пример ответа (404):**

```json
{
  "success": false,
  "error": "Заявка с ID \"123\" не найдена"
}
```

#### GET /api/insurance/dictionaries

**Описание:** Загружает справочники для заполнения Select-полей

**Пример ответа (200):**

```json
{
  "success": true,
  "data": {
    "carBrands": [
      { "value": "toyota", "label": "Toyota" },
      { "value": "bmw", "label": "BMW" }
    ],
    "regions": [
      { "value": "moscow", "label": "Москва" }
    ],
    "countries": [
      { "value": "europe", "label": "Европа" }
    ]
  }
}
```

#### POST /api/insurance/validate-promo

**Описание:** Проверяет валидность промокода и возвращает размер скидки

**Body:**

```json
{
  "code": "PROMO2024"
}
```

**Пример ответа (200):**

```json
{
  "success": true,
  "data": {
    "valid": true,
    "discount": 0.1
  }
}
```

#### POST /api/insurance/calculate-premium

**Описание:** Рассчитывает стоимость полиса на основе введенных данных

**Body:** Полные данные формы InsuranceApplicationFormType

**Пример ответа (200):**

```json
{
  "success": true,
  "data": {
    "basePremium": 50000,
    "ageCoefficient": 1.2,
    "experienceCoefficient": 1.0,
    "regionCoefficient": 1.5,
    "claimsCoefficient": 0.9,
    "deductibleDiscount": 0.05,
    "promoDiscount": 0.1,
    "multiPolicyDiscount": 0,
    "totalPremium": 72900
  }
}
```

#### POST /api/insurance/applications

**Описание:** Создает новую заявку на страхование

**Body:** Полные данные формы InsuranceApplicationFormType

**Пример ответа (201):**

```json
{
  "success": true,
  "data": {
    "id": "INS-2024-001234",
    "policyNumber": "POL-2024-567890",
    "message": "Заявка успешно создана. Полис будет отправлен на email."
  }
}
```

---

## Особенности реализации

### 1. Динамические коэффициенты
- Коэффициенты меняются в реальном времени при изменении данных
- Пользователь видит как влияет каждый параметр на стоимость

### 2. Сложная условная логика
- 5 разных типов страхования с уникальными полями
- Вложенные условия (например, `property.floor` только для квартир)
- Условия внутри условий (например, `health.smokingYears` при `isSmoker` при `insuranceType='life'`)

### 3. Множественные массивы
- Водители (с вычисляемым стажем)
- Выгодоприобретатели (с валидацией суммы долей = 100%)
- Путешественники
- История страховых случаев

### 4. Кросс-валидация
- Сумма долей выгодоприобретателей = 100%
- Дата возвращения > Дата отъезда
- Минимальный возраст/стаж водителя
- Возраст страхователя 18-75 лет

### 5. Интеграция с внешними сервисами
- Валидация VIN
- Проверка промокода
- Расчет премии на сервере
- SMS-подтверждение