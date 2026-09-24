/**
 * test/helper.js — Shared test setup and utilities for Banco Fictício E2E tests
 */

const assert = require('node:assert');
const { Pool } = require('pg');
require('dotenv').config();

let testServer = null;
let activeBaseUrl = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';

const pool = new Pool({
  host: process.env.PGHOST || '127.0.0.1',
  port: parseInt(process.env.PGPORT || '5432', 10),
  database: process.env.PGDATABASE || 'banco_ficticio',
  user: process.env.PGUSER || process.env.USER || 'henriquemonteiro',
  password: process.env.PGPASSWORD || undefined,
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 3000,
});

/**
 * Returns the base URL of the running API.
 * Automatically checks if a server is already running on port 3000;
 * if not, boots an ephemeral instance of the Express app.
 */
async function getBaseUrl() {
  try {
    const res = await fetch(`${activeBaseUrl}/api/health`, {
      signal: AbortSignal.timeout(1200),
    });
    if (res.ok) {
      return activeBaseUrl;
    }
  } catch (err) {
    // Port not active, start ephemeral server
  }

  if (!testServer) {
    const { app } = require('../server');
    await new Promise((resolve, reject) => {
      testServer = app.listen(0, '127.0.0.1', () => {
        const port = testServer.address().port;
        activeBaseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
      testServer.on('error', reject);
    });
  }

  return activeBaseUrl;
}

/**
 * Helper to close ephemeral test server when tests finish.
 */
async function closeTestServer() {
  if (testServer) {
    await new Promise((resolve) => testServer.close(resolve));
    testServer = null;
  }
}

/**
 * Executes a POST request to /api/assistente/consulta and measures duration.
 * @param {object} payload
 * @param {object} [customHeaders]
 * @returns {Promise<{ status: number, body: object, durationMs: number }>}
 */
async function postConsulta(payload, customHeaders = {}) {
  const baseUrl = await getBaseUrl();
  const start = performance.now();
  const res = await fetch(`${baseUrl}/api/assistente/consulta`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...customHeaders,
    },
    body: JSON.stringify(payload),
  });
  const durationMs = performance.now() - start;
  let body;
  try {
    body = await res.json();
  } catch (e) {
    body = null;
  }
  return { status: res.status, body, durationMs };
}

module.exports = {
  pool,
  getBaseUrl,
  closeTestServer,
  postConsulta,
};
