# BLACK BOX

A compact interactive machine puzzle built for the browser. Restore four coupled systems and recover the final transmission.

## Features

- Four-stage puzzle with locally persisted progress
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
