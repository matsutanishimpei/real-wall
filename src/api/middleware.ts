import { getCookie } from 'hono/cookie';
import { verify } from 'hono/jwt';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { users } from '../db/schema';
import type { MiddlewareHandler } from 'hono';
import type { Bindings, Variables } from '../types';

// ① 全API共通: 認証 & アクティブチェックのミドルウェア
export const requireAuth: MiddlewareHandler<{ Bindings: Bindings; Variables: Variables }> = async (c, next) => {
    // Cookieからアプリ内セッショントークンを取得
    const token = getCookie(c, 'session_token');
    if (!token) return c.json({ error: 'Unauthorized' }, 401);

    try {
        const payload = await verify(token, c.env.JWT_SECRET);
        const db = drizzle(c.env.DB);

        // 毎回DBから最新のユーザー状態を取得（権限剥奪や無効化を即座に反映させるため）
        const user = await db.select().from(users).where(eq(users.id, payload.id as string)).get();

        if (!user) return c.json({ error: 'User not found' }, 404);

        // 【要件】 全てのAPIリクエストで isActive === 1 をチェック
        if (user.isActive !== 1) {
            return c.json({ error: 'Your account has been deactivated.' }, 403);
        }

        // 後続の処理のためにContextにセット
        c.set('user', user);
        await next();
    } catch (err) {
        return c.json({ error: 'Invalid or expired token' }, 401);
    }
};

// ② 管理者専用ガード (requireAuth の後に挟む)
export const requireAdmin: MiddlewareHandler<{ Bindings: Bindings; Variables: Variables }> = async (c, next) => {
    const user = c.get('user');
    if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    // 【要件】 role === 'admin' であることを必須とするガード
    if (user.role !== 'admin') {
        return c.json({ error: 'Forbidden: Admin access required.' }, 403);
    }

    await next();
};
