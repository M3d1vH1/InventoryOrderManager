// Declaration file for external modules that don't have TypeScript typings
declare module 'cors';

import { User as DatabaseUser } from '../shared/schema';

declare global {
  namespace Express {
    interface User extends DatabaseUser {}
  }
}