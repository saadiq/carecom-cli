import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { loadConfig, requireConfig, getJobId } from '../lib/config.ts';
import { graphql } from '../lib/care-client.ts';
import { JOB_APPLICATIONS_QUERY, JOB_SETUP_QUERY, SET_INTEREST_MUTATION, SET_PRIVATE_NOTE_MUTATION } from '../queries/job.ts';
import { fetchFullProfile, fetchAvailability } from './profile.ts';
import { formatTable, formatApplicantRow, formatFullProfile, formatAvailability } from '../lib/formatter.ts';
import type { CareComConfig } from '../types.ts';

const INTEREST_STATUS_MAP: Record<string, string> = {
  'interested': 'INTERESTED',
  'not-interested': 'NOT_INTERESTED',
  'unspecified': 'UNSPECIFIED',
};

export async function resolveApplicant(config: CareComConfig, jobId: string, applicantId: string) {
  const data = await graphql(config, 'JobApplications', JOB_APPLICATIONS_QUERY, {
    jobId,
    sortBy: 'RECENCY',
    start: '-1',
    max: 50,
  });
  const edges = data.jobApplications?.job?.applications?.edges || [];

  if (data.jobApplications?.job?.applications?.pageInfo?.hasNextPage) {
    console.warn(chalk.yellow('Warning: more than 50 applicants. Search may miss later applicants.'));
  }

  return edges.find((edge: any) => {
    const m = edge.node?.applicant?.member;
    return m?.id?.startsWith(applicantId) ||
           m?.legacyId === applicantId ||
           m?.displayName?.toLowerCase().includes(applicantId.toLowerCase());
  });
}

async function handleJobSummary(options: any): Promise<void> {
  const config = requireConfig(await loadConfig());
  const jobId = getJobId(options.jobId, config);

  const spinner = ora('Fetching job summary...').start();
  try {
    const data = await graphql(config, 'JobSetupCC', JOB_SETUP_QUERY, { jobId });
    const setup = data.jobSetup;
    spinner.succeed('Job summary loaded');

    if (options.json) {
      console.log(JSON.stringify(setup, null, 2));
      return;
    }

    const title = setup?.jobInput?.title || 'Untitled Job';
    const loc = setup?.jobLocation;
    const rate = setup?.jobInput?.rate;

    console.log(chalk.bold(`\n${title}`));
    console.log(`  Job ID: ${setup?.jobId || jobId}`);
    console.log(`  Status: ${setup?.jobStatus || 'Unknown'}`);
    if (loc) {
      console.log(`  Location: ${loc.city}, ${loc.stateCode} ${loc.zipcode}`);
    }
    if (setup?.jobInput?.startDate) {
      console.log(`  Start date: ${setup.jobInput.startDate}`);
    }
    if (rate?.minimum?.amount || rate?.maximum?.amount) {
      const min = rate.minimum?.amount;
      const max = rate.maximum?.amount;
      const rateStr = min && max ? `$${min}-$${max}/hr` : `$${min || max}/hr`;
      console.log(`  Rate: ${rateStr}`);
    }
    console.log(`  Total applicants: ${setup?.jobApplicantsCount ?? 0}\n`);
  } catch (err: any) {
    spinner.fail(`Failed: ${err.message}`);
    process.exit(1);
  }
}

async function handleApplicants(options: any): Promise<void> {
  const config = requireConfig(await loadConfig());
  const jobId = getJobId(options.jobId, config);

  const vars: any = { jobId, sortBy: 'RECENCY', start: '-1', max: 50 };
  if (options.filter) {
    vars.jobApplicationFilter = {
      jobApplicationInterest: INTEREST_STATUS_MAP[options.filter] || 'UNSPECIFIED',
      skipContactHistory: true,
    };
  }

  const spinner = ora('Fetching applicants...').start();
  try {
    const data = await graphql(config, 'JobApplications', JOB_APPLICATIONS_QUERY, vars);
    const applications = data.jobApplications?.job?.applications;
    const edges = applications?.edges || [];
    const count = applications?.filteredCount || edges.length;
    spinner.succeed(`Found ${count} applicants`);

    if (options.json) {
      console.log(JSON.stringify(edges, null, 2));
      return;
    }

    if (edges.length === 0) {
      console.log('\nNo applicants found.\n');
      return;
    }

    const headers = ['Name', 'ID', 'UUID', 'Location', 'Exp', 'Rate', 'Interest'];
    const rows = edges.map((edge: any) => formatApplicantRow(edge));
    console.log('\n' + formatTable(headers, rows) + '\n');

    if (applications?.pageInfo?.hasNextPage) {
      console.log(chalk.yellow(`Showing first ${edges.length} of ${count}. More applicants exist.\n`));
    }
  } catch (err: any) {
    spinner.fail(`Failed: ${err.message}`);
    process.exit(1);
  }
}

