import { handlers as carsHandlers } from './handlers/cars';
import { handlers as citiesHandlers } from './handlers/cities';
import { handlers as creditApplicationHandlers } from './handlers/credit-applications';
import { handlers as dictionariesHandlers } from './handlers/dictionaries';
import { handlers as regionHandlers } from './handlers/regions';

export const handlers = [
  ...carsHandlers,
  ...citiesHandlers,
  ...creditApplicationHandlers,
  ...dictionariesHandlers,
  ...regionHandlers,
];
