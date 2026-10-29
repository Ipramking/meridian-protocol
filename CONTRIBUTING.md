# Contributing to Meridian Protocol

Thank you for your interest in contributing to Meridian Protocol through the **Drips Wave Program**!

## Contribution Workflow

1. **Browse Issues**: Check the open issues on GitHub tagged with `Stellar Wave` and complexity labels:
   * `complexity:trivial` (100 Points)
   * `complexity:medium` (150 Points)
   * `complexity:high` (200 Points)
2. **Apply on Drips Wave**: Apply for the issue on the Drips Wave web app. Once assigned, you have the active Wave window to submit your PR.
3. **Branching**: Branch from `main` with naming convention `feat/issue-<number>-<short-description>` or `fix/issue-<number>`.
4. **Code Quality & Gates**:
   * All Soroban contracts must pass `cargo test`.
   * Formatting must adhere to standard rustfmt / prettier.
   * Pull requests must reference the issue: `Closes #<issue_number>`.
5. **Review & Points Payout**: Once merged, your points are automatically logged in the Drips Wave contract, and rewards are distributed at the end of the sprint cycle.
