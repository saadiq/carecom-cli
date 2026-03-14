# Care.com CLI

Unofficial CLI tool for managing a Care.com job listing. Monitor applicants, read/send messages, search for caregivers, and view profiles — all from the terminal.

> **Disclaimer:** This is an unofficial, personal project and is not affiliated with, endorsed by, or supported by Care.com.

## Install

```bash
curl -sL https://raw.githubusercontent.com/saadiq/carecom-cli/main/install.sh | bash
```

Requires macOS on Apple Silicon. Installs to `~/.local/bin/carecom` (override with `INSTALL_DIR`).

<details>
<summary>Install from source</summary>

Requires [Bun](https://bun.sh) >= 1.0.

```bash
git clone https://github.com/saadiq/carecom-cli.git && cd carecom-cli
bun install
bun run build
# Binary at dist/carecom — move it to your PATH
```

</details>

## Authentication

Care.com uses cookie-based auth. Grab cookies from a browser session:

1. Open [care.com](https://www.care.com) and log in
2. Open Chrome DevTools (F12) > Network tab
3. Find any request to `/api/graphql`
4. Right-click > Copy as cURL
5. Run:

```bash
carecom auth parse-curl
```

Paste the cURL command when prompted. The CLI extracts cookies, tests the session, and stores credentials at `~/.config/carecom/config.json`.

Sessions expire after inactivity (30 min to 2 hours). Keep one alive with:

```bash
carecom auth ping
```

### Set defaults

```bash
carecom auth set-defaults --job-id <your-job-id> --zip <your-zip>
```

## Usage

### Job & Applicants

```bash
carecom job                              # Job summary
carecom job applicants                   # List all applicants
carecom job applicants --filter interested  # Filter by interest status
carecom job applicant "Gertrude"         # Look up by name
carecom job applicant 5a3b               # ...or UUID prefix
carecom job applicant 12345678           # ...or legacy ID
carecom job interest "Gertrude" interested   # Mark as interested
carecom job note "Gertrude" "Great fit"  # Add private note (250 char max)
```

### Messages

```bash
carecom messages                         # List all conversations
carecom messages read "Gertrude"         # Read thread (by name, UUID, or channel ID)
carecom messages send "Gertrude" "Hi!"   # Send a message
```

Anywhere you see a name, you can also use a UUID prefix, legacy ID, or channel ID.

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
carecom update                           # Self-update to latest release
carecom update check                     # Check for available updates
```

### Flags

All data commands support `--json` for raw API output:

```bash
carecom job applicants --json
carecom messages read "Gertrude" --json
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

### Releasing

```bash
git tag v0.2.0 && git push --tags
```

GitHub Actions builds the binary and publishes a GitHub Release. Installed binaries pick up new versions via `carecom update`.

### Project structure

```
src/
  index.ts           # CLI entry point
  types.ts           # TypeScript interfaces
  commands/          # Command handlers (auth, job, search, profile, messages, notifications, update)
  queries/           # GraphQL query strings
  lib/               # Shared utilities (API clients, config, formatting, updater)
```
