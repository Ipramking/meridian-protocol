# Automated Slack & Discord Notification Bot for Drips Wave PR Merges

Meridian Protocol includes an automated notification bot that posts rich summaries to **Slack** and/or **Discord** whenever a **Stellar Drips Wave** pull request is merged into `main`.

---

## 1. Architecture & Components

- **Dispatcher & Formatter ([`scripts/notify-wave-merge.mjs`](../scripts/notify-wave-merge.mjs))**:
  - Parses the GitHub `pull_request` event payload (`formatWaveMergeEvent`).
  - Extracts linked issues closed by the PR (`Closes #158`, `Fixes #154`, etc. via `extractClosedIssues`).
  - Maps Drips Wave complexity labels to point tiers (`resolveWaveComplexity`):
    - `complexity:trivial` â†’ **100 points** (`Trivial`)
    - `complexity:medium` â†’ **150 points** (`Medium`)
    - `complexity:high` â†’ **200 points** (`High`)
  - Formats Slack Block Kit payloads (`buildSlackPayload`) and Discord rich embed payloads (`buildDiscordPayload`).
- **GitHub Actions Workflow ([`.github/workflows/wave-pr-notify.yml`](../.github/workflows/wave-pr-notify.yml))**:
  - Triggered on `pull_request_target` (`types: [closed]`) with `if: github.event.pull_request.merged == true`.
  - Gracefully falls back to dry-run logging when neither `SLACK_WEBHOOK_URL` nor `DISCORD_WEBHOOK_URL` is configured in repository secrets.

---

## 2. Repository Secrets Configuration

To enable live notifications in your Slack workspace or Discord server, add either (or both) of the following secrets under **Settings â†’ Secrets and variables â†’ Actions**:

| Secret Name | Target Platform | Format |
| :--- | :--- | :--- |
| `SLACK_WEBHOOK_URL` | Slack Incoming Webhook | `https://hooks.slack.com/services/T.../B.../...` |
| `DISCORD_WEBHOOK_URL` | Discord Channel Webhook | `https://discord.com/api/webhooks/.../...` |

---

## 3. Local Testing

Run the unit tests verifying issue extraction, Drips Wave point calculation, Slack Block Kit formatting, Discord embed formatting, and webhook dispatch:

```bash
npm run test --workspace=@meridian-protocol/sdk
```
