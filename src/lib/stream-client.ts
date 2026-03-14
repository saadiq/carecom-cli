import type { CareComConfig } from '../types.ts';
import { cookiesToHeader } from './curl-parser.ts';
import { refreshCookies } from './care-client.ts';
import { BROWSER_UA } from './constants.ts';

const MESSAGES_URL = 'https://www.care.com/app/messages';
const STREAM_API_BASE = 'https://chat.stream-io-api.com';

export interface StreamCredentials {
  apiKey: string;
  token: string;
  userId: string;
}

export function getOtherMember(channel: any, myUserId: string) {
  const member = channel.members?.find((m: any) => m.user_id !== myUserId);
  return { name: member?.user?.name || 'Unknown', userId: member?.user_id || '' };
}

export async function getStreamCredentials(config: CareComConfig): Promise<StreamCredentials> {
  const response = await fetch(MESSAGES_URL, {
    headers: {
      'Cookie': cookiesToHeader(config.cookies),
      'User-Agent': BROWSER_UA,
      'Accept': 'text/html',
    },
    redirect: 'follow',
  });

  await refreshCookies(config, response.headers);

  if (response.status === 401 || response.status === 403) {
    throw new Error('Session expired. Re-run: carecom auth parse-curl');
  }

  if (!response.ok) {
    throw new Error(`Failed to load messages page: HTTP ${response.status}`);
  }

  const html = await response.text();
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
  if (!match) {
    throw new Error('Could not find __NEXT_DATA__ on messages page');
  }

  let nextData: any;
  try {
    nextData = JSON.parse(match[1]);
  } catch {
    throw new Error('Failed to parse __NEXT_DATA__ from messages page. Page structure may have changed.');
  }

  const props = nextData?.props;
  if (!props?.streamApiKey || !props?.streamToken || !props?.auth?.memberUuid) {
    throw new Error('Stream credentials missing from messages page. Session may be expired.');
  }

  return {
    apiKey: props.streamApiKey,
    token: props.streamToken,
    userId: props.auth.memberUuid,
  };
}

export async function streamApi<T = any>(
  creds: StreamCredentials,
  endpoint: string,
  body: Record<string, any>
): Promise<T> {
  const url = `${STREAM_API_BASE}${endpoint}?api_key=${creds.apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': creds.token,
      'stream-auth-type': 'jwt',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let detail = '';
    try { detail = await response.text(); } catch {}
    throw new Error(`Stream API error ${response.status}: ${detail}`);
  }

  return response.json() as Promise<T>;
}

export async function listConversations(creds: StreamCredentials, limit = 20) {
  const data = await streamApi(creds, '/channels', {
    filter_conditions: { members: { $in: [creds.userId] } },
    sort: [{ field: 'last_message_at', direction: -1 }],
    limit,
    message_limit: 1,
    member_limit: 5,
  });
  return data.channels || [];
}

export async function getChannelMessages(creds: StreamCredentials, channelId: string, limit = 25) {
  const data = await streamApi(creds, `/channels/messaging/${channelId}/query`, {
    messages: { limit },
    state: true,
  });
  return data;
}

export async function sendMessage(creds: StreamCredentials, channelId: string, text: string) {
  const data = await streamApi(creds, `/channels/messaging/${channelId}/message`, {
    message: { text },
  });
  return data;
}
