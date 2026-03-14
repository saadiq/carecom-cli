import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { loadConfig, requireConfig } from '../lib/config.ts';
import type { CareComConfig } from '../types.ts';
import { graphql } from '../lib/care-client.ts';
import { GET_CAREGIVER_QUERY, GET_AVAILABILITY_QUERY } from '../queries/profile.ts';
import { formatFullProfile, formatAvailability } from '../lib/formatter.ts';

function looksLikeUUID(id: string): boolean {
  return id.includes('-') || id.length > 20;
}

function requireUUID(id: string): void {
  if (!looksLikeUUID(id)) {
    console.error(`"${id}" looks like a legacy ID, not a UUID.`);
    console.error('Use the full UUID from "job applicants" or "search" output.');
    process.exit(1);
  }
}

export async function fetchFullProfile(config: CareComConfig, memberUUID: string) {
  return graphql(config, 'GetCaregiver', GET_CAREGIVER_QUERY, {
    id: memberUUID,
    serviceId: 'CHILD_CARE',
    shouldIncludeAllProfiles: true,
  });
}

export async function fetchAvailability(config: CareComConfig, memberUUID: string) {
  return graphql(config, 'GetCalendar', GET_AVAILABILITY_QUERY, {
    providerId: memberUUID,
  });
}

export function createProfileCommand(): Command {
  const profile = new Command('profile')
    .description('View full caregiver profile by UUID')
    .argument('<uuid>', 'Caregiver member UUID (from applicants or search results)')
    .option('--json', 'Output raw JSON')
    .option('--availability', 'Include availability calendar')
    .action(async (id, options) => {
      const config = requireConfig(await loadConfig());
      requireUUID(id);

      const spinner = ora('Fetching profile...').start();
      try {
        const fetches: Promise<any>[] = [fetchFullProfile(config, id)];
        if (options.availability) fetches.push(fetchAvailability(config, id));

        const results = await Promise.all(fetches);
        const caregiver = results[0].getCaregiver;
        const availability = results[1]?.AvailabilityCalendar?.availability || [];

        if (!caregiver) {
          spinner.fail('Caregiver not found');
          process.exit(1);
        }

        spinner.succeed('Profile loaded');

        if (options.json) {
          const out: any = { profile: caregiver };
          if (options.availability) out.availability = availability;
          console.log(JSON.stringify(out, null, 2));
          return;
        }

        console.log(formatFullProfile(caregiver));
        if (options.availability) {
          console.log(chalk.bold('\n--- Availability ---'));
          console.log(`  ${formatAvailability(availability)}`);
        }
        console.log('');
      } catch (err: any) {
        spinner.fail(`Failed: ${err.message}`);
        process.exit(1);
      }
    });

  return profile;
}

export function createAvailabilityCommand(): Command {
  const avail = new Command('availability')
    .description('View caregiver availability calendar')
    .argument('<uuid>', 'Caregiver member UUID')
    .option('--json', 'Output raw JSON')
    .action(async (id, options) => {
      const config = requireConfig(await loadConfig());
      requireUUID(id);

      const spinner = ora('Fetching availability...').start();
      try {
        const data = await fetchAvailability(config, id);
        const availability = data.AvailabilityCalendar?.availability || [];
        spinner.succeed('Availability loaded');

        if (options.json) {
          console.log(JSON.stringify(availability, null, 2));
          return;
        }

        if (availability.length === 0) {
          console.log('\nNo availability set.\n');
          return;
        }

        console.log(`\n  ${formatAvailability(availability)}\n`);
      } catch (err: any) {
        spinner.fail(`Failed: ${err.message}`);
        process.exit(1);
      }
    });

  return avail;
}
