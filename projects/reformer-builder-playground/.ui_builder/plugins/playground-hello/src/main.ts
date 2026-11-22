import { definePlugin } from '@reformer/builder-plugin-api';

export default definePlugin({
  id: 'playground-hello',
  activate(ctx) {
    ctx.subscriptions.push(
      ctx.commands.register({
        id: 'playground-hello.hello',
        // Ключ словаря плагина, а не текст: строки лежат в locales/*.json.
        titleKey: 'command.hello',
        run: () => true,
      })
    );
  },
});
