// Local developer launcher, deliberately outside the production application.
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { parseEnv } from 'node:util';

export const baseURL = 'https://codewizllmproxy.devops.xiaohongshu.com/llmadapterproxy/v3/anthropic';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export function sessionCookie(raw) {
  try {
    const session = JSON.parse(raw);
    const decoded = JSON.parse(Buffer.from(session.accessToken, 'base64').toString('utf8'));
    const name = decoded.ssoAccessTokenKey || 'common-internal-access-token-prod';
    const token = decoded.ssoAccessToken || decoded.accessToken;
    if (!/^[\w-]+$/.test(name) || typeof token !== 'string' || !token || /[\s;,\x00-\x1f\x7f]/.test(token)) {
      throw new Error();
    }
    return `${name}=${token}`;
  } catch {
    throw new Error('CodeWiz session is invalid; sign in again with codewiz-cc.');
  }
}

export async function checkConnection(cookie, fetchImpl = fetch) {
  const response = await fetchImpl(`${baseURL}/v1/messages`, {
    method: 'POST',
    signal: AbortSignal.timeout(45000),
    headers: {
      'content-type': 'application/json',
      'anthropic-version': '2023-06-01',
      'X-Adapter-Source': 'librechat-local-dev',
      'X-Adapter-Source-Version': '0.8.8',
      Cookie: cookie,
    },
    body: JSON.stringify({
      model: 'claude-4.5-haiku-google',
      max_tokens: 32,
      messages: [{ role: 'user', content: 'Reply only CODEWIZ_OK' }],
    }),
  });
  const result = await response.json();
  if (result.error?.error_type === 'source_denied') {
    throw new Error('CodeWiz gateway has not authorized librechat-local-dev. Ask its administrator to enable this source.');
  }
  if (!response.ok || result.type !== 'message' || !Array.isArray(result.content)) {
    // Do not log upstream bodies: they may contain request or authentication data.
    throw new Error(`CodeWiz check failed (HTTP ${response.status}); verify login, source authorization and model access.`);
  }
}

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('This launcher is for local development only.');
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--check')) throw new Error('Usage: node scripts/codewiz-dev/start.mjs [--check]');
  const sessionPath = resolve(homedir(), '.cc-mirror/codewiz-cc/session.json');
  let cookie;
  try {
    cookie = sessionCookie(await readFile(sessionPath, 'utf8'));
  } catch {
    throw new Error('Cannot read a valid CodeWiz session. Run codewiz-cc and sign in first.');
  }
  await checkConnection(cookie);
  console.log('CodeWiz model connection verified.');
  if (args.includes('--check')) return;
  let localEnv = {};
  try { localEnv = parseEnv(await readFile(resolve(root, '.env'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const endpoints = process.env.ENDPOINTS || localEnv.ENDPOINTS || 'openAI,anthropic,google,agents';
  const child = spawn('npm', ['run', 'backend:dev'], {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'development',
      HOST: '127.0.0.1',
      CONFIG_PATH: resolve(root, 'scripts/codewiz-dev/librechat.yaml'),
      ENDPOINTS: [...new Set([...endpoints.split(',').map((s) => s.trim()).filter(Boolean), 'custom'])].join(','),
      CODEWIZ_DEV_COOKIE: cookie,
    },
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
  child.on('error', () => { console.error('Cannot start npm backend:dev.'); process.exitCode = 1; });
  child.on('exit', (code) => { process.exitCode = code ?? 1; });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
