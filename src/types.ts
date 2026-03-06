import type { D1Database } from '@cloudflare/workers-types';

export type Bindings = {
    DB: D1Database;
    INITIAL_ADMIN_GMAIL: string; // 環境変数: 初期管理者のGoogleメールアドレス
    JWT_SECRET: string;          // 環境変数: アプリ内セッション用の秘密鍵
};

export type Variables = {
    // ミドルウェアで取得したユーザー情報をContextに持たせる
    user: {
        id: string;
        email: string;
        role: string;
        isActive: number;
    };
};
