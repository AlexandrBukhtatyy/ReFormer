# Форма: Заявка на кредит (сокращённая)

Фикстура для `tests/form-from-spec.test.ts`. Формат — тот же, что у спек репозитория
(`docs/specs/*.md`): HTML-таблица с колонками `Ключ в форме`, `Тип поля`, `Значение`,
`Валидация`. Тест разбирает её тем же кодом, что и настоящие спеки, поэтому формат менять
нельзя — иначе он начнёт проверять то, чего в проекте нет.

Девять полей — по одному представителю на класс поведения. Смысл каждой строки описан в
плане [docs/plans/valiant-herding-peacock.md](../../../../docs/plans/valiant-herding-peacock.md) §4.

### Шаг 1: Параметры кредита

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
        <td>Кредит</td>
        <td>loanType</td>
        <td>Тип кредита</td>
        <td>Select</td>
        <td>'consumer'</td>
        <td>Обязательное</td>
        <td>Выберите тип кредита</td>
        <td>consumer | mortgage | car</td>
    </tr>
    <tr>
        <td>1.2</td>
        <td>Кредит</td>
        <td>loanAmount</td>
        <td>Сумма кредита (₽)</td>
        <td>Input[number]</td>
        <td>null</td>
        <td>Обязательное, min: 50000, max: 10000000</td>
        <td>Введите сумму</td>
        <td>-</td>
    </tr>
    <tr>
        <td>1.3</td>
        <td>Ипотека</td>
        <td>propertyValue</td>
        <td>Стоимость недвижимости (₽)</td>
        <td>Input[number]</td>
        <td>null</td>
        <td>Условное (при loanType='mortgage'), min: 1000000</td>
        <td>Введите стоимость</td>
        <td>Включается только при выборе ипотеки</td>
    </tr>
    <tr>
        <td>1.4</td>
        <td>Автокредит</td>
        <td>carBrand</td>
        <td>Марка автомобиля</td>
        <td>Input</td>
        <td>''</td>
        <td>Условное (при loanType='car'), minLength: 2</td>
        <td>Введите марку</td>
        <td>Включается только при выборе автокредита</td>
    </tr>
    <tr>
        <td>1.5</td>
        <td>Кредит</td>
        <td>monthlyPayment</td>
        <td>Ежемесячный платёж (₽)</td>
        <td>Input[number]</td>
        <td>null</td>
        <td>-</td>
        <td>Рассчитывается автоматически</td>
        <td>Вычисляется автоматически по аннуитетной формуле от суммы и срока</td>
    </tr>
</table>

### Шаг 2: Заявитель

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
        <td>Заявитель</td>
        <td>firstName</td>
        <td>Имя</td>
        <td>Input</td>
        <td>''</td>
        <td>Обязательное, minLength: 2, maxLength: 50</td>
        <td>Введите имя</td>
        <td>-</td>
    </tr>
    <tr>
        <td>2.2</td>
        <td>Заявитель</td>
        <td>email</td>
        <td>Электронная почта</td>
        <td>Input</td>
        <td>''</td>
        <td>Обязательное, email</td>
        <td>Введите почту</td>
        <td>-</td>
    </tr>
    <tr>
        <td>2.3</td>
        <td>Заявитель</td>
        <td>hasCoBorrower</td>
        <td>Есть созаёмщик</td>
        <td>Checkbox</td>
        <td>false</td>
        <td>-</td>
        <td>Отметьте, если есть созаёмщик</td>
        <td>-</td>
    </tr>
    <tr>
        <td>2.4</td>
        <td>Заявитель</td>
        <td>comment</td>
        <td>Комментарий</td>
        <td>Textarea</td>
        <td>''</td>
        <td>-</td>
        <td>Необязательный комментарий</td>
        <td>-</td>
    </tr>
    <tr>
        <td>2.5</td>
        <td>Заявитель</td>
        <td>middleName</td>
        <td>Отчество</td>
        <td>Input</td>
        <td>''</td>
        <td>Необязательное, maxLength: 50</td>
        <td>При наличии</td>
        <td>«Необязательное» не должно стать required()</td>
    </tr>
    <tr>
        <td>2.5</td>
        <td>Созаёмщики</td>
        <td>coBorrowers[].monthlyIncome</td>
        <td>Доход созаёмщика</td>
        <td>Input[number]</td>
        <td>0</td>
        <td>Обязательное, min: 0</td>
        <td>Ежемесячный доход</td>
        <td>Элемент массива — синтаксис ключа разбором не поддержан</td>
    </tr>
    <tr>
        <td>2.6</td>
        <td>Расчёт</td>
        <td>totalIncome</td>
        <td>Совокупный доход</td>
        <td>Input[number] readonly</td>
        <td>0</td>
        <td>-</td>
        <td>Считается автоматически</td>
        <td>Пометка после скобки — тип обязан остаться числом</td>
    </tr>
</table>
