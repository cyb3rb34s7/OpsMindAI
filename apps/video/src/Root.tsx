import { useState, useEffect } from 'react';
import { Composition, continueRender, delayRender, staticFile } from 'remotion';
import './styles.css';
import { LandingToOnboarding } from './scenes/LandingToOnboarding';

// Text fonts via Google (small, reliable). The Material Symbols icon font is large
// (~4MB) and raced the render when fetched remotely, so it's vendored locally and
// loaded as a FontFace — bulletproof, no network at render time.
const TEXT_FONTS =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Geist:wght@600;700&family=JetBrains+Mono:wght@500;600&display=swap';

function useFonts() {
  const [handle] = useState(() => delayRender('load-fonts', { timeoutInMilliseconds: 60000 }));
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = TEXT_FONTS;
    document.head.appendChild(link);

    const icons = new FontFace('Material Symbols Outlined', `url(${staticFile('material-symbols.woff2')}) format('woff2')`);

    Promise.all([
      icons.load().then((f) => document.fonts.add(f)).catch(() => null),
      document.fonts.load("400 24px 'Inter'").catch(() => null),
      document.fonts.load("600 64px 'Geist'").catch(() => null),
      document.fonts.load("500 15px 'JetBrains Mono'").catch(() => null),
    ])
      .then(() => document.fonts.ready)
      .then(() => continueRender(handle))
      .catch(() => continueRender(handle));
  }, [handle]);
}

export const RemotionRoot: React.FC = () => {
  useFonts();
  return (
    <Composition
      id="LandingToOnboarding"
      component={LandingToOnboarding}
      durationInFrames={446}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
