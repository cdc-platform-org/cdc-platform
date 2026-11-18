/**
 * Product window of the home hero: our code editor with a student (Temo, 15)
 * typing live, a preview pane, an AI-mentor test line, a photo "camera"
 * card and a verified-skill badge. All visible text follows the site
 * language: Georgian on `ka`, English everywhere else. The typing loop
 * pauses under reduced motion (the finished line is shown instead).
 */
import { useEffect, useState } from 'react';
import Image from 'next/image';
import styles from './HeroSection.module.css';

const COPY = {
  ka: {
    comment: "// თემოს პირველი პროექტი 🚀",
    name: 'თემო',
    line: '  return `გამარჯობა, ${who}! 👋`;',
    hello: 'გამარჯობა, თემო! 👋',
    click: 'დააჭირე',
    tests: '✓ 3/3 ტესტი გავიდა',
    mentor: 'AI მენტორი: „შესანიშნავია! შემდეგი ნაბიჯი — ციკლები.“',
    cam: 'თემო, 15 წლის',
    camNote: 'წერს კოდს',
    badge: 'JavaScript საფუძვლები',
    badgeNote: 'უნარი დადასტურებულია',
    window: 'კოდის რედაქტორი',
  },
  en: {
    comment: "// Temo's first project 🚀",
    name: 'Temo',
    line: '  return `Hello, ${who}! 👋`;',
    hello: 'Hello, Temo! 👋',
    click: 'Click me',
    tests: '✓ 3/3 tests passed',
    mentor: 'AI mentor: “Great job! Next step — loops.”',
    cam: 'Temo, 15',
    camNote: 'writing code',
    badge: 'JavaScript basics',
    badgeNote: 'Skill verified',
    window: 'Code editor',
  },
} as const;

export default function HeroCodeDemo({ lang }: { lang: 'ka' | 'en' }) {
  const c = COPY[lang];
  const [typed, setTyped] = useState<string>(c.line);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Type by code point (Array.from) so the 👋 emoji is never cut in half.
    const chars = Array.from(c.line);
    let i = 0;
    let timer: number;
    const tick = () => {
      setTyped(chars.slice(0, i).join(''));
      i = i < chars.length ? i + 1 : 0;
      timer = window.setTimeout(tick, i === 0 ? 1800 : 70);
    };
    tick();
    return () => window.clearTimeout(timer);
  }, [c.line]);

  return (
    <div className={styles.stage}>
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.win} role="img" aria-label={c.window}>
        <div className={styles.winBar}>
          <i style={{ background: '#ff5f57' }} /><i style={{ background: '#febc2e' }} /><i style={{ background: '#28c840' }} />
          <span className={styles.tab}>greeting.js</span>
          <span className={styles.tab2}>preview</span>
          <span className={styles.live}><i />LIVE · CDC Code Studio</span>
        </div>
        <div className={styles.winBody}>
          <div className={styles.code}>
            <div className={styles.ln}><em>1</em><span className={styles.cc}>{c.comment}</span></div>
            <div className={styles.ln}><em>2</em><span><span className={styles.ck}>const</span> <span className={styles.ct}>name</span> = <span className={styles.cs}>&apos;{c.name}&apos;</span>;</span></div>
            <div className={styles.ln}><em>3</em><span>&nbsp;</span></div>
            <div className={styles.ln}><em>4</em><span><span className={styles.ck}>function</span> <span className={styles.cf}>greet</span>(<span className={styles.ct}>who</span>) {'{'}</span></div>
            <div className={styles.ln}><em>5</em><span className={styles.typed}>{typed}</span><span className={styles.caret} aria-hidden="true" /></div>
            <div className={styles.ln}><em>6</em><span>{'}'}</span></div>
            <div className={styles.ln}><em>7</em><span>&nbsp;</span></div>
            <div className={styles.ln}><em>8</em><span><span className={styles.cf}>button</span>.<span className={styles.cf}>onclick</span> = () =&gt; <span className={styles.cf}>greet</span>(<span className={styles.ct}>name</span>);</span></div>
          </div>
          <div className={styles.preview}>
            <div className={styles.pvLabel}>PREVIEW</div>
            <div className={styles.pvCard}><h4>{c.hello}</h4><button type="button" tabIndex={-1}>{c.click}</button></div>
          </div>
          <div className={styles.term}>{c.tests} · <span className={styles.ai}>{c.mentor}</span></div>
        </div>
      </div>
      <div className={styles.cam}>
        <Image src="/images/hero/cdc-hero-15-sm.webp" alt="" width={230} height={140} className={styles.camImg} />
        <div><b>{c.cam}</b><span><i />{c.camNote}</span></div>
      </div>
      <div className={styles.badge}>
        <div className={styles.tick}>✓</div>
        <p><strong>{c.badge}</strong>{c.badgeNote}</p>
      </div>
    </div>
  );
}
