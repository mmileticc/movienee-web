# Movienee Web

The web version of Movienee: discover movies, see which cinemas in Serbia are showing them, keep a
watchlist and ratings, and plan a movie night with friends. It talks to the same Ktor backend as the
Android app.

## Stack

Angular 22 (standalone components, signals, zoneless) · TypeScript · SCSS · Angular CDK ·
Transloco (Serbian / English) · Firebase Authentication (Google) · Firebase Hosting · Vitest ·
ESLint · GitHub Actions

## Getting started

Requirements: Node 24 LTS (or 22.22.3+).

```bash
npm install
npm start            # http://localhost:4200, uses the hosted backend
npm run lint
npm run test:ci
npm run build        # dist/movienee-web/browser
```

## Project structure

```
src/app/
  core/       api/ (one service per backend area), auth/, http/ (interceptors, friendly errors),
              models/ (TypeScript types = the backend JSON contract), prefs/ (language, theme), util/
  shared/     layout/ (app shell with top and bottom navigation), ui/ (reusable components)
  features/   one folder per screen, lazy-loaded
public/i18n/  sr.json, en.json - generated from the Android app's strings
i18n-web/     web-only translations, merged into public/i18n by the sync script
```

Rules: features never call `HttpClient` directly, only services in `core/api`; components in
`shared/ui` are presentational (inputs/outputs only).

## Translations

The texts come from the Android app, so both apps say the same thing:

```bash
npm run i18n:sync    # ../MovieLens/app/src/main/res -> public/i18n/{sr,en}.json
```

Android placeholders (`%1$s`) become Transloco parameters (`{{p1}}`). Web-only texts go to
`i18n-web/{sr,en}.json`.

## Configuration

`src/environments/environment.base.ts` holds the backend URL and the Firebase web config (not
secret - it is part of every web app's public bundle). The backend must allow this app's origin in
its `ALLOWED_ORIGINS` environment variable.

## Deployment

Pushes to `main` are linted, tested, built and deployed to Firebase Hosting
(`.github/workflows/ci.yml`, site `movienee` -> https://movienee.web.app).
