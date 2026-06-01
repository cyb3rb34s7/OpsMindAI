# OpsMindAI — launch video (Remotion)

A ~94s cinematic launch film, built with Remotion and wired to the app's real
Tailwind theme, fonts, and hub logo.

## Develop / render
```bash
npm install
npm run dev      # Remotion Studio — scrub the timeline
npx remotion render src/index.ts LandingToOnboarding out.mp4
```

The single composition is `src/scenes/LandingToOnboarding.tsx`, assembled with
`@remotion/transitions`. The Material Symbols icon font is vendored locally
(`public/material-symbols.woff2`) so icon rendering is deterministic.

## Music credit
Background track: **"Music Promotion (No Copyright)"** by **miromaxmusic**, via Pixabay.
Pixabay Content License (royalty-free, no attribution required) — https://pixabay.com/service/license-summary/
