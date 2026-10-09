import { launchFromRuntime } from './application/builder-application';
import { boot } from './shell/boot/boot';
import { createBrowserTabEnvironment } from './shell/boot/environment';
import { fetchRuntimeBundle } from './shell/boot/runtime-config';
import { createEmbedding } from './shell/embedded/embedding';
import { mountStandaloneShell } from './shell/standalone/mount';
import {
  APPLICATION_ROOT_DIR,
  loadApplicationFiles,
} from './shell/platform/plugin/application/files';
import { readStoredPreset } from './shell/boot/stored-preset';
import {
  printStartupSummary,
  traced,
  traceSinceStart,
  traceSpan,
} from './shell/platform/primitives/trace';
import './index.css';

// Бут синхронный — в отличие от v1, где он async из-за модульной мемоизации в графе
// `store`/`catalog` (конфиг обязан встать до первого импорта этих модулей). В v2 такого графа
// нет: реестры и сервисы создаются явно, а не на импорте.
//
// Единственное, что стоит ПЕРЕД бутом, — ответ сервера запуска: конфиг уровня запуска
// (`.ui_builder/config.json` каталога, где сделали `npx reformer-builder` либо запустили
// dev-сервер приложения с плагином билдера) и то, что сервер сообщает о себе. Это не возврат
// старой болезни: сам boot остаётся синхронным и получает конфиг ПАРАМЕТРОМ, а ждать ответ
// приходится потому, что дефолты темы и локали применяются регистрацией умолчаний настроек —
// она однократная и происходит при сборке. Заход один, на localhost, и отказ (нет лаунчера —
// vite dev, чужой статик-сервер) — это штатный `null`: билдер работает на вшитых дефолтах.
//
// Рядом с конфигом читается выбор профиля, сделанный человеком в строке состояния: он обязан
// повлиять на сборку состава, а служба настроек появляется только внутри `boot`. Чтения
// независимы и идут параллельно; отказ второго — тоже штатный `null`, «человек не выбирал».
// Замер запуска: меры ставятся всегда (см. `shell/platform/primitives/trace`), а сводку
// в консоль печатает адрес с параметром `rb-trace`. Буфер запросов расширен заранее: по
// умолчанию он на 250 записей, а сводке нужны все файлы плагинов и чанки оболочки.
const TRACE_FLAG = 'rb-trace';
performance.setResourceTimingBufferSize?.(1000);
const launchConfigRead = traceSpan('launch.config');

void Promise.all([fetchRuntimeBundle(), readStoredPreset()]).then(([bundle, storedPreset]) => {
  launchConfigRead();
  const runtime = bundle.config;
  // Билдер отдаёт dev-сервер приложения — значит, рядом есть приложение и источник у них общий.
  // Вход один на оба случая: различается только окружение. Что сервер это сообщил, а не страница
  // догадалась, — см. `RuntimeBundle.embedded`.
  const embedding = bundle.embedded ? createEmbedding(window) : null;
  // Состав приложения приходит ОТСЮДА, а не изнутри оболочки. «Какие плагины образуют ReFormer
  // Builder» — вопрос приложения, а не механизма, который их поднимает: `boot` объявляет форму
  // композиции и получает её параметром. Знай он состав сам, второе приложение на той же оболочке
  // начиналось бы с правки `boot`, а список плагинов остался бы частью платформы запуска.
  //
  // Какой именно состав — решает конфиг уровня запуска: `preset` называет профиль, а
  // `plugins.enable/disable` его поправляет. Без конфига и при любой ошибке в нём собирается
  // полный профиль: опечатка в файле, который человек написал руками, не может стоить ему
  // инструмента. Тот же уровень и по той же причине, что у `defaults`, — состав фиксируется
  // ЗДЕСЬ, при сборке приложения, и проектный конфиг, читаемый после открытия проекта,
  // изменить его уже не может.
  //
  // Выбор человека сильнее `preset` — в пределах того, что конфиг предлагает (`presetChoices`).
  // Вместе с составом приложение отдаёт и сам список: оболочка профилей не знает, а службе
  // профилей нужно назвать их переключателю.
  const { application, profileChoices } = launchFromRuntime(runtime?.config ?? {}, storedPreset);
  const app = traced('boot.sync', () =>
    boot({
      runtime,
      application,
      profileChoices,
      // Окружение названо явно, хотя у вкладки оно совпадает с умолчанием сборки: чей здесь
      // документ и чей источник, должно читаться из входа, а не из умолчания.
      environment: embedding?.environment ?? createBrowserTabEnvironment(),
      // Плагины приложения лежат РЯДОМ СО СБОРКОЙ, в каталоге `plugins/` от её базового адреса:
      // их кладёт туда тот, кто приложение разворачивает (лаунчер, сборка для поставки, Pages).
      // Нет каталога — штатный `null`: так запускается билдер под `vite dev`, где плагины
      // остаются плагинами открытого проекта.
      applicationPluginFiles: () =>
        loadApplicationFiles({ baseUrl: `${import.meta.env.BASE_URL}${APPLICATION_ROOT_DIR}/` }),
    })
  );
  // Сохранения проекта — событие для превью приложением: следить за ними начинают, когда
  // сборка уже есть.
  embedding?.attach(app);
  // Как рисовать и когда поднимать проект — дело оболочки «своя вкладка»; вход только соединяет
  // её с составом и говорит, что считать первым кадром.
  mountStandaloneShell({
    app,
    container: document.getElementById('root')!,
    // Первый кадр — отметка, к которой сводится весь замер: всё, что до неё, человек ждёт
    // перед пустым окном.
    onFirstFrame: () => {
      traceSinceStart('first-frame');
      if (new URLSearchParams(window.location.search).has(TRACE_FLAG)) printStartupSummary();
    },
  });
});