async function handleApplicantDetail(applicantId: string, options: any): Promise<void> {
  const config = requireConfig(await loadConfig());
  const jobId = getJobId(options.jobId, config);

  const spinner = ora('Fetching applicant...').start();
  try {
    const match = await resolveApplicant(config, jobId, applicantId);
    if (!match) {
      spinner.fail(`No applicant found matching "${applicantId}"`);
      process.exit(1);
    }

    const memberUUID = match.node?.applicant?.member?.id;
    spinner.text = 'Fetching full profile...';

    const fetches: Promise<any>[] = [fetchFullProfile(config, memberUUID)];
    if (options.availability) fetches.push(fetchAvailability(config, memberUUID));

    const results = await Promise.all(fetches);
    const caregiver = results[0].getCaregiver;
    const availability = results[1]?.AvailabilityCalendar?.availability || [];
    spinner.succeed('Profile loaded');

    if (options.json) {
      const out: any = { application: match, profile: caregiver };
      if (options.availability) out.availability = availability;
      console.log(JSON.stringify(out, null, 2));
      return;
    }

    console.log(formatFullProfile(caregiver));

    if (options.availability) {
      console.log(chalk.bold('\n--- Availability ---'));
      console.log(`  ${formatAvailability(availability)}`);
    }

    const node = match.node;
    console.log(chalk.bold('\n--- Application ---'));
    console.log(`  Application ID: ${node.jobApplicationId}`);
    console.log(`  Interest: ${node.seekerInterest || 'unspecified'}`);
    console.log(`  Conversation: ${node.conversationId || 'N/A'}`);
    if (node.privateNote) {
      console.log(`  Private note: ${node.privateNote}`);
    }
    console.log('');
  } catch (err: any) {
    spinner.fail(`Failed: ${err.message}`);
    process.exit(1);
  }
}

async function handleNote(applicantId: string, text: string, options: any): Promise<void> {
  const config = requireConfig(await loadConfig());
  const jobId = getJobId(options.jobId, config);

  if (text.length > 250) {
    console.error(`Note is ${text.length} chars. Max is 250.`);
    process.exit(1);
  }

  const spinner = ora('Finding applicant...').start();
  try {
    const match = await resolveApplicant(config, jobId, applicantId);
    if (!match) {
      spinner.fail(`No applicant found matching "${applicantId}"`);
      process.exit(1);
    }

    const appId = match.node.jobApplicationId;
    const name = match.node.applicant?.member?.displayName || applicantId;
    spinner.text = `Setting note on ${name}...`;

    const result = await graphql(config, 'JobApplicationPrivateNote', SET_PRIVATE_NOTE_MUTATION, {
      jobApplicationId: appId,
      privateNote: text,
    });

    if (result.jobApplicationPrivateNote?.error) {
      throw new Error(`Mutation failed: ${result.jobApplicationPrivateNote.error}`);
    }

    spinner.succeed(`Note set on ${name}: "${text}"`);
  } catch (err: any) {
    spinner.fail(`Failed: ${err.message}`);
    process.exit(1);
  }
}

async function handleInterest(applicantId: string, status: string, options: any): Promise<void> {
  const config = requireConfig(await loadConfig());
  const jobId = getJobId(options.jobId, config);

  const seekerInterest = INTEREST_STATUS_MAP[status];
  if (!seekerInterest) {
    console.error(`Invalid status "${status}". Use: interested, not-interested, or unspecified`);
    process.exit(1);
  }

  const spinner = ora('Finding applicant...').start();
  try {
    const match = await resolveApplicant(config, jobId, applicantId);
    if (!match) {
      spinner.fail(`No applicant found matching "${applicantId}"`);
      process.exit(1);
    }

    const appId = match.node.jobApplicationId;
    const name = match.node.applicant?.member?.displayName || applicantId;
    spinner.text = `Marking ${name} as ${status}...`;

    const result = await graphql(config, 'JobApplicationInterest', SET_INTEREST_MUTATION, {
      jobApplicationId: appId,
      seekerInterest,
    });

    if (result.jobApplicationInterest?.error) {
      throw new Error(`Mutation failed: ${result.jobApplicationInterest.error}`);
    }

    spinner.succeed(`${name} marked as ${status}`);
  } catch (err: any) {
    spinner.fail(`Failed: ${err.message}`);
    process.exit(1);
  }
}

export function createJobCommand(): Command {
  const job = new Command('job')
    .description('View job listing and applicants')
    .option('--job-id <id>', 'Job ID (uses default if not set)')
    .option('--json', 'Output raw JSON')
    .enablePositionalOptions()
    .passThroughOptions()
    .action(handleJobSummary);

  job
    .command('applicants')
    .description('List all applicants for a job')
    .option('--job-id <id>', 'Job ID')
    .option('--json', 'Output raw JSON')
    .option('--filter <interest>', 'Filter: interested, not-interested, unspecified')
    .action(handleApplicants);

  job
    .command('applicant <id>')
    .description('Show applicant profile + application context')
    .option('--job-id <id>', 'Job ID')
    .option('--json', 'Output raw JSON')
    .option('--availability', 'Include availability calendar')
    .action(handleApplicantDetail);

  job
    .command('note <id> <text>')
    .description('Set private note on an applicant (250 char max)')
    .option('--job-id <id>', 'Job ID')
    .action(handleNote);

  job
    .command('interest <id> <status>')
    .description('Set interest: interested, not-interested, or unspecified')
    .option('--job-id <id>', 'Job ID')
    .action(handleInterest);

  return job;
}
