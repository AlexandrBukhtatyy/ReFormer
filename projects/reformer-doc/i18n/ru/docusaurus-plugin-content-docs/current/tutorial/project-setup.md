---
sidebar_position: 1
---

# Настройка проекта

Настройка проекта для работы с ReFormer.

## Требования

- Node.js 18+

## Настройка проекта

### Инициализация проекта

```bash
 # Создайте новый проект
npm create vite@latest reformer-tutorial -- --template react-ts

# Установите зависимости которые не требуют конфигурации
npm install @reformer/core
```

### Установка стилей TailwindCSS

:::info Внимание
Актуальная инструкция доступна на официальном сайте.
https://tailwindcss.com
:::

#### Установка зависимостей

```bash
npm install tailwindcss @tailwindcss/vite
```

#### Настройка проекта

Удалите все из файла стилей и оставьте там импорт стилей TailwindCSS.

```css title="reformer-tutorial/src/index.css"
@import 'tailwindcss';
```

Настройте конфигурацию Vite.

```typescript title="reformer-tutorial/vite.config.ts"
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

#### Удалите лишний код

Удалите reformer-tutorial/src/App.css
Удалите все лишнее из компонента App, оставив там следующий код.

```typescript title="reformer-tutorial/src/App.tsx"
function App() {
  return (
    <>
      <h1 className="text-3xl font-bold underline">Hello world!</h1>
    </>
  );
}

export default App;
```

#### Проверка

Запустите проект и убедитесь что стили TailwindCSS активны.

```bash
npm run dev # => http://localhost:5173/
```

### Установка shadcn

:::info Внимание
Актуальная инструкция доступна на официальном сайте.
https://ui.shadcn.com/
:::

#### Обновим конфигурацию проекта

```typescript title="reformer-tutorial/tsconfig.json"
{
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.node.json" }],
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

```typescript title="reformer-tutorial/tsconfig.app.json"
{
  "compilerOptions": {
    // ...
    "baseUrl": ".",
    "paths": {
      "@/*": [
        "./src/*"
      ]
    }
    // ...
  }
}
```

#### Установим зависимость, чтобы не было ошибок сборки

```bash
npm install -D @types/node
```

#### Обновим конфигурацию vite.

```typescript title="reformer-tutorial/vite.config.ts"
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

#### Инициализируем Shadcn

```bash
npx shadcn@latest init
```

<details>
  <summary>Ошибка: No Tailwind CSS configuration found</summary>

Если вы получите ошибку:

```bash
  No Tailwind CSS configuration found at D:\Work\ReFormer\projects\reformer-tutorial.
  It is likely you do not have Tailwind CSS installed or have an invalid configuration.
  Install Tailwind CSS then try again.
```

Перезапустите команду: `npm install tailwindcss @tailwindcss/vite`

</details>

#### Добавим первый компонент и проверим работу Shadcn

Запустим скрипт

```bash
npx shadcn@latest add button input select checkbox textarea radio-group
```

Модифицируем корневой компонент

```typescript title="reformer-tutorial/src/App.tsx"
import { Button } from "@/components/ui/button"

function App() {
  return (
    <div className="flex min-h-svh flex-col items-center py-6">
      <Button>Click me</Button>
    </div>
  )
}

export default App
```

#### Проверка

Если сервер еще не запущен, выполните команду и убедитесь что компонент кнопки отображается на экране.

```bash
npm run dev # => http://localhost:5173/
```

## Следующие шаги

После настройки проекта переходите к [Схема формы](./form-schema/interface), чтобы определить структуру данных формы.
