# CLAUDE.md - carecom-cli

CLI tool for interacting with Care.com's GraphQL API. Used for monitoring a nanny job listing, evaluating applicants, and searching for caregivers.

## How the CLI Works

TypeScript project running on Bun. Uses `commander` for CLI structure, `chalk` for colored output, and `ora` for spinners.

### Running

```bash
# Dev mode
bun run dev -- <command>

# Or directly
bun run src/index.ts <command>

# Build standalone binary
bun run build
# Output: dist/carecom

# Type check
bunx tsc --noEmit
```

### Commands

| Command | What it does |
|---------|-------------|
| `auth parse-curl` | Extract cookies from a cURL command. Accepts piped input or interactive paste. Tests auth with a NotificationCounts query. |
| `auth status` | Show session age, cookie count, defaults |
| `auth set-defaults` | Update `--job-id` or `--zip` defaults |
| `auth ping` | Lightweight session check. Refreshes cookies. Use `--quiet` for scripting. Pair with `/loop 10m` to keep sessions alive. |
| `job` | Job summary: title, status, location, rate, applicant count |
| `job applicants` | Table of all applicants. Supports `--filter interested\|not-interested\|unspecified` |
| `job applicant <id>` | Full profile + application context. Matches on UUID prefix, legacyId, or display name substring. Fetches both application data and GetCaregiver profile. |
| `job interest <id> <status>` | Set interest on an applicant: `interested`, `not-interested`, or `unspecified` |
| `job note <id> <text>` | Set private note on an applicant (250 char max). Only visible to seeker. |
| `search "<query>"` | Semantic caregiver search. Options: `--zip`, `--limit`. Uses Care.com's AI-powered text search. |
| `profile <uuid>` | Full multi-vertical caregiver profile. Requires UUID (not legacy ID). |
| `messages` | List all conversations with caregivers. Shows name, preview, timestamp. |
| `messages read <name>` | Read full message thread. Matches on caregiver name substring, UUID, or channel ID. |
| `messages send <name> <text>` | Send a message to a caregiver. Same matching as read. |
| `notifications` | Unread counts for messages, applications, bookings |

All data commands support `--json` for raw API output. This is the primary debugging tool.

### Project Structure

```
src/
  index.ts              # CLI entry point, registers all commands
  types.ts              # TypeScript interfaces (config, GraphQL response, domain types)
  commands/
    auth.ts             # Auth: parse-curl, status, set-defaults, ping
    job.ts              # Job summary, applicants, applicant detail, interest, note
    search.ts           # Caregiver search
    profile.ts          # Full profile view, exports fetchFullProfile()
    notifications.ts    # Notification counts
    messages.ts         # List conversations, read message threads (uses Stream Chat API)
  queries/
    job.ts              # JobApplications, InterestCounts, JobSetupCC queries + Interest/Note mutations
    search.ts           # SearchProvidersChildCare query
    profile.ts          # GetCaregiver query
    notifications.ts    # NotificationCounts query
  lib/
    care-client.ts      # graphql() + exported refreshCookies(). POST to /api/graphql with cookies. Auto-refreshes cookies from Set-Cookie headers.
    stream-client.ts    # Stream Chat REST API client. Fetches credentials from messages page HTML. Also refreshes cookies.
    constants.ts        # Shared constants (BROWSER_UA)
    config.ts           # Load/save config, requireConfig guard, getJobId/getZip helpers
    curl-parser.ts      # Parse cURL commands to extract cookies
    formatter.ts        # Table formatting, applicant/profile/search result/message display
```

## Care.com System Architecture

Care.com uses a micro-frontend architecture. Multiple Next.js apps share a single GraphQL endpoint.

| MFE | URL Pattern | Purpose |
|-----|-------------|---------|
| `job-mfe` | `/app/job/cc/view/{jobId}` | Job listing, applicant management |
| `messages-mfe` | `/app/messages` | Conversations with caregivers |
| `search-mfe` | `/app/search` | Caregiver search/browse |
| `caregiver-profile-mfe` | `/app/caregiver-profile/{vertical}/{uuid}` | Full caregiver profiles |

All MFEs use Apollo Client with the same GraphQL endpoint: `https://www.care.com/api/graphql`

Each MFE has its own Apollo Client instance. The search MFE does NOT expose `window.__APOLLO_CLIENT__` globally, so you need fetch interception to capture its queries.

