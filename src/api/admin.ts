import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { users, basePrompts, constraints, outputLogs } from '../db/schema';
import { requireAuth, requireAdmin } from './middleware';
import type { Bindings, Variables } from '../types';

export const adminRoute = new Hono<{ Bindings: Bindings; Variables: Variables }>();

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

// 全てのルートでログイン確認＆管理者権限を要求
adminRoute.use('*', requireAuth, requireAdmin);

// ==========================================
// ハッシュ検証 (Verification)
// ==========================================
adminRoute.post('/verify-hash', async (c) => {
    const { hash } = await c.req.json();
    if (!hash) return c.json({ error: 'Hash is required' }, 400);

    const db = drizzle(c.env.DB);
    const log = await db.select().from(outputLogs).where(eq(outputLogs.pdfHash, hash)).get();

    if (log) {
        return c.json({
            success: true,
            projectId: log.projectId,
            createdAt: log.createdAt
        });
    } else {
        return c.json({ success: false, error: '一致するレコードが見つかりません。改ざんの可能性があります。' }, 404);
    }
});

// ==========================================
// Users 管理
// ==========================================
adminRoute.get('/users', async (c) => {
    const db = drizzle(c.env.DB);
    const allUsers = await db.select().from(users);
    return c.json({ users: allUsers });
});

adminRoute.patch('/users/:id', async (c) => {
    const currentUser = c.get('user');
    const targetUserId = c.req.param('id');
    const body = await c.req.json();

    // 自分自身の権限／有効状態の変更をブロック
    if (currentUser.id === targetUserId && ('role' in body || 'isActive' in body)) {
        return c.json({ error: 'You cannot modify your own role or active status.' }, 403);
    }

    const updateData: Partial<typeof users.$inferInsert> = {};
    if (body.role && ['admin', 'user'].includes(body.role)) updateData.role = body.role as 'admin' | 'user';
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    if (Object.keys(updateData).length === 0) {
        return c.json({ error: 'No valid fields provided for update.' }, 400);
    }

    const db = drizzle(c.env.DB);
    const [updatedUser] = await db.update(users)
        .set(updateData)
        .where(eq(users.id, targetUserId))
        .returning();

    if (!updatedUser) {
        return c.json({ error: 'Target user not found' }, 404);
    }

    return c.json({ user: updatedUser });
});

// ==========================================
// Prompts 管理 (basePrompts)
// ==========================================
adminRoute.get('/prompts', async (c) => {
    const db = drizzle(c.env.DB);
    const prompts = await db.select().from(basePrompts);
    return c.json({ prompts });
});

adminRoute.post('/prompts', async (c) => {
    const { title, content } = await c.req.json();
    const db = drizzle(c.env.DB);
    const [newPrompt] = await db.insert(basePrompts).values({ title, content }).returning();
    return c.json({ prompt: newPrompt });
});

adminRoute.put('/prompts/:id', async (c) => {
    const id = c.req.param('id');
    const { title, content } = await c.req.json();
    const db = drizzle(c.env.DB);
    const [updatedPrompt] = await db.update(basePrompts)
        .set({ title, content })
        .where(eq(basePrompts.id, id))
        .returning();
    return c.json({ prompt: updatedPrompt });
});

adminRoute.delete('/prompts/:id', async (c) => {
    const id = c.req.param('id');
    const db = drizzle(c.env.DB);
    await db.delete(basePrompts).where(eq(basePrompts.id, id));
    return c.json({ success: true });
});

// ==========================================
// Constraints 管理 (constraints)
// ==========================================
adminRoute.get('/constraints', async (c) => {
    const db = drizzle(c.env.DB);
    const constraintsList = await db.select().from(constraints);
    return c.json({ constraints: constraintsList.map(normalizeConstraintRow) });
});

adminRoute.post('/constraints', async (c) => {
    const body = await c.req.json<any>();
    const mainCategory = body.mainCategory ?? body.main_category ?? body.category;
    const subCategory = body.subCategory ?? body.sub_category;
    const detailCategory = body.detailCategory ?? body.detail_category;
    const description = body.description;
    if (!mainCategory || !subCategory || !detailCategory || !description) {
        return c.json({ error: 'mainCategory/subCategory/detailCategory/description are required' }, 400);
    }
    const db = drizzle(c.env.DB);
    const [newConstraint] = await db.insert(constraints).values({ mainCategory, subCategory, detailCategory, description }).returning();
    return c.json({ constraint: normalizeConstraintRow(newConstraint) });
});

adminRoute.put('/constraints/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json<any>();
    const mainCategory = body.mainCategory ?? body.main_category ?? body.category;
    const subCategory = body.subCategory ?? body.sub_category;
    const detailCategory = body.detailCategory ?? body.detail_category;
    const description = body.description;
    if (!mainCategory || !subCategory || !detailCategory || !description) {
        return c.json({ error: 'mainCategory/subCategory/detailCategory/description are required' }, 400);
    }
    const db = drizzle(c.env.DB);
    const [updatedConstraint] = await db.update(constraints)
        .set({ mainCategory, subCategory, detailCategory, description })
        .where(eq(constraints.id, id))
        .returning();
    return c.json({ constraint: normalizeConstraintRow(updatedConstraint) });
});

adminRoute.delete('/constraints/:id', async (c) => {
    const id = c.req.param('id');
    const db = drizzle(c.env.DB);
    await db.delete(constraints).where(eq(constraints.id, id));
    return c.json({ success: true });
});
