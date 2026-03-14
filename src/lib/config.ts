import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import type { CareComConfig } from '../types.ts';

const CONFIG_DIR = join(homedir(), '.config', 'carecom');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

async function ensureConfigDir(): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
}

export async function loadConfig(): Promise<CareComConfig | null> {
  try {
    const data = await readFile(CONFIG_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function saveConfig(config: CareComConfig): Promise<void> {
  await ensureConfigDir();
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function requireConfig(config: CareComConfig | null): CareComConfig {
  if (!config) {
    console.error('Not authenticated. Run: carecom auth parse-curl');
    process.exit(1);
  }
  return config;
}

export function getJobId(optionJobId: string | undefined, config: CareComConfig): string {
  const jobId = optionJobId || config.defaultJobId;
  if (!jobId) {
    console.error('No job ID. Use --job-id or set default with: carecom auth set-defaults --job-id <id>');
    process.exit(1);
  }
  return jobId;
}

export function getZip(optionZip: string | undefined, config: CareComConfig): string {
  const zip = optionZip || config.defaultZip;
  if (!zip) {
    console.error('No zip code. Use --zip or set default with: carecom auth set-defaults --zip <zip>');
    process.exit(1);
  }
  return zip;
}