## Stream Chat (Messaging)

Care.com uses **GetStream.io** (Stream Chat) for messaging, not their GraphQL API. The messages MFE loads Stream credentials via `__NEXT_DATA__` page props.

### How message fetching works

1. Fetch `https://www.care.com/app/messages` HTML with session cookies.
2. Parse `<script id="__NEXT_DATA__">` JSON for `streamApiKey`, `streamToken`, and `auth.memberUuid`.
3. Call Stream Chat REST API at `https://chat.stream-io-api.com` with:
   - Query param: `?api_key={streamApiKey}`
   - Headers: `Authorization: {streamToken}`, `stream-auth-type: jwt`

### Key endpoints

- `POST /channels` — list/query channels. Body includes `filter_conditions`, `sort`, `limit`, `message_limit`.
- `POST /channels/messaging/{channelId}/query` — fetch messages in a channel. Body: `{ messages: { limit: 25 } }`.
- `POST /channels/messaging/{channelId}/message` — send a message. Body: `{ message: { text: "..." } }`.

### Channel ID format

Channel IDs look like `!members-XeGLGvol17U8dXH0yvizF29CEkzJgnsacBdKx5Fr2VU`. The full CID is `messaging:{channelId}`. Conversation IDs from the `JobApplications` query match the full CID format (`messaging:!members-...`).

### Stream token

The `streamToken` is a JWT with `user_id` and `exp` claims. It expires (TTL unknown but likely hours). If the token expires, re-fetch the messages page HTML to get a fresh one. The token is tied to the Care.com session — if the session expires, the messages page returns a redirect.

## GraphQL API Details

All queries were captured from live browser sessions via Apollo Client cache introspection or fetch interception. The CLI sends POST requests to `https://www.care.com/api/graphql` with `operationName`, `query`, and `variables` in the body.

### Query Reference

**`NotificationCounts`** (`queries/notifications.ts`)
- No variables needed.
- Uses `... on NotificationCounts` union type.
- Returns `{ conversations { unread }, jobApplications { unread }, bookings { unread } }`.
- Good lightweight query for testing auth.

**`JobSetupCC`** (`queries/job.ts`)
- Variables: `$jobId: ID!`
- Field: `jobSetup(id: $jobId)`
- Returns job title, status, applicant count, location, rate range.
- Uses `... on ChildCareJobInputType` for the `jobInput` union.

**`JobApplicationSeekerInterestCounts`** (`queries/job.ts`)
- Variables: `$jobId: ID!`
- Field: `jobApplicationSeekerInterestCounts(jobId: $jobId)`
- Uses `... on JobApplicationSeekerInterestCountsSuccess`.
- Returns `unread { interested, notInterested, unspecified }`.
- Important: these are UNREAD counts, not totals.

**`JobApplications`** (`queries/job.ts`)
- Variables: `$jobId: ID!`, `$sortBy`, `$max`, `$jobApplicationFilter`, `$start`
- Field: `jobProfile(jobId: $jobId)` aliased as `jobApplications`.
- Uses `ApplicantFragment on JobApplicationLinkage` with nested `applicant { ... on Caregiver }`.
- Applicant data lives under `node.applicant` (not `node` directly).
- Rates use `PayRangeFragment` with `hourlyRateFrom { amount }`.
- Filter values: `jobApplicationInterest` accepts `INTERESTED`, `NOT_INTERESTED`, `UNSPECIFIED`.
- Pagination: `start: "-1"` for first page, then use cursor values.

**`SearchProvidersChildCare`** (`queries/search.ts`)
- Variables: `$input: SearchProvidersChildCareInput!`
- Field name is `searchProvidersChildCare` (NOT `searchProviders`).
- Input type is `SearchProvidersChildCareInput!` (NOT `SearchProvidersInput`).
- Response uses `searchProvidersConnection` (NOT `providers`).
- Bio is at `profiles.commonCaregiverProfile.bio.experienceSummary`.
- Supports semantic/AI search via `searchTextCriteria.useSemanticSearch: true`.
- Pagination is cursor-based: `searchAfter` takes the `endCursor` value.
- Sort: `SORT_ORDER_RECOMMENDED_DESCENDING`.

