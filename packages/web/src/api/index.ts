import { Hono } from 'hono';
import { cors } from "hono/cors"
import { analyzeWebsite } from './analyzer';

const app = new Hono()
  .basePath('api')
  .use(cors({ origin: (origin) => origin ?? "*", credentials: true }))
  .get('/ping', (c) => c.json({ message: `Pong! ${Date.now()}` }))
  .get('/health', (c) => c.json({ status: 'ok' }))
  .get('/analyze', async (c) => {
    const url = c.req.query('url');
    if (!url) return c.json({ error: 'url query param is required' }, 400);
    try {
      const result = await analyzeWebsite(url);
      return c.json(result);
    } catch (err) {
      console.error('[analyze]', err);
      return c.json({ error: String(err) }, 500);
    }
  });

export type AppType = typeof app;
export default app;
