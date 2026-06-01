import { useState, useEffect } from 'react';
import { Composition, continueRender, delayRender } from 'remotion';
import './styles.css';
import { LandingToOnboarding } from './scenes/LandingToOnboarding';

const FONT_LINKS = [
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Geist:wght@600;700&family=JetBrains+Mono:wght@500;600&display=swap',
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap',
];

function useFonts() {
  const [handle] = useState(() => delayRender('load-fonts'));
  useEffect(() => {
    FONT_LINKS.forEach((href) => {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = href;
      document.head.appendChild(l);
    });
    const fams = ["600 64px 'Geist'", "400 24px 'Inter'", "500 15px 'JetBrains Mono'", "24px 'Material Symbols Outlined'"];
    const done = () => continueRender(handle);
    const timeout = setTimeout(done, 5000); // never hang the render on a font fetch
    // give the <link> a tick to register the @font-face rules, then force-load them
    setTimeout(() => {
      Promise.all(fams.map((f) => document.fonts.load(f).catch(() => null)))
        .then(() => document.fonts.ready)
        .then(() => {
          clearTimeout(timeout);
          done();
        })
        .catch(done);
    }, 60);
  }, [handle]);
}

export const RemotionRoot: React.FC = () => {
  useFonts();
  return (
    <Composition
      id="LandingToOnboarding"
      component={LandingToOnboarding}
      durationInFrames={600}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
