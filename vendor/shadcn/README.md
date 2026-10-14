# Local shadcn/ui Source

This is an offline source snapshot, not another installed UI library.
The original upstream files are preserved without import or styling rewrites.
Snapshots, the generated catalog, and the checksum manifest are local caches
ignored by Git. Only this guide, the license, and the sync script are versioned.
On a new computer, run the sync command below to recreate the cache.

- `catalog.json`: component names, implementations, and local source paths.
- `manifest.json`: immutable upstream commit, source paths, sizes, and SHA-256 checksums.
- `snapshots/<commit>/apps/v4/registry/`: components, examples, blocks, themes, and registry dependency metadata.
- `snapshots/<commit>/apps/v4/package.json`: upstream package dependencies and versions.
- `LICENSE.md`: upstream license.

## Use In This Project

1. Look up the component in `catalog.json`. Prefer `radix` for the current React pages.
2. Read its upstream implementation and related examples/registry dependencies locally.
3. Adapt the required source into `frontend/react/ui/`, using `../lib/utils` and the existing isolated theme classes in `frontend/react/archive.css`.
4. Install only that component's required dependencies. Do not copy the upstream package.json into the application.
5. Keep the MIT attribution and verify the component on desktop/mobile, including keyboard navigation.

Upstream components use Tailwind and upstream import aliases. The archived files
are not drop-in replacements for this mixed Nuxt/Vue and React-island project.
The current adapted components remain in `frontend/react/ui/` and are not overwritten.

## Refresh And Verify

From the repository root:

```sh
node scripts/sync-shadcn.mjs
node scripts/sync-shadcn.mjs --check
```

To download a specific immutable version:

```sh
node scripts/sync-shadcn.mjs --ref=<commit>
```

The refresh checks existing cached files before downloading. It refuses to
overwrite edited snapshots and preserves earlier snapshots. Downloaded sources
are compared against GitHub's Git blob hashes before publishing the manifest.
No upstream code or install scripts are executed.

This directory lives outside `frontend/`, so it is not automatically discovered,
type-checked, or bundled into the running application.
