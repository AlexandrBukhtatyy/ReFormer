---
sidebar_position: 1
---

# Настройка проекта

Настройка проекта для работы с ReFormer.

:::info В разработке
Этот раздел находится в разработке.
:::

## Требования

- Node.js 18+

## Настройка проекта

### Инициализация проекта

```bash
 # Создайте новый проект
npm create vite@latest reform-tutorial -- --template react-ts

# Установите зависимости которые не требуют конфигурации
npm install reformer
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

```css title="reform-tutorial/src/index.css"
@import 'tailwindcss';
```

Настройте конфигурацию Vite.

```typescript title="reform-tutorial/vite.config.ts"
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

#### Удалите лишний код

Удалите reform-tutorial/src/App.css
Удалите все лишнее из компонента App, оставив там следующий код.

```typescript title="reform-tutorial/src/App.tsx"
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

```typescript title="reform-tutorial/tsconfig.json"
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

```typescript title="reform-tutorial/tsconfig.app.json"
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

```typescript title="reform-tutorial/vite.config.ts"
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

:::tip Решение ошибки при инициализации shadcn
Если вы получите ошибку:
No Tailwind CSS configuration found at D:\Work\ReFormer\projects\reform-tutorial.
It is likely you do not have Tailwind CSS installed or have an invalid configuration.
Install Tailwind CSS then try again.

Перезапустите команду
`npm install tailwindcss @tailwindcss/vite`
:::

```bash
npx shadcn@latest init
```

#### Добавим первый компонент и проверим работу Shadcn

Запустим скрипт

```bash
npx shadcn@latest add button
```

Модифицируем корневой компонент

```typescript title="reform-tutorial/src/App.tsx"
import { Button } from "@/components/ui/button"

function App() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center">
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

После настройки проекта переходите к [Схема формы](./form-schema/1-interface), чтобы определить структуру данных формы.
