# gallion

## GitHub account

Use only the `pushreset` GitHub account for this repo: pushes, PRs, PR comments, merges.

- Before any `gh` or `git push` call, check `gh auth status` shows `pushreset` as active; if not, `gh auth switch -u pushreset`.
- Git pushes go through gh (repo-local `credential.https://github.com.helper = !gh auth git-credential`), so they use the active gh account. Never push or comment as another account.
