import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDiscordPayload,
  buildSlackPayload,
  dispatchWaveNotification,
  extractClosedIssues,
  formatWaveMergeEvent,
  resolveWaveComplexity,
} from '../../../scripts/notify-wave-merge.mjs';

test('extractClosedIssues parses Closes, Fixes, and Resolves references without duplicates', () => {
  const body = `
    ## Summary
    Implements Drips Wave notification bot.
    Closes #160
    Fixes #154 and resolves #160
  `;
  assert.deepEqual(extractClosedIssues(body), [160, 154]);
  assert.deepEqual(extractClosedIssues('No issue references here'), []);
});

test('resolveWaveComplexity maps Drips Wave labels to 100 / 150 / 200 point tiers', () => {
  assert.deepEqual(resolveWaveComplexity(['Stellar Wave', 'complexity:trivial']), {
    isStellarWave: true,
    label: 'complexity:trivial',
    tier: 'Trivial',
    points: 100,
  });
  assert.deepEqual(resolveWaveComplexity([{ name: 'Stellar Wave' }, { name: 'complexity:medium' }]), {
    isStellarWave: true,
    label: 'complexity:medium',
    tier: 'Medium',
    points: 150,
  });
  assert.deepEqual(resolveWaveComplexity(['complexity:high']), {
    isStellarWave: true,
    label: 'complexity:high',
    tier: 'High',
    points: 200,
  });
});

test('formatWaveMergeEvent and Slack/Discord builders produce valid webhook payloads', async () => {
  const sampleEvent = {
    repository: { full_name: 'Ipramking/meridian-protocol' },
    pull_request: {
      number: 162,
      title: 'feat: add automated Slack/Discord notification bot for Drips Wave PR merges',
      html_url: 'https://github.com/Ipramking/meridian-protocol/pull/162',
      body: 'Closes #160',
      merged: true,
      merged_at: '2026-11-15T01:30:00.000Z',
      user: { login: 'aswadi' },
      merged_by: { login: 'Ipramking' },
      labels: [{ name: 'Stellar Wave' }, { name: 'complexity:medium' }],
    },
  };

  const summary = formatWaveMergeEvent(sampleEvent);
  assert.equal(summary.prNumber, 162);
  assert.equal(summary.author, 'aswadi');
  assert.equal(summary.mergedBy, 'Ipramking');
  assert.deepEqual(summary.closedIssues, [160]);
  assert.equal(summary.wave.points, 150);

  const slack = buildSlackPayload(summary);
  assert.ok(slack.text.includes('#162'));
  assert.equal(slack.blocks.length, 3);

  const discord = buildDiscordPayload(summary);
  assert.ok(discord.content.includes('Ipramking/meridian-protocol'));
  assert.equal(discord.embeds[0].title, '#162: feat: add automated Slack/Discord notification bot for Drips Wave PR merges');

  // Verify dry-run fallback when webhook URLs are unset
  const dryRes = await dispatchWaveNotification(summary, {
    slackWebhookUrl: '',
    discordWebhookUrl: '',
  });
  assert.equal(dryRes.dryRun, true);
  assert.deepEqual(dryRes.delivered, []);

  // Verify live webhook dispatch with mocked fetch
  const calls = [];
  const liveRes = await dispatchWaveNotification(summary, {
    slackWebhookUrl: 'https://hooks.slack.com/services/T00/B00/X00',
    discordWebhookUrl: 'https://discord.com/api/webhooks/123/abc',
    fetchImpl: async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return { ok: true, status: 200, text: async () => 'ok' };
    },
  });
  assert.equal(liveRes.dryRun, false);
  assert.deepEqual(liveRes.delivered, ['slack', 'discord']);
  assert.equal(calls.length, 2);
});
