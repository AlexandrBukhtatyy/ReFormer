import { test, expect } from '@playwright/test';
import { TreePage } from './tree-page.pom';

/**
 * E2E дерева и комбобоксов с деревом. Покрывает ровно то, чего не видят юниты кита: они идут
 * через `renderToStaticMarkup`, а здесь всё интересное происходит уже после первой отрисовки —
 * список живёт в портале поповера, ленивый уровень приезжает из источника, а состояние раскрытия
 * хранится в самом дереве и наружу выходит только атрибутами строки.
 *
 * Второй сквозной сюжет — граница между «выделено в дереве» и «выбрано как значение». Дерево
 * само по себе полем формы не является: у него нет ни `value`, ни `onChange`, и раскрытие ветки
 * модель не трогает. Проверяется это только снимком модели, по разметке разницы не видно.
 */
test.describe('Дерево и выбор файлов', () => {
  let po: TreePage;

  test.beforeEach(async ({ page }) => {
    po = new TreePage(page);
    await po.goto();
  });

  test('TREE-001: стартовое состояние — оба поля пусты, в модели null', async () => {
    const model = await po.modelSnapshot();
    // `null`, а не `[]` и не `''`: пустое значение у обоих вариантов выглядит одинаково.
    expect(model.configFile).toBeNull();
    expect(model.assetFiles).toBeNull();

    await expect(po.chips('assetFiles')).toHaveCount(0);
    // Крестик рисуется только при непустом значении — его отсутствие и есть признак пустоты.
    await expect(po.clearButton('configFile')).toHaveCount(0);
  });

  test('TREE-002: шеврон раскрывает и сворачивает ветку, модель при этом не меняется', async () => {
    const branch = await po.firstBranchId('tree-showcase');
    const before = await po.visibleIds('tree-showcase');

    await po.toggleChevron('tree-showcase', branch);
    await expect(po.row('tree-showcase', branch)).toHaveAttribute('aria-expanded', 'true');

    // Виртуальный список показывает окно строк, поэтому считать надо не «стало больше», а
    // «появились новые»: при заполненном окне число строк от раскрытия не меняется.
    const added = (await po.visibleIds('tree-showcase')).filter((id) => !before.includes(id));
    expect(added.length, 'дети раскрытой ветки появились в списке').toBeGreaterThan(0);

    // Свободный Tree — не поле формы. Раскрытие не значение, и модель обязана остаться пустой.
    const model = await po.modelSnapshot();
    expect(model.configFile).toBeNull();
    expect(model.assetFiles).toBeNull();

    await po.toggleChevron('tree-showcase', branch);
    await expect(po.row('tree-showcase', branch)).toHaveAttribute('aria-expanded', 'false');
    expect(await po.visibleIds('tree-showcase')).toEqual(before);
  });

  test('TREE-003: ленивый уровень читается один раз — крутилка, дети, повторное раскрытие без похода', async () => {
    const branch = await po.firstBranchId('tree-lazy');
    const before = await po.visibleIds('tree-lazy');

    await po.toggleChevron('tree-lazy', branch);
    // Пока уровень читается, место треугольника занимает крутилка — единственное свидетельство
    // похода в источник, доступное снаружи. Отсюда требование к демо: у ленивой карточки должна
    // быть заметная задержка, мгновенный источник ленивым не выглядит и ничего не показывает.
    await expect(po.loader('tree-lazy', branch)).toBeVisible();
    await expect(po.loader('tree-lazy', branch)).toBeHidden();

    const added = (await po.visibleIds('tree-lazy')).filter((id) => !before.includes(id));
    expect(added.length, 'прочитанный уровень добавил строки').toBeGreaterThan(0);

    await po.toggleChevron('tree-lazy', branch);
    await expect(po.row('tree-lazy', branch)).toHaveAttribute('aria-expanded', 'false');
    await po.toggleChevron('tree-lazy', branch);

    // Уровень уже прочитан: дети возвращаются тем же кадром, крутилке взяться неоткуда. Проверка
    // намеренно БЕЗ ожидания — ретрай `toHaveCount(0)` дождался бы конца второй загрузки и
    // прошёл бы даже там, где источник читается повторно.
    expect(await po.loader('tree-lazy', branch).count(), 'второго похода в источник нет').toBe(0);
    await expect(po.row('tree-lazy', added[0])).toBeVisible();
  });

  test('TREE-004-A: ComboboxTree — щелчок по каталогу раскрывает его, а не выбирает', async () => {
    await po.open('configFile');
    const branch = await po.firstBranchId('popover');
    await po.clickRow('popover', branch);

    await expect(po.row('popover', branch)).toHaveAttribute('aria-expanded', 'true');
    // `selectable='leaf'`: каталог значением быть не может, поэтому щелчок по нему не считается
    // выбором и поповер остаётся открытым — иначе до файлов внутри было бы не добраться мышью.
    await expect(po.popover()).toBeVisible();

    await po.close();
    await po.expectValue('configFile', null);
  });

  test('TREE-004-B: ComboboxTree — выбор файла закрывает поповер и кладёт в модель его адрес', async () => {
    const file = await po.openToFirstLeaf('configFile');
    const label = ((await po.rowLabel('popover', file).textContent()) ?? '').trim();

    await po.clickRow('popover', file);

    // Одиночный вариант закрывается по выбору — этим он и отличается от множественного.
    await expect(po.popover()).toBeHidden();
    // В модель уходит АДРЕС узла, а не его подпись: имя файла неоднозначно, путь — нет.
    await po.expectValue('configFile', file);
    // А в триггере — наоборот подпись выбранного узла.
    await expect(po.triggerValue('configFile')).toHaveText(label);
  });

  test('TREE-005: ComboboxTreeMulti — поповер не закрывается между выборами, чипы показывают выбранное', async () => {
    await po.openToFirstLeaf('assetFiles');
    const files = await po.leafIds('popover');
    expect(files.length, 'для множественного выбора нужно минимум два файла').toBeGreaterThan(1);

    await po.clickRow('popover', files[0]);
    // Ключевое отличие от одиночного варианта: выбор не закрывает список.
    await expect(po.popover()).toBeVisible();
    await expect(po.row('popover', files[0])).toHaveAttribute('data-checked', 'true');

    await po.clickRow('popover', files[1]);
    await expect(po.checks()).toHaveCount(2);
    await po.close();

    await expect(po.chips('assetFiles')).toHaveCount(2);
    // Порядок — в котором отмечали, а не в котором узлы лежат в дереве.
    await po.expectValue('assetFiles', [files[0], files[1]]);
  });

  test('TREE-006: ComboboxTreeMulti — снятие последнего файла даёт null, а не пустой массив', async () => {
    const file = await po.openToFirstLeaf('assetFiles');
    await po.clickRow('popover', file);
    await po.close();
    await po.expectValue('assetFiles', [file]);

    await po.open('assetFiles');
    // Путь до выбранного узла раскрывается при открытии сам — искать файл заново не нужно.
    await expect(po.row('popover', file)).toBeVisible();
    // Повторный щелчок по отмеченной строке снимает членство: чипы неинтерактивны намеренно,
    // и снять значение можно только здесь.
    await po.clickRow('popover', file);
    await expect(po.checks()).toHaveCount(0);
    await po.close();

    // Главный инвариант контракта: пустой выбор доходит до модели как `null`. Массив `[]` сделал
    // бы из поля ArrayNode, и поля бы не существовало; по разметке эту разницу не увидеть.
    await po.expectValue('assetFiles', null);
    await expect(po.chips('assetFiles')).toHaveCount(0);
  });

  test('TREE-007: крестик очистки возвращает поле в null', async () => {
    const file = await po.openToFirstLeaf('configFile');
    await po.clickRow('popover', file);
    await po.expectValue('configFile', file);

    await po.clear('configFile');
    // Крестик живёт ВНЕ триггера (интерактивный элемент внутри `button` — невалидная разметка),
    // поэтому щелчок по нему не открывает список.
    await expect(po.popover()).toBeHidden();
    await po.expectValue('configFile', null);
    // Значения нет — крестика тоже больше нет.
    await expect(po.clearButton('configFile')).toHaveCount(0);
  });

  test('TREE-008-A: required ловит пустой выбор (minLength(1) на null молчит)', async () => {
    await po.validate();

    // `minLength(1)` тут бесполезен: он делает ранний возврат на `null`, а пустой выбор приходит
    // именно как `null`. Обязательность множественного поля держится только на `required()`.
    await expect(po.error('assetFiles')).toBeVisible();

    const file = await po.openToFirstLeaf('assetFiles');
    await po.clickRow('popover', file);
    await po.close();
    await po.validate();
    await expect(po.error('assetFiles')).toBeHidden();
  });

  test('TREE-008-B: страница не даёт ошибок в консоли за сквозной сценарий', async () => {
    await po.toggleChevron('tree-showcase', await po.firstBranchId('tree-showcase'));
    await po.toggleChevron('tree-lazy', await po.firstBranchId('tree-lazy'));

    const config = await po.openToFirstLeaf('configFile');
    await po.clickRow('popover', config);

    const asset = await po.openToFirstLeaf('assetFiles');
    await po.clickRow('popover', asset);
    await po.close();

    await po.validate();
    await po.reset();
    await po.expectNoRuntimeErrors();
  });
});
