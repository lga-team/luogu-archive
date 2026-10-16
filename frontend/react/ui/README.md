# UI Components

Use the existing adapted shadcn/ui components here first. Do not recreate their
controls with unrelated native elements or custom approximations.

Rebuilt pages use the solid light/dark page background from `archive.css`, not
the legacy blue gradient. Keep their root inside `.archive-react`.
User-selected Luogu themes may override this default on rebuilt pages in light
mode only. Dark mode stays solid. Never extend theme rules to legacy pages.

Never replace an entire page with a loading screen. By default, render the
page shell normally; show loading and errors only inside the data
region or control that is waiting. Independent metadata must not block the page.
When explicitly requested, reveal a page's components together without a loading
screen; keep API data independent of that reveal.

Use `../update-button` for update actions on rebuilt pages. Pass `state`,
`message`, and `onUpdate`; keep the existing request/captcha workflow in the
page or `SaveButton`. The shared control owns fixed sizing, two-second result
feedback, icons, animation, and the failure dialog. Migrate existing update
actions only when rebuilding their page, not as a site-wide replacement.

The complete upstream component source, examples, blocks, styles, dependency
metadata, and license are cached at `../../../vendor/shadcn/` from this directory
(repository root: `vendor/shadcn/`). See its `catalog.json` and `README.md`.

For a missing component, consult the cached React/Radix implementation and adapt
only the required source into this directory. Keep imports on `../lib/utils`,
scope styles to the existing `archive-*` classes, and preserve the public API and
accessibility behavior. Never install the entire upstream dependency list or
overwrite the existing adapted components automatically.

## Luogu Themes

The appearance editor supports light themes only. Import fetches exactly the
user-specified `/theme/design/{id}` through the existing authenticated CN `hi`
queue. Cached configurations live in `luogu_themes`; deploy backend migration
`20261016_0017` before enabling URL imports. There is no automatic refresh.
The settings API uses `POST /api/v1/themes/import` and `GET /api/v1/themes/{id}`.
User edits stay in this browser's `archive-luogu-theme-v1` storage key. JSON
import/export and editing work without the backend import endpoint.
