# OpenChamber Swarm (0.4.0)
A clean-room, independently implemented preview of Antigravity-style collaborative coding agents. Targets OpenChamber SDK 2.8.0 and OpenCode plugin API 2.4.2.

## Install
On this VPS the project is /workspace/projects/swarm. In OpenChamber Settings → Extensions, add that local folder and review the requested capabilities. The background service and bundled OpenCode plugin execute locally with the server user's privileges; session control and transcript grants are required. Install/enable only after reviewing the source. No existing server configuration or global OpenCode settings have been changed. The bundled UI/service are already built.

Open a project (even a fresh unsent conversation), then use the Swarm rail panel or /swarm <task> (if no other extension/command has that name). Open the four-tab Swarm panel. An existing idle conversation becomes coordinator; if there is no session yet, the SDK creates and opens a coordinator chat using the active model picker. Worker and verifier model overrides are available in the Swarm settings gear; blank values inherit. Each worker is a real separate OpenCode session, not a simulated UI row. The coordinator selects workers and verifier through the bundled tools. Verify plugin loading before starting paid model runs. If the host uses an unmanaged OpenCode instance, its Extensions screen may require the explicit Add to global config step.

## Architecture
- SDK guest panel/full page: Overview, Board, Members, Graph; search/filter, unread divider, follow toggle, live refresh, per-member chats, weighted mentions graph and animated Hive view, replay controls, zoom and inactive-member filtering. Overview groups running, reported and upcoming assignments into worker-based thread summaries.
- SDK keepRunning service: shared public board, persistent queues, session lookup, dispatch, supervision, verification gate, authenticated loopback routes and state stored in OPENCHAMBER_SERVICE_DATA_DIR.
- OpenCode plugin: swarm_add, swarm_post, swarm_read, swarm_status, swarm_retire, swarm_finish. Five bundled role/workflow skills.
- Coordinator and workers end their turns when no work remains. The service wakes a waiting member via OpenCode’s native synthetic inbox, preserving its conversation. Board posts remain on the board; a short synthetic wake notice resumes the session. The bundled OpenCode context hook injects addressed posts directly into model context and acknowledges delivery; no user-authored chat prompt is created. Deferred workers start only on first mention. Explicit recipients, inline @mentions, numbered groups and @all are supported. Unaddressed posts remain on the board without waking agents. Busy agents see addressed updates at their next model request or are woken after idle.
- Token-free monitor wakes idle unfinished workers (or coordinator if all workers have reported) when all are idle for two minutes; reminder cooldown five minutes. Reconciles known sessions every 15 seconds, with a visible check count, last/next check, bridge health and errors. The bundled OpenCode plugin polls the extension’s authenticated local bridge scoped to the exact project directory for native session creation and synthetic wake jobs; no direct server credentials, ports or patches are required. Permissions/questions stay blocked until user intervenes. Retired members cannot receive new dispatches.
- Models selected per member; verification gate requires an explicit verifier result and reported workers. Assigned paths are advisory (overlap checked, not OS-enforced). This is not a guarantee that the model's report or verification is correct.

Deletion: use the trash icon to stop and remove a swarm while keeping chat sessions/files. A native coordinator session-deleted event removes the associated swarm and stops its members. The tab bar stays pinned while scrolling.

## Tests
npm install --ignore-scripts
npm run build
npm test
bun node_modules/@openchamber/sdk/scripts/check-guest.ts .

The automated suite covers fresh coordinator creation, model inheritance, project isolation, implicit board delivery to active agents, sleeping wake-ups, deferred verifier activation, monitor stall reminders, restart persistence, settings and deletion; a separate test invokes the bundled plugin hooks and tools with a native API test double. It does not call a real model. The SDK package check validates extension structure. A Chromium fixture smoke test covered Overview, Board, Members, Hive, Mentions, node selection and mobile rendering. Real model tool calling and long-run soak testing are still required.

## Differences from Antigravity / next work
- Monitor is deterministic service logic, not a separate LLM conversation. It cannot yet reason about novel deadlocks.
- Shared workspace only, with advisory path assignments. No per-worker worktree creation/merge, context forks, or live model switches. OpenChamber session control has no documented worktree or model-switch argument.
- Graph replay reflects historical posts and newly recorded member state transitions; older swarms lack a complete historical state log. No GIF export. The Hive uses original color-coded side-view pixel bees, tightly packed task hexagons, green completion outlines and blue recent-message paths. The entire pane uses a neutral near-black Antigravity-style palette, compact text tabs and flat member/board rows. It is not a pixel-identical clone.
- No full-screen native OpenCode TUI board, native status line or AGY keyboard parity. /swarm resolves in the OpenChamber composer; real host behavior has not been smoke tested.
- Quota failures and permission/question events block the member and require manual review/retry; no dedicated quota-specific resume policy. No automatic permission approval.
- State writes are atomic but host session operations and state are not transactional. Interrupted dispatches retain pending posts and retry with bounded wake attempts; unresolved failures block for inspection. A single OpenChamber instance and same-user OpenCode runtime are assumed: the local bridge discovery file is per-user. The service and plugin must share filesystem and loopback access. Local same-user processes can access the bearer; it is not an OS security boundary.
- Hard limits: 12 members, 500 board posts, 100 dispatched turns per swarm; OpenChamber additionally imposes session prompt limits. Budget exhaustion pauses the swarm; resume UI is not yet implemented.
- No live-provider end-to-end pass; the isolated native runtime smoke test hit an authentication blocker. No full parity claim. Native synthetic wake notices can still appear as short labeled system events in the transcript (not user messages).

## References
- https://antigravity.google/docs/swarm/
- https://antigravity.google/docs/changelog
- https://glaforge.dev/posts/2026/11/25/seeing-what-your-coding-agents-are-doing-antigravity-swarms-and-generative-ui/
- https://github.com/google-antigravity/antigravity-cli
- https://github.com/openchamber/openchamber/blob/main/packages/sdk/API.md
- https://github.com/openchamber/openchamber/blob/main/packages/sdk/GUEST_SERVICES.md
