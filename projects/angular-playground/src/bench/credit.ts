/**
 * Вход замера: страница «credit» напрямую, без выбора страницы по пути и без ленивого чанка
 * (ср. ../main.ts). Prod-сборка конфигурацией `bench-credit` кладёт её по своему адресу
 * (`--base-href`), как страницы React и Vue: код формы приходит одним запросом с остальным.
 */
import { start } from '../cross/credit/page';

const container = document.getElementById('root');
if (!container) throw new Error('#root not found');
void start(container);
