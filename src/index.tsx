import { Hono } from 'hono'
import api from './api/index'

const app = new Hono()

app.route('/api', api)

export default app