**`GetCaregiver`** (`queries/profile.ts`)
- Variables: `$id: ID!`, `$serviceId: ServiceType!`, `$shouldIncludeAllProfiles: Boolean!`
- Returns the full multi-vertical profile.
- `profiles.serviceIds` lists active verticals.
- Each vertical profile (childCare, tutoring, housekeeping, petCare, seniorCare) has its own bio, rates, and experience fields.
- We pass `serviceId: "CHILD_CARE"` and `shouldIncludeAllProfiles: true`.

**`JobApplicationInterest`** (mutation, `queries/job.ts`)
- Variables: `$jobApplicationId: String!`, `$seekerInterest: JobApplicationSeekerInterest!`
- Values for `seekerInterest`: `INTERESTED`, `NOT_INTERESTED`, `UNSPECIFIED`.
- Returns `... on JobApplicationInterestSuccess { dummy }` or `... on JobApplicationInterestError { error }`.
- Note: `jobApplicationId` is typed as `String!` here (not `ID!`).

**`JobApplicationPrivateNote`** (mutation, `queries/job.ts`)
- Variables: `$jobApplicationId: ID!`, `$privateNote: String`
- 250 character max on `privateNote`. Pass empty string to clear.
- Returns `... on JobApplicationPrivateNoteSuccess { dummy }` or `... on JobApplicationPrivateNoteError { error }`.

**`GetCalendar`** (availability, not yet in CLI queries)
- Variables: `$providerId: String!`
- Field: `AvailabilityCalendar(providerId: $providerId)`
- Returns `availability[]` with `startTime`, `endTime`, `freeBusyType` (recurring weekly slots).
- Times are in UTC. Convert to `America/New_York` for display.

### Schema Gotchas

- `qualities`, `supportedServices`, `educationDegrees` are object types requiring sub-selections, NOT scalars. The query will 400 if you treat them as scalars.
- All queries use inline fragments (`... on TypeName`) because the API returns union types.
- The `jobApplications` field is actually an alias for `jobProfile`. The real field name is `jobProfile(jobId:)`.
- `PayRange` contains `hourlyRateFrom { amount }` and optionally `hourlyRateTo { amount }`. The `amount` field is the nested value.

## Authentication

Care.com uses cookie-based auth from browser sessions. There are no API tokens.

### How auth works

1. User copies a cURL command from Chrome DevTools (Network tab, right-click any `/api/graphql` request, Copy as cURL).
2. The CLI parses the `Cookie` header from the cURL command.
3. ALL cookies are stored (Care.com may validate analytics cookies beyond the session ones).
4. Essential cookies: `csc`, `care_mid`, `care_did`.
5. Config is saved to `~/.config/carecom/config.json` with `0o600` permissions.
6. The `graphql()` function in `care-client.ts` sends cookies as a `Cookie` header along with `Origin`, `Referer`, and a Chrome `User-Agent`.

### Cookie refresh

Both `graphql()` in `care-client.ts` and `getStreamCredentials()` in `stream-client.ts` read `Set-Cookie` headers from responses and merge updated cookies back into the config file. This mirrors how browsers keep sessions alive. Each CLI call (including message commands) extends the session, just like each page load does in Chrome.

### Session keep-alive

Session timeout duration is unknown but likely 30 min to 2 hours (sliding window). To keep a session alive during a work session:

```bash
# Manual check
carecom auth ping

# Automated keep-alive (using /loop skill in Claude Code)
/loop 10m carecom auth ping --quiet
```

The `ping` command runs the lightweight `NotificationCounts` query. With cookie refresh, this resets the server-side session timer.

### Session expiry

If a session does expire, the CLI detects 401/403 and tells you to re-auth. Copy a fresh cURL from Chrome DevTools and run `carecom auth parse-curl`.

## Debugging

- Use `--json` on any data command to see the raw API response. This is the first thing to check when output looks wrong.
- 400 errors usually mean query schema mismatch. Check field names and types against the queries in `src/queries/`.
- To capture new queries from the browser:
  - For most MFEs: open Chrome DevTools console and inspect `window.__APOLLO_CLIENT__.cache.extract()`.
  - For search MFE: intercept fetch calls instead, since it does not expose `__APOLLO_CLIENT__` globally.
  - Network tab filtering on `/api/graphql` shows all GraphQL requests with operation names.

## Key IDs

| What | Value |
|------|-------|
| Job ID | `35088345` |
| Seeker UUID | `ddcf2057-a531-45fe-944e-33e1603572f0` |
| Default zip | `11238` |

These are set as defaults during `auth parse-curl` and stored in the config file.
