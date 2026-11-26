# Architecture and implementation notes

[Back to README](../README.md)

## Architecture
- SDK guest panel/full page: Overview, Board, Members, Graph; search/filter, unread divider, follow toggle, live refresh, per-member chats, weighted mentions graph and animated Hive view, replay controls, zoom and inactive-member filtering. Overview groups running, reported and upcoming assignments into worker-based thread summaries.
- SDK keepRunning service: shared public board, persistent queues, session lookup, dispatch, supervision, verification gate, authenticated loopback routes and state stored in OPENCHAMBER_SERVICE_DATA_DIR.
- OpenCode plugin: swarm_add, swarm_post, swarm_read, swarm_status, swarm_retire, swarm_finish. Five bundled role/workflow skills.
- Coordinator and workers end their turns when no work remains. The service wakes a waiting member via OpenCode’s native synthetic inbox after a one-time normal startup prompt, preserving its conversation. Board posts remain on the board; a short synthetic wake notice resumes the session. The bundled OpenCode context hook injects addressed posts directly into model context and acknowledges delivery; no board-update chat prompt is created. The coordinator’s original task and a short initial role assignment for each child are normal first prompts so providers such as Copilot Auto can route correctly. Deferred workers start only on first mention. Explicit recipients, inline @mentions, numbered groups and @all are supported. Unaddressed posts remain on the board without waking agents. Busy agents see addressed updates at their next model request or are woken after idle.
- Token-free monitor wakes idle unfinished workers (or coordinator if all workers have reported) when all are idle for two minutes; reminder cooldown five minutes. Reconciles known sessions every 15 seconds, with a visible check count, last/next check, bridge health and errors. The bundled OpenCode plugin polls the extension’s authenticated local bridge scoped to the exact project directory for native session creation and synthetic wake jobs; no direct server credentials, ports or patches are required. Permissions/questions stay blocked until user intervenes. Retired members cannot receive new dispatches.
- Models selected per member; verification gate requires an explicit verifier result and reported workers. Assigned paths are advisory (overlap checked, not OS-enforced). This is not a guarantee that the model's report or verification is correct.

Deletion: use the trash icon to stop and remove a swarm while keeping chat sessions/files. A native coordinator session-deleted event removes the associated swarm and stops its members. The tab bar stays pinned while scrolling. Old records whose chat was deleted before the extension subscribed to deletion events can be removed with the trash icon.

## Tests
```sh
npm install --ignore-scripts
npm run build
npm test
bun node_modules/@openchamber/sdk/scripts/check-guest.ts .
```

The automated suite covers fresh coordinator creation, model inheritance, project isolation, implicit board delivery to active agents, sleeping wake-ups, deferred verifier activation, monitor stall reminders, restart persistence, settings and deletion; a separate test invokes the bundled plugin hooks and tools with a native API test double. Integration tests also exercise the coordinator model switch, separate worker/verifier models and the AI monitor advisory model. It does not call a real model. The SDK package check validates extension structure. A Chromium fixture smoke test covered Overview, Board, Members, Hive, Mentions, node selection and mobile rendering. A live Copilot Auto diagnostic recruited two workers and a verifier, exchanged 12 posts, observed sleeping agents resume, and completed three monitor checks without provider errors. It was stopped before task completion. Full end-to-end completion and long-run soak testing remain outstanding.

## Differences from Antigravity / next work
- Monitor has deterministic periodic health checks and stall recovery plus optional stateless AI advisory reviews on stalls. It is not a persistent monitor conversation; review results are posted to the board and wake the coordinator. The optional review can consume provider quota.
- Shared workspace only, with advisory path assignments. No per-worker worktree creation/merge or context forks. Role model overrides are captured at launch; retry can adopt a model changed in the member chat.
- Graph replay reflects historical posts and newly recorded member state transitions; older swarms lack a complete historical state log. No GIF export. The rail icon is a bee. The Hive uses original color-coded side-view pixel bees with hinged flapping wings, hovering and sleeping animations (reduced-motion supported), tightly packed task hexagons, green completion outlines and blue recent-message paths. The entire pane uses a neutral near-black Antigravity-style palette, compact text tabs and flat member/board rows. It is not a pixel-identical clone.
- No full-screen native OpenCode TUI board, native status line or AGY keyboard parity. /swarm uses the native OpenCode command path so the composer selection is applied before swarm creation. The native API test double verifies the invocation model/variant, concise generated title, and parent linkage. A full provider run remains unverified.
- Quota failures and permission/question events block the member and require manual review/retry; no dedicated quota-specific resume policy. No automatic permission approval.
- State writes are atomic but host session operations and state are not transactional. Interrupted dispatches retain pending posts and retry with bounded wake attempts; unresolved failures block for inspection. A single OpenChamber instance and same-user OpenCode runtime are assumed: the local bridge discovery file is per-user. The service and plugin must share filesystem and loopback access. Local same-user processes can access the bearer; it is not an OS security boundary.
- Hard limits: 12 members, 500 board posts, 100 dispatched turns per swarm; OpenChamber additionally imposes session prompt limits. Budget exhaustion pauses the swarm; resume UI is not yet implemented.
- No complete live-provider end-to-end pass. The Copilot Auto diagnostic verified startup and communication but was stopped before completion. No full parity claim. Native synthetic wake notices can still appear as short labeled system events in the transcript (not user messages).

## References
- https://antigravity.google/docs/swarm/
- https://antigravity.google/docs/changelog
- https://glaforge.dev/posts/2026/11/25/seeing-what-your-coding-agents-are-doing-antigravity-swarms-and-generative-ui/
- https://github.com/google-antigravity/antigravity-cli
- https://github.com/openchamber/openchamber/blob/main/packages/sdk/API.md
- https://github.com/openchamber/openchamber/blob/main/packages/sdk/GUEST_SERVICES.md
