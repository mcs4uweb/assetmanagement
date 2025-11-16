AI Code Review

Overview
- This repository uses a GitHub Actions workflow to run an AI-assisted code review on every Pull Request to `main` (except drafts).
- The AI reviewer summarizes the change and flags potential issues (correctness, security, performance, readability, and tests).

Setup
1. In your GitHub repository, add a repository secret named `OPENAI_API_KEY` with a valid API key.
2. Optional repository variables:
   - `OPENAI_MODEL` (default: `gpt-4o-mini`)
   - `OPENAI_BASE_URL` (default: `https://api.openai.com/v1`)

How it works
- Workflow file: `.github/workflows/ai-code-review.yml`
- Script: `scripts/ai-pr-review.mjs`
- On PR events, the workflow:
  - Reads changed files and unified diffs via GitHub API.
  - Sends a prompt to the LLM for a concise, actionable review.
  - Posts or updates a single PR comment containing the review.

Notes
- Large diffs are truncated to stay within model limits.
- Draft PRs are skipped.
- The comment is updated on subsequent pushes to the same PR.

