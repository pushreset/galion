# gallion

## GitHub account

Use only the `pushreset` GitHub account for this repo: pushes, PRs, PR comments, merges.

- Before any `gh` or `git push` call, check `gh auth status` shows `pushreset` as active; if not, `gh auth switch -u pushreset`.
- Git pushes go through gh (repo-local `credential.https://github.com.helper = !gh auth git-credential`), so they use the active gh account. Never push or comment as another account.

## Deploying the ice service

Merging does not deploy the `ice` service. Coolify keeps its own copy of the script and does not rewrite it from the `content: |` block of `coturn-compose.txt`, even on a redeploy: the file has to be replaced by hand.

After merging a PR that changes the script in `coturn-compose.txt`:

1. Put the script on the clipboard:
   ```sh
   awk 'f{sub(/^ {10}/,"");print} /content: \|$/{f=1}' coturn-compose.txt | pbcopy
   ```
   Keep the `$`: a comment at the top of the file also contains `content: |`, and without it the copy starts with YAML and the service crashes on start.
2. Tell the user to paste it over `/data/coolify/services/cedthaqnw77lgzrdexjkvcwt/ice.mjs` in Coolify and restart the `ice` service.
3. Once they say it is done, check the live service answers with the new code (for the leaderboard: `curl -H 'Origin: https://pushreset.github.io' '<ICE_URL in net.js>scores?b=waves'` answers `{"top":[...],"rank":-1}`). Read only: do not post scores to the live board.

A change to the compose outside the script (volumes, environment, ports) is not picked up either: the user pastes the compose into Coolify too.
