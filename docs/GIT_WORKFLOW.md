Git Workflow

Branches
- main: protected, production-ready. PRs required.
- feature/*: short-lived feature branches.
- fix/*: short-lived bugfix branches.

Pull Requests
- Target `main`.
- Use the PR template to describe changes and test plan.
- CI runs lint and build checks via `.github/workflows/ci.yml`.
- AI review runs on each non-draft PR via `.github/workflows/ai-code-review.yml`.

Conventions
- Prefer small, focused PRs.
- Conventional-style commit messages are recommended but not enforced.
- Keep PRs green: fix lint/build before requesting review.

