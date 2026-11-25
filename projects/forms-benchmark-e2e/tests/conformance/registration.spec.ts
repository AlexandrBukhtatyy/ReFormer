/**
 * Conformance формы регистрации: одинаковое видимое поведение всех реализаций
 * (docs/specs/registration-form.md + BENCH-CONTRACT §3). Числа бенча имеют смысл только при
 * зелёном прогоне этого файла на всех реализациях.
 *
 * Сами сценарии — в ../../scenarios/registration.ts: их же исполняет кросс-фреймворк проверка.
 */
import { implementations } from '../../lib/participants';
import { RegistrationPage } from '../../pom/registration';
import { registrationScenarios } from '../../scenarios/registration';

for (const lib of implementations('registration')) {
  registrationScenarios(`${lib.id}: регистрация`, (page) => new RegistrationPage(page, lib.id));
}
