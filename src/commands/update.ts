import { Command } from 'commander';
import { checkForUpdates, performUpdate } from '../lib/updater.ts';

export function createUpdateCommand(): Command {
  const cmd = new Command('update')
    .description('Update carecom to the latest version')
    .action(() => performUpdate());

  cmd
    .command('check')
    .description('Check for available updates')
    .action(() => checkForUpdates(false));

  return cmd;
}
