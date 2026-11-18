/**
 * Home hero product window: 12 "posters" that rotate every 3 seconds, one per
 * course/profession (data: heroPosterData.ts, scenes: HeroPosterScenes.tsx),
 * each showing who teaches it (100% AI teacher / human lecturer + 24/7 AI
 * mentor / human lecturer + AI case simulator). The first poster is Temo's
 * Python lesson with a live typing line and his (static) photo card.
 * Georgian on `ka`, English on every other locale. Rotation pauses on
 * hover/focus and in a hidden tab, and stops under reduced motion.
 */
import { useEffect, useState } from 'react';
import Image from 'next/image';
import Scene from './HeroPosterScenes';
import { GROUP_COPY, POSTERS, PYTHON_TEACHER, type Lang } from './heroPosterData';
import styles from './HeroPosters.module.css';

const INTERVAL_MS = 3000;

const PY = { ka: '    return f"გამარჯობა, {who}!"', en: '    return f"Hello, {who}!"' } as const;
const CAM = {
  ka: { name: 'თემო, 15 წლის', note: 'წერს კოდს' },
  en: { name: 'Temo, 15', note: 'writing code' },
} as const;

export default function HeroPosters({ lang }: { lang: Lang }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [typed, setTyped] = useState<string>(PY[lang]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (paused || reduced) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') setIndex((i) => (i + 1) % POSTERS.length);
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [paused, reduced]);

  // Type Temo's line whenever the Python poster comes up.
  useEffect(() => {
    const full = PY[lang];
    if (reduced || index !== 0) { setTyped(full); return; }
    const chars = Array.from(full);
    let i = 0;
    let timer: number;
    const tick = () => {
      setTyped(chars.slice(0, i).join(''));
      if (i < chars.length) { i += 1; timer = window.setTimeout(tick, 55); }
    };
    tick();
    return () => window.clearTimeout(timer);
  }, [index, lang, reduced]);

  const poster = POSTERS[index];
  const group = GROUP_COPY[poster.group];
  const teacher = poster.kind === 'python' ? PYTHON_TEACHER[lang] : group.teacher[lang];
  const done = typed === PY[lang];

  return (
    <div
      className={styles.stage}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.win} role="group" aria-label={lang === 'ka' ? 'CDC-ის კურსები' : 'CDC courses'}>
        <div className={styles.winBar}>
          <i style={{ background: '#ff5f57' }} /><i style={{ background: '#febc2e' }} /><i style={{ background: '#28c840' }} />
          <span className={styles.tab}>{poster.title[lang]}</span>
          <span className={styles.live}><i />LIVE · {poster.studio ?? 'CDC'}</span>
        </div>
        <div className={styles.body} key={poster.id}>
          <Scene kind={poster.kind} lang={lang} typed={poster.kind === 'python' ? typed : undefined} done={done} />
        </div>
        <div className={styles.strip}>
          <span className={`${styles.pill} ${styles[poster.group]}`}>{group.tag[lang]}</span>
          <span className={styles.teacher}>{teacher}</span>
          {!reduced && !paused && <span key={poster.id} className={styles.progress} aria-hidden="true" />}
        </div>
      </div>
      {poster.kind === 'python' && (
        <div className={styles.cam}>
          <Image src="/images/hero/cdc-hero-15-sm.webp" alt="" width={230} height={140} className={styles.camImg} />
          <div><b>{CAM[lang].name}</b><span><i />{CAM[lang].note}</span></div>
        </div>
      )}
      <div className={styles.dots} role="tablist" aria-label={lang === 'ka' ? 'კურსები' : 'Courses'}>
        {POSTERS.map((p, i) => (
          <button key={p.id} type="button" role="tab" aria-selected={i === index} aria-label={p.title[lang]} onClick={() => setIndex(i)} className={i === index ? styles.dotOn : styles.dot} />
        ))}
      </div>
    </div>
  );
}
