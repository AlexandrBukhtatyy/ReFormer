/**
 * Кредитная заявка на каждом стеке: те же сценарии, что у conformance бенчмарка форм.
 * Стек задаёт проект Playwright (`credit:<стек>`) — адресом хоста и драйвером контролов.
 */
import { CreditPage } from '../../forms-benchmark-e2e/pom/credit';
import { creditScenarios } from '../../forms-benchmark-e2e/scenarios/credit';
import { driverOf } from '../drivers';
import { CROSS_PAGE, type StackId } from '../stacks';

creditScenarios(
  'кредит',
  (page, testInfo) =>
    new CreditPage(page, CROSS_PAGE, driverOf(testInfo.project.metadata.stack as StackId))
);
