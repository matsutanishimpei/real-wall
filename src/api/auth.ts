import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import { setCookie, deleteCookie } from 'hono/cookie';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { users } from '../db/schema';
import { requireAuth } from './middleware';
import type { Bindings, Variables } from '../types';

export const authRoute = new Hono<{ Bindings: Bindings; Variables: Variables }>();

authRoute.post('/google', async (c) => {
    const { idToken } = await c.req.json();

    // 1. GoogleのIDトークンを検証してユーザー情報を取得
    const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
    if (!verifyRes.ok) {
        return c.json({ error: 'Invalid Google token' }, 401);
    }
    const payload = (await verifyRes.json()) as { email: string; email_verified: string; name: string };

    if (payload.email_verified !== 'true') return c.json({ error: 'Email not verified' }, 401);

    const db = drizzle(c.env.DB);
    const email = payload.email;

    // 2. DBからユーザーを検索
    let user = await db.select().from(users).where(eq(users.email, email)).get();

    // 3. ユーザーがいなければ「サインアップ（新規登録）」
    if (!user) {
        // 【要件】 INITIAL_ADMIN_GMAIL に一致すれば admin、それ以外は user
        const isInitialAdmin = email === c.env.INITIAL_ADMIN_GMAIL;
        const initialRole = isInitialAdmin ? 'admin' : 'user';

        const [newUser] = await db.insert(users).values({
            name: payload.name,
            email: email,
            role: initialRole,
            isActive: 1, // 初期状態は有効に設定
        }).returning();

        user = newUser;
    }

    // もし新規登録直後ではなく、既存のアカウントが無効化されていた場合はログインさせない
    if (user.isActive === 0) {
        return c.json({ error: 'Your account has been deactivated.' }, 403);
    }

    // 4. アプリ内システム用のJWTを発行（7日間有効とする）
    const sessionToken = await sign({
        id: user.id,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
    }, c.env.JWT_SECRET);

    // 古い検証用cookie(path=/api/auth)が残っている場合は削除する
    deleteCookie(c, 'session_token', { path: '/api/auth' });
    deleteCookie(c, 'session_token', { path: '/api/auth/dev-login' });

    // Cookieにセット
    setCookie(c, 'session_token', sessionToken, {
        httpOnly: true,
        secure: true,   // 本番時は https: 必須
        sameSite: 'Lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
    });

    return c.json({ message: 'Login successful', user });
});

// GET /me - 現在のログインユーザー情報を返す
authRoute.get('/me', requireAuth, (c) => {
    return c.json({ user: c.get('user') });
});

// [開発・テスト用] 任意のメールアドレスで強制ログインするエンドポイント (本番では必ず削除してください)
authRoute.post('/dev-login', async (c) => {
    const { email, name } = await c.req.json();
    const db = drizzle(c.env.DB);

    let user = await db.select().from(users).where(eq(users.email, email)).get();

    if (!user) {
        const isInitialAdmin = email === c.env.INITIAL_ADMIN_GMAIL;
        const initialRole = isInitialAdmin ? 'admin' : 'user';

        const [newUser] = await db.insert(users).values({
            name: name || 'Dev User',
            email: email,
            role: initialRole,
            isActive: 1,
        }).returning();
        user = newUser;
    }

    if (user.isActive === 0) {
        return c.json({ error: 'Your account has been deactivated.' }, 403);
    }

    const sessionToken = await sign({
        id: user.id,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
    }, c.env.JWT_SECRET);

    deleteCookie(c, 'session_token', { path: '/api/auth' });
    deleteCookie(c, 'session_token', { path: '/api/auth/dev-login' });

    setCookie(c, 'session_token', sessionToken, {
        httpOnly: true,
        secure: true, // Cloudflare Pages is https
        sameSite: 'Lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
    });

    return c.json({ message: 'Dev Login successful', user, debug_secret_exists: !!c.env.JWT_SECRET });
});
