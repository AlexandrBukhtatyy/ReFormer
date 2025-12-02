---
sidebar_position: 1
---

# Project Setup

Setting up a project to work with ReFormer.

## Prerequisites

- Node.js 18+

## Project Setup

### Project Initialization

```bash
# Create a new project
npm create vite@latest reformer-tutorial -- --template react-ts

# Install dependencies that don't require configuration
npm install @reformer/core
```

### Installing TailwindCSS

:::info Note
The latest instructions are available on the official website.
https://tailwindcss.com
:::

#### Install Dependencies

```bash
npm install tailwindcss @tailwindcss/vite
```

#### Configure the Project

Remove everything from the styles file and leave only the TailwindCSS import.

```css title="reformer-tutorial/src/index.css"
@import 'tailwindcss';
```

Configure Vite.

```typescript title="reformer-tutorial/vite.config.ts"
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

#### Remove Unnecessary Code

Delete reformer-tutorial/src/App.css
Remove all unnecessary code from the App component, leaving only the following code.

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

#### Verification

Run the project and make sure TailwindCSS styles are active.

```bash
npm run dev # => http://localhost:5173/
```

### Installing shadcn

:::info Note
The latest instructions are available on the official website.
https://ui.shadcn.com/
:::

#### Update Project Configuration

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

#### Install Dependency to Avoid Build Errors

```bash
npm install -D @types/node
```

#### Update Vite Configuration

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

#### Initialize Shadcn

```bash
npx shadcn@latest init
```

<details>
  <summary>Error: No Tailwind CSS configuration found</summary>

If you get the error:

```bash
  No Tailwind CSS configuration found at D:\Work\ReFormer\projects\reformer-tutorial.
  It is likely you do not have Tailwind CSS installed or have an invalid configuration.
  Install Tailwind CSS then try again.
```

Re-run the command: `npm install tailwindcss @tailwindcss/vite`

</details>

#### Add First Component and Verify Shadcn Works

Run the script

```bash
npx shadcn@latest add button
```

Modify the root component

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

#### Verification

If the server is not running yet, run the command and make sure the button component is displayed on the screen.

```bash
npm run dev # => http://localhost:5173/
```

## Next Steps

Once your project is set up, proceed to [Form Schema](./form-schema/interface) to define your form's data structure.
