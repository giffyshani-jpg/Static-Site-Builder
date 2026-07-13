---
name: HoopIQ artifact registration
description: How the HoopIQ artifact was properly registered after being cloned rather than scaffolded.
---

## Rule
When a repo is cloned/copied into `artifacts/<slug>/`, the Replit proxy does NOT route to it because `createArtifact` was never called. The artifact.toml may exist on disk but the system-level registration is missing, causing 502 errors.

**Why:** `createArtifact` both creates the directory AND registers the artifact with the proxy. Copying files skips the registration step.

**How to apply:**
1. Backup all source files from `artifacts/<slug>/src/` and any custom config (package.json, vite.config.ts, tsconfig.json, index.html, components.json).
2. `rm -rf artifacts/<slug>/`
3. Call `createArtifact({ slug, previewPath, title, artifactType })` — this registers the artifact and creates the managed workflow `artifacts/<slug>: web`.
4. Copy all backed-up files back over the freshly scaffolded directory.
5. Run `pnpm install` then `WorkflowsRestart` on the managed workflow.

The managed workflow name is always `artifacts/<slug>: <service-name>` (service name comes from the artifact.toml `[[services]] name` field, typically "web").
