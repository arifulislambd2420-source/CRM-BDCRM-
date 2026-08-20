import type { NextFunction, Request, Response } from 'express';
import { HttpError } from './auth.js';

/**
 * Wrap async route handlers so thrown errors flow into the error middleware.
 * Without this, an unhandled rejection in a handler would silently hang.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

/** ID generator matching the shape frontend code already uses. */
export function makeId(prefix: string): string {
  return `${prefix}-` + Math.random().toString(36).slice(2, 10);
}

/**
 * Coerce a route param to string. Express 5's types allow `string | string[]`
 * for repeated params (?a=1&a=2), which never actually happens for path
 * params — this narrows for TS without runtime cost.
 */
export function p(v: unknown): string {
  if (Array.isArray(v)) return String(v[0] ?? '');
  return String(v ?? '');
}

export { HttpError };
