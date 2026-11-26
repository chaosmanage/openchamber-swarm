# OpenChamber Swarm (0.3.0)
A clean-room, independently implemented preview of Antigravity-style collaborative coding agents. Targets OpenChamber SDK 2.8.0 and OpenCode plugin API 2.4.2.

## Install
On this VPS the project is /workspace/projects/swarm. In OpenChamber Settings → Extensions, add that local folder and review the requested capabilities. The background service and bundled OpenCode plugin execute locally with the server user's privileges; session control and transcript grants are required. Install/enable only after reviewing the source. No existing server configuration or global OpenCode settings have been changed. The bundled UI/service are already built.

Open a project (even a fresh unsent conversation), then use the Swarm rail panel or /swarm <task> (if no other extension/command has that name). Open the four-tab Swarm panel. An existing idle conversation becomes coordinator; if there is no session yet, the extension creates one through OpenCode. Each worker is a real separate OpenCode session, not a simulated UI row. The coordinator selects workers and verifier through the bundled tools. Verify plugin loading before starting paid model runs. If the host uses an unmanaged OpenCode instance, its Extensions screen may require the explicit Add to global config step.

## Architecture
- SDK guest panel/full page: Overview, Board, Members, Graph; search/filter, unread divider, follow toggle, live refresh, per-member chats, weighted mentions graph and animated Hive view, replay controls, zoom and inactive-member filtering. Overview groups running, reported and upcoming assignments into worker-based thread summaries.
- SDK keepRunning service: shared public board, persistent queues, session lookup, dispatch, supervision, verification gate, authenticated loopback routes and state stored in OPENCHAMBER_SERVICE_DATA_DIR.
- OpenCode plugin: swarm_add, swarm_post, swarm_read, swarm_status, swarm_retire, swarm_finish. Five bundled role/workflow skills.
- Coordinator and workers end their turns when no work remains. The service wakes a waiting member via OpenCode’s native synthetic inbox, preserving its conversation. Board posts remain on the board; a short synthetic wake notice prompts the agent to read the board, rather than creating a user-authored chat message. Deferred workers start only on first mention. Messages addressed to numbered groups and all are expanded; busy members receive queued posts after finishing.
- Token-free monitor wakes idle unfinished workers (or coordinator if all workers have reported) when all are idle for two minutes; reminder cooldown five minutes. Reconciles known sessions every 15 seconds. The bundled OpenCode plugin polls the extension’s authenticated local bridge for native session creation and synthetic wake jobs; no direct server credentials, ports or patches are required. Permissions/questions stay blocked until user intervenes. Retired members cannot receive new dispatches.
- Models selected per member; verification gate requires an explicit verifier result and reported workers. Assigned paths are advisory (overlap checked, not OS-enforced). This is not a guarantee that the model's report or verification is correct.

## Tests
npm install --ignore-scripts
npm run build
npm test
bun node_modules/@openchamber/sdk/scripts/check-guest.ts .

The mocked-host integration test verifies fresh coordinator creation, a busy worker queues a message, sleeps, resumes the same session, and wakes the coordinator with its report, without normal chat prompts. It does not call a real model. The SDK package check validates extension structure. A Chromium fixture smoke test covered Overview, Board, Members, Hive, Mentions, node selection and mobile rendering. Real model tool calling and long-run soak testing are still required.

## Differences from Antigravity / next work
- Monitor is deterministic service logic, not a separate LLM conversation. It cannot yet reason about novel deadlocks.
- Shared workspace only, with advisory path assignments. No per-worker worktree creation/merge, context forks, or live model switches. OpenChamber session control has no documented worktree or model-switch argument.
- Graph replay reflects historical posts, but uses current member status; no historical state replay or GIF export. The Hive uses original color-coded side-view pixel bees, tightly packed task hexagons, green completion outlines and blue recent-message paths. The entire pane uses a neutral near-black Antigravity-style palette, compact text tabs and flat member/board rows. It is not a pixel-identical clone.
- No full-screen native OpenCode TUI board, native status line or AGY keyboard parity. /swarm resolves in the OpenChamber composer; real host behavior has not been smoke tested.
- Quota failures and permission/question events block the member and require manual review/retry; no dedicated quota-specific resume policy. No automatic permission approval.
- State writes are atomic but host session operations and state are not transactional. Ambiguous interrupted dispatches are blocked for manual inspection. A single OpenChamber instance and same-user OpenCode runtime are assumed: the local bridge discovery file is per-user. The service and plugin must share filesystem and loopback access. Local same-user processes can access the bearer; it is not an OS security boundary.
- Hard limits: 12 members, 500 board posts, 100 dispatched turns per swarm; OpenChamber additionally imposes session prompt limits. Budget exhaustion pauses the swarm; resume UI is not yet implemented.
- No real provider test or full parity claim. Native synthetic wake notices can still appear as short labeled system events in the transcript (not user messages).

## References
- https://antigravity.google/docs/swarm/
- https://antigravity.google/docs/changelog
- https://glaforge.dev/posts/2026/11/25/seeing-what-your-coding-agents-are-doing-antigravity-swarms-and-generative-ui/
- https://github.com/google-antigravity/antigravity-cli
- https://github.com/openchamber/openchamber/blob/main/packages/sdk/API.md
- https://github.com/openchamber/openchamber/blob/main/packages/sdk/GUEST_SERVICES.md
