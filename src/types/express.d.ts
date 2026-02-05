import { Provider } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      provider?: Omit<Provider, 'passwordHash'>;
    }
  }
}

export {};
