import express from 'express';
import cors from 'cors';
import { createMiddleware } from '@mswjs/http-middleware';
import { handlers } from './handlers';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// MSW handlers as Express middleware
app.use(createMiddleware(...handlers));

app.listen(PORT, () => {
  console.log(`Mock server running at http://localhost:${PORT}`);
});