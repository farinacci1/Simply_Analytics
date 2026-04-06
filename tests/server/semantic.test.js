import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { semanticRoutes } from '../../server/src/routes/semantic.js';

/**
 * Integration-style tests for the /api/semantic routes.
 * We create a minimal Express app that injects a mock snowflakeConnection
 * so we never touch a real Snowflake instance.
 */

vi.mock('../../server/src/services/connectionService.js', () => ({
  getCachedDashboardConnection: vi.fn(() => Promise.resolve(mockConnection)),
}));

vi.mock('../../server/src/db/dashboardSessionManager.js', () => ({
  executeQuery: vi.fn(() => Promise.resolve([])),
}));

const mockConnection = {
  execute: vi.fn((opts) => {
    if (opts.complete) opts.complete(undefined, undefined, []);
    return {};
  }),
};

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.snowflakeConnection = mockConnection;
    req.user = { id: 'test-user', sessionId: 'test-session' };
    next();
  });
  app.use('/api/v1/semantic', semanticRoutes);
  return app;
}

describe('GET /api/v1/semantic/views', () => {
  let app;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
  });

  it('returns 200 with an array of views', async () => {
    const { executeQuery } = await import('../../server/src/db/dashboardSessionManager.js');
    executeQuery.mockResolvedValueOnce([
      { NAME: 'MyView', DATABASE_NAME: 'DB', SCHEMA_NAME: 'PUBLIC', OWNER: 'ADMIN', COMMENT: '', CREATED_ON: '2025-01-01' },
    ]);

    const res = await request(app).get('/api/v1/semantic/views');
    expect(res.status).toBe(200);
    expect(res.body.views).toBeDefined();
  });

  it('returns 401 when snowflakeConnection is missing', async () => {
    const noAuthApp = express();
    noAuthApp.use(express.json());
    noAuthApp.use((req, _res, next) => {
      req.user = { id: 'test-user' };
      next();
    });
    noAuthApp.use('/api/v1/semantic', semanticRoutes);

    const res = await request(noAuthApp).get('/api/v1/semantic/views');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('NO_CONNECTION');
  });
});
