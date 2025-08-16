import 'express';

declare module 'express' {
  interface Request {
    authenticatedUserId?: string;
  }
}