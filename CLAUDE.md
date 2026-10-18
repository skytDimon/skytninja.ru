# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Portfolio / landing site for SkytNinja (skytninja.ru) — a web-dev studio selling turnkey websites. Single-page static site, all UI text in Russian. Plain HTML + CSS + vanilla JS, bundled with Vite (no framework, no `vite.config`, default settings).

## Commands

```bash
npm run dev       # Vite dev server
npm run build     # production build → dist/
npm run preview   # serve dist/ locally
docker compose up -d --build   # build image and serve via nginx on host port 3000
node capture.js <url> <name>   # Puppeteer + ffmpeg: scroll-through video of a client site → public/<name>.mp4
```

There are no tests, linter, or formatter configured.

## Architecture

- **Real entry points are in the repo root**: `index.html` → `<script type="module" src="/main.js">` → `main.js` imports `./style.css`. Almost all content and markup lives directly in `index.html` (sections: `#hero`, `#about`, `#services`, `#cases`, footer `#contacts`, mobile nav).
- All JS lives in `main.js`: preloader with fake progress + 5s safety timeout, lazy-loading `video[data-src]`, pause-on-hover for `.case-card` videos, mobile nav, scroll reveal (`[data-reveal]` → `.is-visible`), count-up stats (`[data-count]` inside `.about-stats`), and `prefers-reduced-motion` handling.
- In `style.css` the final `@media (max-width: 768px)` block (hamburger / mobile nav) must stay after the base `.hamburger` / `.mobile-nav` rules, otherwise the base rules override it.
- Adding a case: copy a `.case-card` in `#cases`, record its video with `capture.js`. `index.html` also carries OG/schema.org meta (`public/og-image.jpg`).
- `public/` holds static assets served as-is: self-hosted fonts (TT Autonomous, IBM Plex Mono, declared via `@font-face` in `style.css`), case videos (`metriks.mp4`, `prime.mp4`, `romul.mp4`, `sandonato.mp4`), `bird.*` animation, photo. Reference them with absolute paths (`/fonts/...`, `/prime.mp4`).
- `dist/` is a build artifact (gitignored); don't edit it by hand.

## Deployment

Multi-stage `Dockerfile`: `node:22-alpine` runs `npm ci && npm run build` (`PUPPETEER_SKIP_DOWNLOAD=true`, so Chromium isn't fetched), then `nginx:alpine` serves `dist/` with `nginx.conf` (gzip, long cache for images/fonts, 30d for video, 7d for CSS/JS, SPA fallback to `index.html`). `docker-compose.yml` maps host `3000` → container `80` (container `skytninja-website`); an external reverse proxy is expected in front of it.

Because CSS/JS are cached for 7 days by nginx, cache-busting relies on Vite's hashed filenames in `dist/` — keep assets imported through the build rather than hardcoded into `public/` when they change often.
