# AlterAttic

The website for AlterAttic, Anutani Pegu's video editing studio, at [alterattic.in](https://alterattic.in).

## Files

- `src/index.html`: the page you edit. One file with its styles and script.
- `public/index.html`: the built page that Firebase serves. Don't edit it by hand.
- `scripts/prerender.js`: builds `public/index.html` from `src/index.html` in a headless browser, so the full text (portfolio, projects, prices) is in the HTML for Google and AI search.
- `firebase.json`: Firebase Hosting settings.

## Before going live

In `src/index.html`, set `CONFIG.whatsapp` (country code and number, digits only, for example `919876543210`) and `CONFIG.email`. Replace the placeholder work tiles, projects and prices with real ones.

## Build and deploy

```
npm install -g firebase-tools playwright
node scripts/prerender.js
firebase use <your-firebase-project-id>
firebase hosting:channel:deploy preview   # temporary preview link, the live site is untouched
firebase deploy --only hosting            # publish to alterattic.in
```
