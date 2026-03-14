import { Command } from 'commander';
import ora from 'ora';
import { loadConfig, requireConfig } from '../lib/config.ts';
import { graphql } from '../lib/care-client.ts';
import { NOTIFICATION_COUNTS_QUERY } from '../queries/notifications.ts';

export function createNotificationsCommand(): Command {
  const notifications = new Command('notifications')
    .description('Show unread notification counts')
    .option('--json', 'Output raw JSON')
    .action(async (options) => {
      const config = requireConfig(await loadConfig());

      const spinner = ora('Fetching notifications...').start();
      try {
        const data = await graphql(config, 'NotificationCounts', NOTIFICATION_COUNTS_QUERY);
        const counts = data.notificationCounts;
        spinner.succeed('Notifications loaded');

        if (options.json) {
          console.log(JSON.stringify(counts, null, 2));
          return;
        }

        console.log(`\n  Messages: ${counts?.conversations?.unread ?? 0}`);
        console.log(`  Applications: ${counts?.jobApplications?.unread ?? 0}`);
        console.log(`  Bookings: ${counts?.bookings?.unread ?? 0}\n`);
      } catch (err: any) {
        spinner.fail(`Failed: ${err.message}`);
        process.exit(1);
      }
    });

  return notifications;
}
