# Prepare a Seedit release

Inspect the current version, applicable prior version tag, and unreleased commits. Use the requested version or bump, and ask only when that choice remains materially ambiguous. Preserve unrelated edits and staging; report when no unreleased work exists.

Compose one user-facing sentence for `oneLinerDescription` in `scripts/release-body.js`. Start with "This version..." or "This release...", lead with the most useful visible changes, and end with a period. A preview shows the proposed version/text/files without applying them.

For authorized preparation, update the release description and `package.json` version, run `corepack yarn install` to synchronize `yarn.lock`, and run `corepack yarn changelog` to regenerate `CHANGELOG.md`. Inspect the diff and select checks under `docs/agent-playbooks/verification.md`, including required LLM context generation. Keep generated build output outside the release commit.

Seedit's `.github/workflows/release.yml` runs on `v*` tags, builds platform artifacts, signs the release manifest in CI, finalizes the body from uploaded assets, and deploys the release's `seedit-html` archive to seedit.app (Vercel Production, using the `VERCEL_TOKEN` repository secret). Do not deploy seedit.app by hand unless that step failed. Never print or copy signing secrets. There is no blotter update in this repository's release workflow.
