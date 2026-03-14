import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { loadConfig, requireConfig } from '../lib/config.ts';
import { getStreamCredentials, listConversations, getChannelMessages, sendMessage, getOtherMember } from '../lib/stream-client.ts';
import { formatConversationList, formatMessageThread } from '../lib/formatter.ts';

function findChannel(channels: any[], nameOrId: string, myUserId: string) {
  return channels.find((ch: any) => {
    const { name, userId } = getOtherMember(ch, myUserId);
    return name.toLowerCase().includes(nameOrId.toLowerCase()) ||
           userId.startsWith(nameOrId) ||
           ch.channel.id.includes(nameOrId);
  });
}

async function resolveConversation(nameOrId: string, spinner: ReturnType<typeof ora>) {
  const config = requireConfig(await loadConfig());
  const creds = await getStreamCredentials(config);
  const channels = await listConversations(creds, 30);
  const match = findChannel(channels, nameOrId, creds.userId);

  if (!match) {
    spinner.fail(`No conversation found matching "${nameOrId}"`);
    process.exit(1);
  }

  const { name } = getOtherMember(match, creds.userId);
  return { creds, channel: match, otherName: name };
}

async function handleListConversations(options: any): Promise<void> {
  const config = requireConfig(await loadConfig());
  const spinner = ora('Fetching conversations...').start();
  try {
    const creds = await getStreamCredentials(config);
    spinner.text = 'Loading message threads...';
    const channels = await listConversations(creds, options.limit || 20);
    spinner.succeed(`Found ${channels.length} conversations`);

    if (options.json) {
      console.log(JSON.stringify(channels, null, 2));
      return;
    }

    if (channels.length === 0) {
      console.log('\nNo conversations found.\n');
      return;
    }

    console.log(formatConversationList(channels, creds.userId));
  } catch (err: any) {
    spinner.fail(`Failed: ${err.message}`);
    process.exit(1);
  }
}

async function handleReadConversation(nameOrId: string, options: any): Promise<void> {
  const spinner = ora('Fetching conversations...').start();
  try {
    const { creds, channel, otherName } = await resolveConversation(nameOrId, spinner);
    spinner.text = `Loading messages with ${otherName}...`;

    const channelData = await getChannelMessages(creds, channel.channel.id, options.limit || 25);
    spinner.succeed(`Messages with ${otherName}`);

    if (options.json) {
      console.log(JSON.stringify(channelData, null, 2));
      return;
    }

    console.log(formatMessageThread(channelData, creds.userId, otherName));
  } catch (err: any) {
    spinner.fail(`Failed: ${err.message}`);
    process.exit(1);
  }
}

async function handleSendMessage(nameOrId: string, text: string, options: any): Promise<void> {
  const spinner = ora('Finding conversation...').start();
  try {
    const { creds, channel, otherName } = await resolveConversation(nameOrId, spinner);
    spinner.text = `Sending message to ${otherName}...`;

    const result = await sendMessage(creds, channel.channel.id, text);

    if (options.json) {
      spinner.stop();
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    spinner.succeed(`Message sent to ${chalk.bold(otherName)}`);
    const preview = text.length > 80 ? text.substring(0, 80) + '...' : text;
    console.log(chalk.dim(`  ${preview}`));
  } catch (err: any) {
    spinner.fail(`Failed: ${err.message}`);
    process.exit(1);
  }
}

export function createMessagesCommand(): Command {
  const messages = new Command('messages')
    .description('View message conversations with caregivers')
    .option('--json', 'Output raw JSON')
    .option('--limit <n>', 'Max conversations to show', parseInt)
    .action(handleListConversations);

  messages
    .command('read <name>')
    .description('Read messages with a caregiver (match by name or conversation ID)')
    .option('--json', 'Output raw JSON')
    .option('--limit <n>', 'Max messages to show', parseInt)
    .action(handleReadConversation);

  messages
    .command('send <name> <text>')
    .description('Send a message to a caregiver (match by name, UUID, or channel ID)')
    .option('--json', 'Output raw JSON')
    .action(handleSendMessage);

  return messages;
}
