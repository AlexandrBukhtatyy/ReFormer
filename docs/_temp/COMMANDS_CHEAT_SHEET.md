# Root

npm run build -w reformer
npm run dev -w react-playground
npm run lint
npm run lint:fix
npm run format
npm run format:check

# packages/\*

npm run test

# projects/\*-e2e

npm run test:e2e
npm run test:e2e:ui
npm run test:e2e:chromium
npm run test:e2e:report

# projects/react-playground

npm run dev # Стандартный режим (MSW Service Worker)
npm run dev:stackblitz # Режим StackBlitz (Vite middleware)
npm run generate:mocks # Генерация handlers из OpenAPI spec
npm run build # Сборка (включает generate:mocks)

# projects/reform-doc

npm run build
npm start
