# UI Components

Use the existing adapted shadcn/ui components here first. Do not recreate their
controls with unrelated native elements or custom approximations.

The complete upstream component source, examples, blocks, styles, dependency
metadata, and license are cached at `../../../vendor/shadcn/` from this directory
(repository root: `vendor/shadcn/`). See its `catalog.json` and `README.md`.

For a missing component, consult the cached React/Radix implementation and adapt
only the required source into this directory. Keep imports on `../lib/utils`,
scope styles to the existing `archive-*` classes, and preserve the public API and
accessibility behavior. Never install the entire upstream dependency list or
overwrite the existing adapted components automatically.
