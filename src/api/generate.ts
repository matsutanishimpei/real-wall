import { Hono } from 'hono';
import { requireAuth } from './middleware';
import { drizzle } from 'drizzle-orm/d1';
import { basePrompts, constraints } from '../db/schema';
import type { Bindings, Variables } from '../types';

export const generateRoute = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ログインユーザーのみAI生成可能（※UIでのマスターデータ取得等）
generateRoute.use('*', requireAuth);

// マスターデータの取得 (UI用)
generateRoute.get('/config', async (c) => {
  const db = drizzle(c.env.DB);
  const prompts = await db.select().from(basePrompts);
  const constraintsList = await db.select().from(constraints);
  return c.json({ prompts, constraints: constraintsList });
});
