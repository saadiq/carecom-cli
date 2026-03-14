#!/usr/bin/env bun

import { Command } from 'commander';
import { createAuthCommand } from './commands/auth.ts';
import { createJobCommand } from './commands/job.ts';
import { createSearchCommand } from './commands/search.ts';
import { createNotificationsCommand } from './commands/notifications.ts';
import { createProfileCommand, createAvailabilityCommand } from './commands/profile.ts';

const program = new Command();

program
  .name('carecom')
  .description('CLI tool for interacting with Care.com GraphQL API')
  .version('0.1.0')
  .enablePositionalOptions();

program.addCommand(createAuthCommand());
program.addCommand(createJobCommand());
program.addCommand(createSearchCommand());
program.addCommand(createProfileCommand());
program.addCommand(createAvailabilityCommand());
program.addCommand(createNotificationsCommand());

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
