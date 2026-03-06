import { Hono } from 'hono';
import { requireAuth } from './middleware';
import { drizzle } from 'drizzle-orm/d1';
import { basePrompts, constraints } from '../db/schema';
import type { Bindings, Variables } from '../types';

export const generateRoute = new Hono<{ Bindings: Bindings; Variables: Variables }>();

function normalizeConstraintRow(row: any) {
  return {
    id: row.id,
    mainCategory: row.mainCategory ?? row.main_category ?? row.category ?? '',
    subCategory: row.subCategory ?? row.sub_category ?? '',
    detailCategory: row.detailCategory ?? row.detail_category ?? '',
    description: row.description ?? '',
    createdAt: row.createdAt ?? row.created_at,
    updatedAt: row.updatedAt ?? row.updated_at,
  };
}

// ログインユーザーのみAI生成可能（※UIでのマスターデータ取得等）
generateRoute.use('*', requireAuth);

// マスターデータの取得 (UI用)
generateRoute.get('/config', async (c) => {
  const db = drizzle(c.env.DB);
  const prompts = await db.select().from(basePrompts);
  const constraintsList = await db.select().from(constraints);
  return c.json({ prompts, constraints: constraintsList.map(normalizeConstraintRow) });
});
