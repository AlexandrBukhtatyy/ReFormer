/**
 * Предусловие теста: артефакт, без которого тест не имеет смысла (документация пакетов, индексы,
 * собранный `dist`).
 *
 * Локально отсутствие артефакта — пропуск теста: пакет можно проверять и без полной сборки. В CI
 * тот же пропуск опасен: сломанная сборка документации молча выключила бы десятки тестов, и прогон
 * остался бы зелёным. Поэтому при `REFORMER_TEST_STRICT=1` невыполненное предусловие — ошибка.
 *
 * Все `runIf`/`skipIf` пакета берут условие отсюда; следит за этим `test-preconditions.test.ts`.
 */
export function precondition(name: string, available: boolean, hint: string): boolean {
  if (!available && process.env.REFORMER_TEST_STRICT === '1') {
    throw new Error(`Предусловие теста «${name}» не выполнено: ${hint}`);
  }
  return available;
}
