import type { CareComConfig, GraphQLResponse } from '../types.ts';
import { cookiesToHeader } from './curl-parser.ts';
import { saveConfig } from './config.ts';
import { BROWSER_UA } from './constants.ts';

const GRAPHQL_URL = 'https://www.care.com/api/graphql';
const MFE_CLIENT_NAME = 'job-mfe';
const MFE_CLIENT_VERSION = '0.525.0';

// Parse Set-Cookie headers and merge updated cookies into config
function parseSetCookies(headers: Headers): Record<string, string> {
  const updates: Record<string, string> = {};
  const setCookies = headers.getSetCookie?.() || [];
  for (const sc of setCookies) {
    const eqIdx = sc.indexOf('=');
    if (eqIdx <= 0) continue;
    const name = sc.substring(0, eqIdx).trim();
    // Value ends at first ; (rest is attributes like Path, Expires, etc.)
    const rest = sc.substring(eqIdx + 1);
    const semiIdx = rest.indexOf(';');
    const value = semiIdx >= 0 ? rest.substring(0, semiIdx).trim() : rest.trim();
    if (value && value !== '""' && value !== "''") {
      updates[name] = value;
    }
  }
  return updates;
}

// Refresh stored cookies with any Set-Cookie headers from the response
export async function refreshCookies(config: CareComConfig, headers: Headers): Promise<void> {
  const updates = parseSetCookies(headers);
  if (Object.keys(updates).length === 0) return;

  // Merge updates into config
  let changed = false;
  for (const [name, value] of Object.entries(updates)) {
    if (config.cookies[name] !== value) {
      config.cookies[name] = value;
      changed = true;
    }
  }

  if (changed) {
    config.lastRefreshedAt = new Date().toISOString();
    await saveConfig(config);
  }
}

export async function graphql<T = any>(
  config: CareComConfig,
  operationName: string,
  query: string,
  variables: Record<string, any> = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Cookie': cookiesToHeader(config.cookies),
    'Content-Type': 'application/json',
    'Origin': 'https://www.care.com',
    'Referer': 'https://www.care.com/',
    'User-Agent': BROWSER_UA,
    'apollographql-client-name': MFE_CLIENT_NAME,
    'apollographql-client-version': MFE_CLIENT_VERSION,
  };

  // Browser sends the vc cookie as the x-care.com-visitid header
  if (config.cookies['vc']) {
    headers['x-care.com-visitid'] = config.cookies['vc'];
  }

  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ operationName, query, variables }),
  });

  // Refresh cookies from response before checking status
  await refreshCookies(config, response.headers);

  if (response.status === 401 || response.status === 403) {
    throw new Error('Session expired. Re-run: carecom auth parse-curl');
  }

  if (!response.ok) {
    let body = '';
    try { body = await response.text(); } catch {}
    throw new Error(`HTTP ${response.status}: ${response.statusText}\n${body}`);
  }

  const json = await response.json() as GraphQLResponse<T>;

  if (json.errors && json.errors.length > 0) {
    const msgs = json.errors.map(e => e.message).join('; ');
    throw new Error(`GraphQL error: ${msgs}`);
  }

  if (!json.data) {
    throw new Error('No data in GraphQL response');
  }

  return json.data;
}

// Hit a real page URL to refresh Akamai bot management cookies (bm_sv, ak_bmsc).
// The browser does this naturally via page navigation; API-only requests don't renew them.
export async function refreshSession(config: CareComConfig): Promise<void> {
  const jobId = config.defaultJobId || '35088345';
  const pageUrl = `https://www.care.com/app/job/cc/view/${jobId}`;

  const response = await fetch(pageUrl, {
    headers: {
      'Cookie': cookiesToHeader(config.cookies),
      'User-Agent': BROWSER_UA,
      'Accept': 'text/html',
    },
  });

  await refreshCookies(config, response.headers);

  if (response.status === 401 || response.status === 403) {
    throw new Error('Session expired. Re-run: carecom auth parse-curl');
  }
}
