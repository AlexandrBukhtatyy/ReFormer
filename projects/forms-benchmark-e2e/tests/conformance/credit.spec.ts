/**
 * Conformance кредитной заявки: одинаковое видимое поведение всех реализаций
 * (docs/specs/credit-application-form.md + BENCH-CONTRACT §3, §8). Числа бенча имеют смысл только
 * при зелёном прогоне этого файла на всех реализациях.
 *
 * Сами сценарии — в ../../scenarios/credit.ts: их же исполняет кросс-фреймворк проверка.
 */
import { implementations } from '../../lib/participants';
import { CreditPage } from '../../pom/credit';
import { creditScenarios } from '../../scenarios/credit';

for (const lib of implementations('credit')) {
  creditScenarios(`${lib.id}: кредит`, (page) => new CreditPage(page, lib.id));
}
