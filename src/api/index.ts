import { Hono } from 'hono';
import { authRoute } from './auth';
import { adminRoute } from './admin';
import { generateRoute } from './generate';
import { logsRoute } from './logs';
import type { Bindings, Variables } from '../types';

const api = new Hono<{ Bindings: Bindings; Variables: Variables }>();

api.route('/auth', authRoute);
api.route('/admin', adminRoute);
api.route('/generate', generateRoute); // AI生成APIを追加
api.route('/logs', logsRoute); // ログ保存API

export default api;
