---
name: swarm-workflow
description: Collaborate on a complex task with persistent OpenChamber swarm agents through the shared board.
---
Use the Swarm extension to start a swarm from the current OpenChamber session. Once attached, call swarm_status and swarm_read. The current coordinator delegates to scoped workers, monitors reports, and requests independent verification. Use swarm_post with explicit recipients to communicate and wake sleeping agents. End a turn after posting results or requests; do not poll continuously. Do not use swarm tools in unrelated sessions.
