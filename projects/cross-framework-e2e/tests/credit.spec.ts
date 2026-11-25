/**
 * Кредитная заявка на каждом стеке: те же сценарии, что у conformance бенчмарка форм.
 * Стек задаёт проект Playwright (`credit:<стек>`) — адресом хоста и драйвером контролов; мастер и
 * массивы у трёх китов размечены одинаково (../markup.ts).
 */
import { CreditPage } from '../../forms-benchmark-e2e/pom/credit';
import { creditScenarios } from '../../forms-benchmark-e2e/scenarios/credit';
import { driverOf } from '../drivers';
import { kitMarkup } from '../markup';
import { pageSegment, type StackId } from '../stacks';

creditScenarios('кредит', (page, testInfo) => {
  const stack = testInfo.project.metadata.stack as StackId;
  return new CreditPage(page, pageSegment(stack), driverOf(stack), kitMarkup);
});
