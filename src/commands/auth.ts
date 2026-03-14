import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { loadConfig, saveConfig } from '../lib/config.ts';
import { parseCurlCommand, looksLikeCurlCommand } from '../lib/curl-parser.ts';
import { graphql } from '../lib/care-client.ts';
import { NOTIFICATION_COUNTS_QUERY } from '../queries/notifications.ts';
import type { CareComConfig } from '../types.ts';

async function readInteractiveInput(prompt: string): Promise<string> {
  console.log(chalk.cyan(prompt));
  console.log(chalk.gray('(Paste your cURL command, then press Enter when done)\n'));

  const lines: string[] = [];

  const { createInterface } = await import('node:readline');
  const reader = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  return new Promise((resolve) => {
    reader.on('line', (line: string) => {
      if (line.trim() === '' && lines.length > 0) {
        reader.close();
        resolve(lines.join('\n'));
        return;
      }
      if (line.trim() !== '') {
        lines.push(line);
      }
    });
  });
}

export function createAuthCommand(): Command {
  const auth = new Command('auth')
    .description('Manage Care.com authentication');

  auth
    .command('parse-curl')
    .description('Extract cookies from a cURL command copied from DevTools')
    .option('--job-id <id>', 'Set default job ID')
    .option('--zip <zip>', 'Set default zip code')
    .action(async (options) => {
      try {
        // Read from stdin if piped, otherwise interactive
        let curlInput: string;

        if (!process.stdin.isTTY) {
          const chunks: Buffer[] = [];
          for await (const chunk of process.stdin) {
            chunks.push(chunk);
          }
          curlInput = Buffer.concat(chunks).toString('utf-8');
        } else {
          curlInput = await readInteractiveInput('Paste your cURL command from Care.com DevTools:');
        }

        if (!curlInput.trim()) {
          console.error('No input provided.');
          process.exit(1);
        }

        if (!looksLikeCurlCommand(curlInput)) {
          console.error('Input does not look like a cURL command. Copy from DevTools: Right-click request > Copy > Copy as cURL');
          process.exit(1);
        }

        const spinner = ora('Parsing cookies...').start();
        const { cookies } = parseCurlCommand(curlInput);
        spinner.succeed(`Extracted ${Object.keys(cookies).length} cookies`);

        // Build config
        const config: CareComConfig = {
          cookies,
          defaultJobId: options.jobId || '35088345',
          defaultZip: options.zip || '11238',
          authenticatedAt: new Date().toISOString(),
        };

        // Test auth with NotificationCounts query (captured from browser, no variables needed)
        const testSpinner = ora('Testing authentication...').start();
        try {
          await graphql(config, 'NotificationCounts', NOTIFICATION_COUNTS_QUERY);
          testSpinner.succeed('Authentication verified');
        } catch (err: any) {
          testSpinner.fail(`Auth test failed: ${err.message}`);
          console.error('Cookies may be expired. Try copying a fresh cURL from Care.com.');
          process.exit(1);
        }

        await saveConfig(config);
        console.log(chalk.green('\nAuthenticated successfully!'));
        console.log(`  Default job ID: ${config.defaultJobId}`);
        console.log(`  Default zip: ${config.defaultZip}`);
        console.log(`  Config saved to ~/.config/carecom/config.json\n`);
      } catch (err: any) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });

  auth
    .command('status')
    .description('Show current auth status and defaults')
    .action(async () => {
      const config = await loadConfig();
      if (!config) {
        console.log('Not authenticated. Run: carecom auth parse-curl');
        return;
      }

      const age = Date.now() - new Date(config.authenticatedAt).getTime();
      const hours = Math.floor(age / (1000 * 60 * 60));
      const minutes = Math.floor((age % (1000 * 60 * 60)) / (1000 * 60));

      console.log(chalk.bold('\nCare.com Auth Status\n'));
      console.log(`  Authenticated: ${chalk.green('Yes')}`);
      console.log(`  Session age: ${hours}h ${minutes}m`);
      console.log(`  Cookies: ${Object.keys(config.cookies).length} stored`);
      console.log(`  Default job ID: ${config.defaultJobId || 'not set'}`);
      console.log(`  Default zip: ${config.defaultZip || 'not set'}\n`);
    });

  auth
    .command('set-defaults')
    .description('Set default job ID and/or zip code')
    .option('--job-id <id>', 'Default job ID')
    .option('--zip <zip>', 'Default zip code')
    .action(async (options) => {
      const config = await loadConfig();
      if (!config) {
        console.error('Not authenticated. Run: carecom auth parse-curl');
        process.exit(1);
      }

      if (options.jobId) config.defaultJobId = options.jobId;
      if (options.zip) config.defaultZip = options.zip;

      await saveConfig(config);
      console.log(chalk.green('Defaults updated.'));
      if (options.jobId) console.log(`  Job ID: ${config.defaultJobId}`);
      if (options.zip) console.log(`  Zip: ${config.defaultZip}`);
    });

  auth
    .command('ping')
    .description('Ping Care.com to refresh session cookies. Use with /loop to keep alive.')
    .option('--quiet', 'Suppress output on success (for scripting)')
    .action(async (options) => {
      const config = await loadConfig();
      if (!config) {
        console.error('Not authenticated. Run: carecom auth parse-curl');
        process.exit(1);
      }

      try {
        await graphql(config, 'NotificationCounts', NOTIFICATION_COUNTS_QUERY);
        if (!options.quiet) {
          const age = Date.now() - new Date(config.authenticatedAt).getTime();
          const mins = Math.floor(age / (1000 * 60));
          console.log(`Session alive. Last refresh: ${mins}m ago.`);
        }
      } catch (err: any) {
        console.error(`Session dead: ${err.message}`);
        process.exit(1);
      }
    });

  return auth;
}
