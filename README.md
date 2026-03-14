# carecom-cli

CLI tool for managing a Care.com job listing. Monitor applicants, read/send messages, search for caregivers, and view profiles — all from the terminal.

## Prerequisites

- [Bun](https://bun.sh) >= 1.0
- An active Care.com seeker account with a job listing

## Setup

```bash
git clone <repo-url> && cd carecom-cli
bun install
```

### Authentication

Care.com uses cookie-based auth. You'll need to grab cookies from a browser session:

1. Open [care.com](https://www.care.com) and log in
2. Open Chrome DevTools (F12) > Network tab
3. Find any request to `/api/graphql`
4. Right-click > Copy as cURL
5. Run:

```bash
bun run dev -- auth parse-curl
```

Paste the cURL command when prompted. The CLI will extract cookies, test the session, and store credentials at `~/.config/carecom/config.json`.

Sessions expire after inactivity (30 min to 2 hours). Keep one alive with:

```bash
bun run dev -- auth ping
```

### Set defaults

```bash
bun run dev -- auth set-defaults --job-id <your-job-id> --zip <your-zip>
```

## Usage

```bash
# Run in dev mode
bun run dev -- <command>

# Or build a standalone binary
bun run build
./dist/carecom <command>
```

### Job & Applicants

```bash
carecom job                              # Job summary
carecom job applicants                   # List all applicants
carecom job applicants --filter interested  # Filter by interest status
carecom job applicant "Shanyce"          # Full profile (match by name, UUID prefix, or legacy ID)
carecom job interest "Shanyce" interested   # Mark as interested
carecom job note "Shanyce" "Great fit"   # Add private note (250 char max)
```

### Messages

```bash
carecom messages                         # List all conversations
carecom messages read "Shanyce"          # Read message thread
carecom messages send "Shanyce" "Hi!"    # Send a message
```

Name matching works with partial names, member UUID prefixes, or channel IDs.

### Search & Profiles

```bash
carecom search "experienced nanny with tutoring background"  # AI-powered search
carecom search "homework help" --zip 11238 --limit 5

carecom profile <uuid>                   # Full multi-vertical caregiver profile
```

### Other

```bash
carecom notifications                    # Unread counts
carecom auth status                      # Session info
```

### Flags

All data commands support `--json` for raw API output:

```bash
carecom job applicants --json
carecom messages read "Shanyce" --json
```

## How it works

The CLI interacts with two APIs:

- **Care.com GraphQL** (`/api/graphql`) — job data, applicants, search, profiles, notifications
- **Stream Chat REST** (`chat.stream-io-api.com`) — messaging (Care.com uses GetStream.io for chat)

Authentication is cookie-based. The CLI sends the same cookies your browser uses and refreshes them from `Set-Cookie` response headers to keep the session alive.

## Development

```bash
bun run dev -- <command>     # Run directly
bun run build                # Compile standalone binary
bunx tsc --noEmit            # Type check
```

Project structure:

```
src/
  index.ts           # CLI entry point
  types.ts           # TypeScript interfaces
  commands/          # Command handlers (auth, job, search, profile, messages, notifications)
  queries/           # GraphQL query strings
  lib/               # Shared utilities (API clients, config, formatting)
```
