import { renameSync, unlinkSync, chmodSync } from 'fs';
import { dirname, join } from 'path';
import ora from 'ora';
import chalk from 'chalk';

const GITHUB_REPO = 'saadiq/carecom-cli';
const BINARY_NAME = 'carecom-darwin-arm64';

// @ts-ignore - Injected at build time via --define
const APP_VERSION: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

export function getCurrentVersion(): string {
  return APP_VERSION;
}

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface Release {
  version: string;
  assets: ReleaseAsset[];
}

export async function fetchLatestRelease(): Promise<Release | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      { headers: { 'User-Agent': 'carecom-cli' } }
    );
    if (!res.ok) return null;
    const data = await res.json() as { tag_name: string; assets: ReleaseAsset[] };
    return { version: data.tag_name.replace(/^v/, ''), assets: data.assets };
  } catch {
    return null;
  }
}

export function isNewerVersion(latest: string, current: string): boolean {
  if (current === 'dev') return false;
  const latestParts = latest.split('.').map(Number);
  const currentParts = current.split('.').map(Number);
  for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
    const l = latestParts[i] ?? 0;
    const c = currentParts[i] ?? 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
}

export async function checkForUpdates(silent: boolean): Promise<void> {
  const current = getCurrentVersion();
  if (current === 'dev' && silent) return;

  const release = await fetchLatestRelease();
  if (!release) {
    if (!silent) console.log(chalk.yellow('Could not check for updates.'));
    return;
  }

  if (isNewerVersion(release.version, current)) {
    console.log(
      chalk.yellow(`\nUpdate available: ${current} → ${release.version}`) +
      chalk.dim(`\nRun ${chalk.bold('carecom update')} to update.`)
    );
  } else if (!silent) {
    console.log(chalk.green(`You're on the latest version (${current}).`));
  }
}

export async function performUpdate(): Promise<void> {
  const current = getCurrentVersion();
  if (current === 'dev') {
    console.log(chalk.yellow('Cannot self-update in dev mode. Use git pull instead.'));
    return;
  }

  const spinner = ora('Checking for updates...').start();

  const release = await fetchLatestRelease();
  if (!release) {
    spinner.fail('Could not fetch latest release from GitHub.');
    return;
  }

  if (!isNewerVersion(release.version, current)) {
    spinner.succeed(`Already on the latest version (${current}).`);
    return;
  }

  const asset = release.assets.find((a) => a.name === BINARY_NAME);
  if (!asset) {
    spinner.fail(`No binary found for ${BINARY_NAME} in release v${release.version}.`);
    return;
  }

  let binary: ArrayBuffer;
  try {
    spinner.text = `Downloading ${release.version}...`;
    const res = await fetch(asset.browser_download_url, {
      headers: { 'User-Agent': 'carecom-cli' },
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      spinner.fail(`Download failed: ${res.status} ${res.statusText}`);
      return;
    }

    const expectedBytes = Number(res.headers.get('content-length') || 0);
    if (expectedBytes > 0) spinner.text = `Downloading ${release.version} (${(expectedBytes / 1_048_576).toFixed(0)} MB)...`;

    binary = await res.arrayBuffer();
    if (expectedBytes > 0 && binary.byteLength !== expectedBytes) {
      spinner.fail(`Download incomplete: got ${binary.byteLength} of ${expectedBytes} bytes.`);
      return;
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      spinner.fail('Download timed out.');
    } else {
      spinner.fail(`Download failed: ${(err as Error).message}`);
    }
    return;
  }

  const execPath = process.execPath;
  const execDir = dirname(execPath);
  const tmpPath = join(execDir, `.carecom-update-${Date.now()}`);
  const backupPath = `${execPath}.bak`;

  await Bun.write(tmpPath, binary);
  chmodSync(tmpPath, 0o755);

  try {
    renameSync(execPath, backupPath);
    renameSync(tmpPath, execPath);
    chmodSync(execPath, 0o755);
    spinner.succeed(`Updated ${current} → ${release.version}`);
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === 'EACCES') {
      spinner.fail('Permission denied. Try running with sudo.');
    } else {
      spinner.fail(`Update failed: ${error.message}`);
    }
    try { renameSync(backupPath, execPath); } catch {}
    try { unlinkSync(tmpPath); } catch {}
    return;
  }
  try { unlinkSync(backupPath); } catch {}
}
