import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { loadConfig, requireConfig, getJobId } from '../lib/config.ts';
import type { CareComConfig } from '../types.ts';
import { graphql } from '../lib/care-client.ts';
import { GET_CAREGIVER_QUERY, GET_AVAILABILITY_QUERY } from '../queries/profile.ts';
import { formatFullProfile, formatAvailability } from '../lib/formatter.ts';
import { resolveApplicant } from './job.ts';

function looksLikeUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

async function resolveUUID(config: CareComConfig, id: string, jobId: string): Promise<string> {
  if (looksLikeUUID(id)) return id;

  const match = await resolveApplicant(config, jobId, id);
  if (!match) {
    console.error(`No applicant found matching "${id}"`);
    process.exit(1);
  }
  const uuid = match.node?.applicant?.member?.id;
  if (!uuid) {
    console.error(`Matched applicant but could not extract UUID`);
    process.exit(1);
  }
  const name = match.node?.applicant?.member?.displayName || id;
  console.log(chalk.dim(`Resolved "${id}" → ${name} (${uuid})`));
  return uuid;
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
    .description('View full caregiver profile by UUID, prefix, or name')
    .argument('<id>', 'UUID, UUID prefix, legacy ID, or name substring')
    .option('--json', 'Output raw JSON')
    .option('--availability', 'Include availability calendar')
    .option('--job-id <id>', 'Job ID (for resolving non-UUID identifiers)')
    .action(async (id, options) => {
      const config = requireConfig(await loadConfig());
      const jobId = getJobId(options.jobId, config);

      const spinner = ora('Resolving...').start();
      const resolvedId = await resolveUUID(config, id, jobId);

      spinner.text = 'Fetching profile...';
      try {
        const fetches: Promise<any>[] = [fetchFullProfile(config, resolvedId)];
        if (options.availability) fetches.push(fetchAvailability(config, resolvedId));

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
    .argument('<id>', 'UUID, UUID prefix, legacy ID, or name substring')
    .option('--json', 'Output raw JSON')
    .option('--job-id <id>', 'Job ID (for resolving non-UUID identifiers)')
    .action(async (id, options) => {
      const config = requireConfig(await loadConfig());
      const jobId = getJobId(options.jobId, config);

      const spinner = ora('Resolving...').start();
      const resolvedId = await resolveUUID(config, id, jobId);

      spinner.text = 'Fetching availability...';
      try {
        const data = await fetchAvailability(config, resolvedId);
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
