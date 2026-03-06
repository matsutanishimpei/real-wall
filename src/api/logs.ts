import { Hono } from 'hono';
import { requireAuth } from './middleware';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { outputLogs, considerations } from '../db/schema';
import type { Bindings, Variables } from '../types';

export const logsRoute = new Hono<{ Bindings: Bindings; Variables: Variables }>();

logsRoute.use('*', requireAuth);

logsRoute.post('/', async (c) => {
    try {
        const { pdfHash, considerations: aiConsiderations } = await c.req.json();
        const user = c.get('user');
        const db = drizzle(c.env.DB);

        // トランザクション感覚で挿入（D1はローカルではDrizzleのtransactionを一部制限することがあるためバッチ実行などを検討しますが、今回はシンプルにします）
        const projectId = `PROJ-${Date.now()}`;

        // 親テーブル (outputLogs) に保存
        const [newLog] = await db.insert(outputLogs).values({
            projectId: projectId,
            pdfHash: pdfHash,
        }).returning();

        // 子テーブル (considerations) に配列を保存
        if (aiConsiderations && aiConsiderations.length > 0) {
            const considerationsToInsert = aiConsiderations.map((item: any) => ({
                outputLogId: newLog.id,
                projectId: projectId,
                content: `[${item.type}] ${item.title}: ${item.content}`
            }));
            await db.insert(considerations).values(considerationsToInsert);
        }

        return c.json({ success: true, log: newLog, projectId });
    } catch (error: any) {
        console.error('Log save error:', error);
        return c.json({ error: 'Failed to save logs' }, 500);
    }
});
