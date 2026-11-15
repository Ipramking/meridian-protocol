#!/usr/bin/env node
/**
 * Automated Slack & Discord notification dispatcher for Drips Wave PR merges.
 *
 * Can be imported as a module in tests (`formatWaveMergeEvent`, `buildSlackPayload`,
 * `buildDiscordPayload`, `dispatchWaveNotification`) or executed directly from GitHub Actions.
 */

const COMPLEXITY_POINTS = {
  'complexity:trivial': { tier: 'Trivial', points: 100 },
  'complexity:medium': { tier: 'Medium', points: 150 },
  'complexity:high': { tier: 'High', points: 200 },
};

/**
 * Extract closed issue numbers (e.g. "Closes #158", "Fixes #154") from a PR body.
 * @param {string} body
 * @returns {number[]}
 */
export function extractClosedIssues(body = '') {
  const matches = [...String(body).matchAll(/\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/gi)];
  return [...new Set(matches.map((m) => Number(m[1])))];
}

/**
 * Infer Drips Wave complexity tier and points from PR/issue labels.
 * @param {Array<string | { name: string }>} labels
 */
export function resolveWaveComplexity(labels = []) {
  const normalized = labels.map((l) => (typeof l === 'string' ? l : l?.name ?? '').toLowerCase().trim());
  const isStellarWave = normalized.some((l) => l === 'stellar wave' || l === 'drips wave' || l.startsWith('complexity:'));

  for (const [labelKey, info] of Object.entries(COMPLEXITY_POINTS)) {
    if (normalized.includes(labelKey)) {
      return { isStellarWave: true, label: labelKey, tier: info.tier, points: info.points };
    }
  }

  return {
    isStellarWave,
    label: null,
    tier: isStellarWave ? 'Standard' : 'Unlabeled',
    points: null,
  };
}

/**
 * Normalize a GitHub pull_request webhook event into a structured Drips Wave merge summary.
 * @param {object} eventPayload
 */
export function formatWaveMergeEvent(eventPayload) {
  const pr = eventPayload?.pull_request;
  if (!pr) {
    throw new Error('Missing pull_request object in GitHub event payload');
  }

  const repoFullName = eventPayload?.repository?.full_name ?? 'Ipramking/meridian-protocol';
  const labels = Array.isArray(pr.labels) ? pr.labels : [];
  const wave = resolveWaveComplexity(labels);
  const closedIssues = extractClosedIssues(pr.body ?? '');

  return {
    repo: repoFullName,
    prNumber: Number(pr.number),
    title: String(pr.title ?? '').trim(),
    url: String(pr.html_url ?? `https://github.com/${repoFullName}/pull/${pr.number}`),
    author: String(pr.user?.login ?? 'unknown'),
    mergedBy: String(pr.merged_by?.login ?? pr.user?.login ?? 'maintainer'),
    mergedAt: String(pr.merged_at ?? new Date().toISOString()),
    closedIssues,
    wave,
  };
}

/**
 * Build a Slack Block Kit webhook payload for a merged Drips Wave PR.
 * @param {ReturnType<typeof formatWaveMergeEvent>} summary
 */
export function buildSlackPayload(summary) {
  const pointsBadge = summary.wave.points ? `${summary.wave.points} pts (${summary.wave.tier})` : summary.wave.tier;
  const issuesText =
    summary.closedIssues.length > 0 ? summary.closedIssues.map((n) => `#${n}`).join(', ') : 'None linked';

  return {
    text: `[Drips Wave] PR #${summary.prNumber} merged in ${summary.repo}: ${summary.title}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `Stellar Drips Wave PR Merged (#${summary.prNumber})`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*<${summary.url}|#${summary.prNumber}: ${summary.title}>*\nRepository: \`${summary.repo}\``,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Contributor:*\n@${summary.author}` },
          { type: 'mrkdwn', text: `*Wave Tier / Points:*\n${pointsBadge}` },
          { type: 'mrkdwn', text: `*Linked Issues:*\n${issuesText}` },
          { type: 'mrkdwn', text: `*Merged By:*\n@${summary.mergedBy}` },
        ],
      },
    ],
  };
}

/**
 * Build a Discord rich embed webhook payload for a merged Drips Wave PR.
 * @param {ReturnType<typeof formatWaveMergeEvent>} summary
 */
export function buildDiscordPayload(summary) {
  const pointsBadge = summary.wave.points ? `${summary.wave.points} pts (${summary.wave.tier})` : summary.wave.tier;
  const issuesText =
    summary.closedIssues.length > 0 ? summary.closedIssues.map((n) => `#${n}`).join(', ') : 'None linked';

  return {
    content: `**Stellar Drips Wave PR Merged** in \`${summary.repo}\``,
    embeds: [
      {
        title: `#${summary.prNumber}: ${summary.title}`,
        url: summary.url,
        color: 0x14b8a6,
        fields: [
          { name: 'Contributor', value: `@${summary.author}`, inline: true },
          { name: 'Wave Points', value: pointsBadge, inline: true },
          { name: 'Linked Issues', value: issuesText, inline: true },
          { name: 'Merged By', value: `@${summary.mergedBy}`, inline: true },
        ],
        timestamp: summary.mergedAt,
      },
    ],
  };
}

/**
 * Send Slack and/or Discord webhook notifications (or log payloads in dry-run mode).
 */
export async function dispatchWaveNotification(
  summary,
  {
    slackWebhookUrl = process.env.SLACK_WEBHOOK_URL,
    discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL,
    dryRun = false,
    fetchImpl = fetch,
  } = {}
) {
  const slackPayload = buildSlackPayload(summary);
  const discordPayload = buildDiscordPayload(summary);
  const delivered = [];

  if (dryRun || (!slackWebhookUrl && !discordWebhookUrl)) {
    return {
      dryRun: true,
      delivered,
      slackPayload,
      discordPayload,
    };
  }

  if (slackWebhookUrl) {
    const res = await fetchImpl(slackWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackPayload),
    });
    if (!res.ok) {
      throw new Error(`Slack webhook failed (${res.status}): ${await res.text()}`);
    }
    delivered.push('slack');
  }

  if (discordWebhookUrl) {
    const res = await fetchImpl(discordWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(discordPayload),
    });
    if (!res.ok) {
      throw new Error(`Discord webhook failed (${res.status}): ${await res.text()}`);
    }
    delivered.push('discord');
  }

  return {
    dryRun: false,
    delivered,
    slackPayload,
    discordPayload,
  };
}

async function main() {
  const fs = await import('node:fs');
  const eventPath = process.env.GITHUB_EVENT_PATH;
  const dryRun = process.argv.includes('--dry-run');

  if (!eventPath || !fs.existsSync(eventPath)) {
    console.log('[wave-notify] No GITHUB_EVENT_PATH provided; exiting cleanly.');
    return;
  }

  const payload = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
  if (!payload.pull_request?.merged) {
    console.log('[wave-notify] Pull request was closed without merging; skipping notification.');
    return;
  }

  const summary = formatWaveMergeEvent(payload);
  const result = await dispatchWaveNotification(summary, { dryRun });
  console.log(
    `[wave-notify] Processed PR #${summary.prNumber} (delivered: ${result.delivered.join(', ') || 'dry-run'})`
  );
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  main().catch((err) => {
    console.error('[wave-notify] Error:', err);
    process.exit(1);
  });
}
