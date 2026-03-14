export interface ParsedCookies {
  cookies: Record<string, string>;
}

export function parseCurlCommand(curlInput: string): ParsedCookies {
  // Verify it targets care.com
  const urlMatch = curlInput.match(/curl\s+'?(https?:\/\/[^'"\s]*care\.com[^'"\s]*)/);
  if (!urlMatch) {
    throw new Error('Could not find a care.com URL in the cURL command');
  }

  // Extract Cookie header from -H 'Cookie: ...', -b '...', or --cookie '...'
  const cookieMatch = curlInput.match(
    /-H\s+'[Cc]ookie:\s*([^']+)'|-b\s+'([^']+)'|--cookie\s+'([^']+)'/
  );
  const cookieString = cookieMatch ? (cookieMatch[1] || cookieMatch[2] || cookieMatch[3]) : '';

  if (!cookieString) {
    throw new Error('Could not find Cookie header in cURL command');
  }

  // Parse all key=value pairs from the cookie string
  const cookies: Record<string, string> = {};
  for (const pair of cookieString.split(';')) {
    const trimmed = pair.trim();
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.substring(0, eqIdx).trim();
      const value = trimmed.substring(eqIdx + 1).trim();
      cookies[key] = value;
    }
  }

  // Validate essential cookies
  const required = ['csc', 'care_mid', 'care_did'];
  const missing = required.filter(k => !cookies[k]);
  if (missing.length > 0) {
    throw new Error(`Missing required cookies: ${missing.join(', ')}. Make sure you copy the cURL from a care.com /api/graphql request.`);
  }

  return { cookies };
}

export function cookiesToHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

export function looksLikeCurlCommand(input: string): boolean {
  const trimmed = input.trim();
  return trimmed.startsWith('curl ') || trimmed.startsWith('curl\t');
}
