import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';

// 1. プロジェクトのユーザー管理
export const users = sqliteTable('users', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    // role: admin または user
    role: text('role', { enum: ['admin', 'user'] }).default('user').notNull(),
    // is_active: 0 (無効) または 1 (有効)
    isActive: integer('is_active').default(1).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// 2. プロンプトのマスター
export const basePrompts = sqliteTable('base_prompts', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    title: text('title').notNull(),
    content: text('content').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// 3. カテゴリを持つ制約マスター
export const slotConstraints = sqliteTable('slot_constraints', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    category: text('category').notNull(),
    description: text('description').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// 4. PDFのハッシュ値を保持する親テーブル
export const outputLogs = sqliteTable('output_logs', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    projectId: text('project_id').notNull(), // アプリケーション側で管理するプロジェクトID
    pdfHash: text('pdf_hash').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// 5. プロジェクトに紐づく検討内容（1:N）の子テーブル
export const considerations = sqliteTable('considerations', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    outputLogId: text('output_log_id')
        .notNull()
        .references(() => outputLogs.id, { onDelete: 'cascade' }), // 親ログが消えたら検討内容も消す
    projectId: text('project_id').notNull(),
    content: text('content').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// === リレーション定義 (Drizzle Queries用) ===
export const outputLogsRelations = relations(outputLogs, ({ many }) => ({
    considerations: many(considerations),
}));

export const considerationsRelations = relations(considerations, ({ one }) => ({
    outputLog: one(outputLogs, {
        fields: [considerations.outputLogId],
        references: [outputLogs.id],
    }),
}));
