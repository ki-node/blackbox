# BLACK BOX

A compact interactive machine puzzle built for the browser. Restore six coupled systems and recover the final transmission.

## Features

- Six-stage puzzle with locally persisted progress
- Touch, mouse and keyboard interaction
- Optional procedural audio with no autoplay
- Reduced-motion and forced-colors support
- Mobile Chromium, iPhone/WebKit, compact 320 px and desktop browser tests
- Automated axe WCAG A/AA checks
- GitHub Pages deployment from the Vite `dist/` directory

## Development

```sh
npm ci
npm run dev
```

Run the complete local static and unit gate with `npm run check`. Browser coverage is available through `npm run test:e2e` after installing Playwright's Chromium and WebKit engines.

No account, tracking, backend or external content service is used.

## Build contexts

`npm run build` remains the GitHub Pages and installable PWA build. It writes
`dist/`, uses the `/blackbox/` base path, includes the manifest and registers
the service worker.

`npm run build:embedded` writes `dist-embedded/` for a version-pinned Orbit
iframe. The build uses only relative local resources, is relocatable to any
nested directory, does not include PWA installation UI or a service worker,
and does not request browser fullscreen. The runtime context (`web` or
`embedded`) is compiled into the bundle and written onto the root HTML element
before the first paint.

The application entry exposes idempotent `init()` and `destroy()` functions.
`pagehide` releases listeners, timers, animation frames, observers, dialogs,
canvas animation and audio; a restored page can initialize again. Progress is
validated and stored under `black-box-progress-v2`. Valid fields from a
partially damaged version-two save are retained where possible.

Embedded builds can send optional semantic haptic messages to their parent
window on channel `ki-node.project-bridge`, protocol version `1`, project
`blackbox`. Events are restricted to `light`, `medium`, `heavy`, `success`,
`warning` and `error`. The browser build maps the same events to optional
`navigator.vibrate()` feedback.

Every embedded build contains `ki-node-project.json` with the repository,
exact source commit, build command, runtime context and format version. The
build refuses a dirty source tree so provenance cannot claim the wrong commit.

Relevant validation commands:

```sh
npm run check
npm run build:embedded
npm run check:embedded
npm run test:reproducible
npm run test:e2e
npm run test:embedded:e2e
```
