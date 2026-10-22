import { FORM_A, savedText } from './shared/forms';
import { AGENT_FIELD, HAND_EDIT, turnWithHandEdit } from './shared/hand-edit';
import { expect, test } from './shared/fixtures';

/**
 * Ассистент: правки, которые не легли сами. Каталог сценариев — `SCENARIOS.md`, группы T и G.
 *
 * Расхождение: пока модель думала, человек поправил форму руками. Правки хода тогда не
 * применяются молча поверх, а ждут решения — «Применить всё равно» или «Отклонить».
 */

test.describe('Ассистент: расхождение с правкой руками', () => {
  test.setTimeout(150_000);

  test.beforeEach(async ({ builder, panel }) => {
    await builder.openPlayground({ plugins: ['reformer/ai'] });
    await builder.openFile(FORM_A);
    await panel.connect();
  });

  test('[G3] форму правили во время хода — превью; «Отклонить» сохраняет правку руками', async ({
    builder,
    disk,
    model,
    page,
    panel,
  }) => {
    await turnWithHandEdit(builder, page, model, panel);

    await expect(panel.changePreview).toBeVisible();
    await expect(panel.changePreview).toContainText('Форму изменили, пока ассистент работал');
    await panel.changePreview.getByRole('button', { name: 'Отклонить' }).click();
    await expect(panel.changePreview).toHaveCount(0);

    const saved = await savedText(builder, disk, FORM_A);
    expect(saved).toContain(HAND_EDIT);
    expect(saved).not.toContain(AGENT_FIELD);
  });

  test('[T10] «Применить всё равно» пишет правки хода поверх правки руками', async ({
    builder,
    disk,
    model,
    page,
    panel,
  }) => {
    await turnWithHandEdit(builder, page, model, panel);

    await panel.changePreview.getByRole('button', { name: 'Применить всё равно' }).click();
    await expect(panel.changePreview).toHaveCount(0);

    const saved = await savedText(builder, disk, FORM_A);
    expect(saved).toContain(AGENT_FIELD);
    expect(saved).not.toContain(HAND_EDIT);
    // Применённый поздно ход отменяется так же, как обычный.
    await expect(panel.undoTurnButton).toBeEnabled();
  });
});
