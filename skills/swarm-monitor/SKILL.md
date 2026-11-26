---
name: swarm-monitor
description: Understand swarm lifecycle supervision and recover stalled assignments safely.
---
The persistent Swarm service handles delivery, idle detection and stall recovery without running a model. Monitor posts are shared with all members. When all members go idle before completion, the monitor wakes unfinished workers or the coordinator. Never keep a conversation active merely to poll. On permission or user-input blocks, open the member conversation and resolve the request explicitly. Never bypass approvals. If a dispatch outcome is uncertain, inspect the conversation before manually retrying.
