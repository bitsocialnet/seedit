---
name: modern-web-guidance
description: Look up browser support and implementation guidance when choosing a native control, focus behavior, browser API, or browser-sensitive layout.
---

<!-- Generated from .agents/skills/modern-web-guidance/SKILL.md; run yarn ai-workflow:sync. -->

From the project root, use the CLI pinned in the lockfile. Search for the browser behavior, then retrieve the matching guide by its returned ID.

```sh
DISABLE_TELEMETRY=1 yarn modern-web-guidance search "label checkbox control"
DISABLE_TELEMETRY=1 yarn modern-web-guidance retrieve checkbox
```

Apply the relevant advice to the component under review. Preserve Seedit's design and browser support requirements. Verify the observable behavior using the [browser verification playbook](../../../docs/agent-playbooks/verification.md).
