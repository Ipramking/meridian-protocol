# Contributing to Meridian Protocol

Thank you for your interest in contributing to Meridian Protocol through the **Drips Wave Program**!

## Contribution Workflow

1. **Browse Issues**: Check the open issues on GitHub tagged with `Stellar Wave` and complexity labels:
   * `complexity:trivial` (100 Points)
   * `complexity:medium` (150 Points)
   * `complexity:high` (200 Points)
2. **Apply on Drips Wave**: Apply for the issue on the Drips Wave web app. Once assigned, you have the active Wave window to submit your PR.
3. **Branching**: Branch from `main` with naming convention `feat/issue-<number>-<short-description>` or `fix/issue-<number>`.
4. **Code Quality & Gates** (the same checks CI runs):
   * Contracts: `npm run contracts:test` (builds the wasm first; router tests load the vault and compliance wasm).
   * SDK: `npm run test --workspace=@meridian-protocol/sdk`.
   * Relayer and web must build: `npm run build --workspace=@meridian-protocol/relayer` and `--workspace=@meridian-protocol/web`.
   * Anything the app shows as live must come from the chain, Horizon, Circle Iris or the anchor. No hardcoded numbers or placeholder responses presented as real data.
   * Pull requests must reference the issue: `Closes #<issue_number>`.
5. **Review & Points**: Once merged, points are awarded according to the Drips Wave program rules.

Never commit `.env` or any secret key.
