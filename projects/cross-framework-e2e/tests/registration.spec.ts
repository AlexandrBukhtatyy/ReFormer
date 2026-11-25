/**
 * Форма регистрации на каждом стеке: те же сценарии, что у conformance бенчмарка форм.
 * Стек задаёт проект Playwright (`registration:<стек>`) — адресом хоста.
 */
import { RegistrationPage } from '../../forms-benchmark-e2e/pom/registration';
import { registrationScenarios } from '../../forms-benchmark-e2e/scenarios/registration';
import { CROSS_PAGE } from '../stacks';

registrationScenarios('регистрация', (page) => new RegistrationPage(page, CROSS_PAGE));
