import chalk from 'chalk';

export function formatTable(headers: string[], rows: string[][]): string {
  const colWidths = headers.map((h, i) => {
    const maxData = rows.reduce((max, row) => Math.max(max, (row[i] || '').length), 0);
    return Math.max(h.length, maxData);
  });

  const sep = colWidths.map(w => '-'.repeat(w + 2)).join('+');
  const headerLine = headers.map((h, i) => ` ${h.padEnd(colWidths[i])} `).join('|');
  const dataLines = rows.map(row =>
    row.map((cell, i) => ` ${(cell || '').padEnd(colWidths[i])} `).join('|')
  );

  return [headerLine, sep, ...dataLines].join('\n');
}

function getRateStr(payRange: any, recurringRate?: any): string {
  const from = payRange?.hourlyRateFrom?.amount || recurringRate?.hourlyRateFrom?.amount;
  const to = payRange?.hourlyRateTo?.amount || recurringRate?.hourlyRateTo?.amount;
  if (!from) return '?';
  return to && to !== from ? `$${from}-$${to}` : `$${from}`;
}

function getApplicantRate(applicant: any): string {
  const cc = applicant?.profiles?.childCareCaregiverProfile;
  return getRateStr(cc?.payRange, cc?.recurringRate);
}

function getReviews(obj: any): { avg: string; count: number } {
  const metrics = obj?.revieweeMetrics?.metrics;
  if (!metrics) return { avg: 'N/A', count: 0 };
  const overall = metrics.averageRatings?.find((r: any) => r.type === 'OVERALL');
  return {
    avg: overall?.value ? String(overall.value) : 'N/A',
    count: metrics.totalReviews || 0,
  };
}

export function formatApplicantRow(edge: any): string[] {
  const node = edge.node || edge;
  const applicant = node.applicant || {};
  const member = applicant.member || {};
  const addr = member.address || {};
  const interest = node.seekerInterest || 'UNSPECIFIED';

  return [
    member.displayName || 'Unknown',
    member.legacyId || '',
    member.id?.substring(0, 8) || '',
    `${addr.city || '?'}, ${addr.state || '?'}`,
    String(applicant.yearsOfExperience ?? '?'),
    `${getApplicantRate(applicant)}/hr`,
    interest.toLowerCase(),
  ];
}

// Format the full profile from GetCaregiver query
export function formatFullProfile(cg: any): string {
  const member = cg.member || {};
  const addr = member.address || {};
  const profiles = cg.profiles || {};
  const reviews = getReviews(cg);
  const serviceIds: string[] = profiles.serviceIds || [];

  const lines = [
    chalk.bold(`\n${member.displayName || 'Unknown'}`),
    `UUID: ${member.id || 'N/A'}`,
    `Legacy ID: ${member.legacyId || 'N/A'}`,
    `Location: ${addr.city || '?'}, ${addr.state || '?'} ${addr.zip || ''}`,
    `Experience: ${cg.yearsOfExperience ?? '?'} years`,
    `Reviews: ${reviews.avg} avg (${reviews.count} reviews)`,
    `Badges: ${(cg.badges || []).join(', ') || 'None'}`,
    `Premium: ${member.isPremium ? 'Yes' : 'No'}`,
    `Hired locally: ${cg.hiredTimes ?? 0} times`,
    `Favorite: ${cg.isFavorite ? 'Yes' : 'No'}`,
    `Response time: ${cg.responseTime ? `${cg.responseTime}h` : 'N/A'}`,
    `Sign-up: ${cg.signUpDate || 'N/A'}`,
    `Services: ${serviceIds.join(', ') || 'None'}`,
  ];

  // Common bio
  const commonBio = profiles.commonCaregiverProfile?.bio?.experienceSummary;
  if (commonBio) {
    lines.push(`\n${chalk.bold('Bio:')}\n${commonBio}`);
  }

  // Per-vertical profiles
  const verticals = [
    { key: 'childCareCaregiverProfile', label: 'Child Care' },
    { key: 'tutoringCaregiverProfile', label: 'Tutoring' },
    { key: 'houseKeepingCaregiverProfile', label: 'Housekeeping' },
    { key: 'petCareCaregiverProfile', label: 'Pet Care' },
    { key: 'seniorCareCaregiverProfile', label: 'Senior Care' },
  ];

  for (const { key, label } of verticals) {
    const p = profiles[key];
    if (!p) continue;
    lines.push(`\n${chalk.bold(`--- ${label} ---`)}`);
    lines.push(`  Rate: ${getRateStr(p.payRange, p.recurringRate)}/hr`);
    if (p.yearsOfExperience != null) {
      lines.push(`  Experience: ${p.yearsOfExperience} years`);
    }
    // Only show per-vertical bio if it differs from the common bio
    const verticalBio = p.bio?.experienceSummary;
    if (verticalBio && verticalBio !== commonBio) {
      lines.push(`  Bio: ${verticalBio}`);
    }
    if (p.specificSubjects?.length) {
      lines.push(`  Subjects: ${p.specificSubjects.join(', ')}`);
    }
  }

  return lines.join('\n');
}

export function formatAvailability(slots: any[]): string {
  if (!slots || slots.length === 0) return 'No availability set';

  // Deduplicate recurring weeks into unique day/time combos
  const seen = new Map<string, { day: string; start: string; end: string }>();
  const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  for (const s of slots) {
    const d = new Date(s.startTime);
    const day = d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/New_York' });
    const start = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
    const end = new Date(s.endTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
    const key = `${day}|${start}|${end}`;
    if (!seen.has(key)) seen.set(key, { day, start, end });
  }

  const entries = [...seen.values()].sort(
    (a, b) => dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day)
  );

  // Group consecutive days with same hours
  const groups: { days: string[]; start: string; end: string }[] = [];
  for (const e of entries) {
    const last = groups[groups.length - 1];
    if (last && last.start === e.start && last.end === e.end) {
      last.days.push(e.day);
    } else {
      groups.push({ days: [e.day], start: e.start, end: e.end });
    }
  }

  return groups.map(g => {
    const dayStr = g.days.length > 2
      ? `${g.days[0]}-${g.days[g.days.length - 1]}`
      : g.days.join(', ');
    return `${dayStr}: ${g.start} - ${g.end}`;
  }).join('\n  ');
}

export function formatSearchResult(result: any, index: number): string {
  const lines = [
    chalk.bold(`${index + 1}. ${result.displayName || 'Unknown'}`),
    `   ID: ${result.legacyId || ''} | UUID: ${result.memberId?.substring(0, 8) || ''}`,
    `   Location: ${result.city || '?'}, ${result.state || '?'}`,
    `   Experience: ${result.yearsOfExperience ?? '?'} years | Rate: $${result.hourlyRateAmount || '?'}/hr`,
    `   Reviews: ${result.avgReviewRating || 'N/A'} (${result.numberOfReviews || 0})`,
  ];
  if (result.bio) {
    const truncated = result.bio.length > 150 ? result.bio.substring(0, 150) + '...' : result.bio;
    lines.push(`   Bio: ${truncated}`);
  }
  return lines.join('\n');
}
