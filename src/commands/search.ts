import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { loadConfig, requireConfig, getZip } from '../lib/config.ts';
import { graphql } from '../lib/care-client.ts';
import { SEARCH_PROVIDERS_QUERY } from '../queries/search.ts';
import { formatSearchResult } from '../lib/formatter.ts';

export function createSearchCommand(): Command {
  const search = new Command('search')
    .description('Search for caregivers')
    .argument('<query>', 'Search text (supports semantic search)')
    .option('--zip <zip>', 'Zip code (uses default if not set)')
    .option('--limit <n>', 'Max results', '10')
    .option('--json', 'Output raw JSON')
    .action(async (query, options) => {
      const config = requireConfig(await loadConfig());
      const zip = getZip(options.zip, config);
      const limit = parseInt(options.limit, 10);

      const spinner = ora(`Searching for "${query}"...`).start();
      try {
        const data = await graphql(config, 'SearchProvidersChildCare', SEARCH_PROVIDERS_QUERY, {
          input: {
            careType: 'SITTER',
            filters: {
              postalCode: zip,
              searchPageSize: limit,
              searchAfter: null,
              searchSortOrder: 'SORT_ORDER_RECOMMENDED_DESCENDING',
              searchTextCriteria: {
                text: query,
                useSemanticSearch: true,
              },
            },
            agesServedInMonths: [],
            attributes: [],
          },
        });

        const conn = data.searchProvidersChildCare?.searchProvidersConnection;
        if (!conn) {
          spinner.fail('No results returned');
          return;
        }

        const edges = conn.edges || [];
        spinner.succeed(`Found ${conn.totalHits || edges.length} results (showing ${edges.length})`);

        if (options.json) {
          console.log(JSON.stringify(data.searchProvidersChildCare, null, 2));
          return;
        }

        if (edges.length === 0) {
          console.log('\nNo caregivers found matching your search.\n');
          return;
        }

        console.log('');
        edges.forEach((edge: any, i: number) => {
          const node = edge.node || {};
          const member = node.member || {};
          const ccProfile = node.profiles?.childCareCaregiverProfile;
          const bio = node.profiles?.commonCaregiverProfile?.bio?.experienceSummary;
          const metrics = node.revieweeMetrics?.metrics;
          const overall = metrics?.averageRatings?.find((r: any) => r.type === 'OVERALL');

          const result = {
            displayName: member.displayName,
            memberId: member.id,
            legacyId: member.legacyId,
            city: member.address?.city,
            state: member.address?.state,
            yearsOfExperience: node.yearsOfExperience,
            avgReviewRating: overall?.value,
            numberOfReviews: metrics?.totalReviews || 0,
            hourlyRateAmount: ccProfile?.recurringRate?.hourlyRateFrom?.amount,
            badges: node.badges,
            bio,
          };
          console.log(formatSearchResult(result, i));
          console.log('');
        });

        if (conn.pageInfo?.hasNextPage) {
          console.log(chalk.gray(`More results available. Use --limit to fetch more.\n`));
        }
      } catch (err: any) {
        spinner.fail(`Failed: ${err.message}`);
        process.exit(1);
      }
    });

  return search;
}
