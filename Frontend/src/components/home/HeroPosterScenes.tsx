/**
 * Illustrative UI inside each hero poster (see heroPosterData.ts). Purely
 * decorative mock-ups built from divs/text — no outcome claims. Text follows
 * the site language (Georgian on `ka`, English elsewhere).
 */
import type { ReactNode } from 'react';
import type { Kind, Lang } from './heroPosterData';
import styles from './HeroPosters.module.css';

const TOKEN = /(\b(?:def|return|print|import|from|const|let|function|export|SELECT|FROM|WHERE|GROUP BY|ORDER BY|JOIN|COUNT|SUM|class|async|await|if|else|for|in)\b|'[^']*'|"[^"]*"|`[^`]*`|\/\/.*|#.*)/;

/** Tiny syntax colouring: keywords, strings, comments. */
export function Code({ lines, typedLast }: { lines: string[]; typedLast?: string }) {
  const render = (text: string): ReactNode[] =>
    text.split(TOKEN).map((part, i) => {
      if (!part) return null;
      if (/^(?:\/\/|#)/.test(part)) return <span key={i} className={styles.cc}>{part}</span>;
      if (/^['"`]/.test(part)) return <span key={i} className={styles.cs}>{part}</span>;
      if (TOKEN.test(part) && /^[A-Za-z ]+$/.test(part)) return <span key={i} className={styles.ck}>{part}</span>;
      return <span key={i}>{part}</span>;
    });
  return (
    <div className={styles.code}>
      {lines.map((l, i) => (
        <div key={i} className={styles.ln}><em>{i + 1}</em><span>{typedLast !== undefined && i === lines.length - 1 ? <>{render(typedLast)}<i className={styles.caret} aria-hidden="true" /></> : render(l)}</span></div>
      ))}
    </div>
  );
}

const T = {
  ka: {
    out: 'შედეგი', ok: '✓ მუშაობს', rows: 'ჩანაწერი', prompt: 'შენ', ai: 'AI', task: 'დავალება', done: 'შესრულებულია',
    palette: 'ფერები', logo: 'ლოგო', frame: 'ეკრანი', login: 'შესვლა', todo: 'გასაკეთებელი', doing: 'მიმდინარე', fin: 'დასრულებული',
    reach: 'ხილვადობა', clicks: 'კლიკები', now: 'ახლა', next: 'შემდეგ', later: 'მოგვიანებით', sent: 'წინადადება გაიგზავნა',
    client: 'კლიენტი', scope: 'სამუშაოს მოცულობა', price: 'შეთავაზება', send: 'გაგზავნა', sprint: 'სპრინტი 1', total: 'ჯამი',
  },
  en: {
    out: 'Output', ok: '✓ works', rows: 'rows', prompt: 'You', ai: 'AI', task: 'Task', done: 'Done',
    palette: 'Palette', logo: 'Logo', frame: 'Screen', login: 'Log in', todo: 'To do', doing: 'In progress', fin: 'Done',
    reach: 'Reach', clicks: 'Clicks', now: 'Now', next: 'Next', later: 'Later', sent: 'Proposal sent',
    client: 'Client', scope: 'Scope', price: 'Offer', send: 'Send', sprint: 'Sprint 1', total: 'Total',
  },
} as const;

function Pane({ children, label }: { children: ReactNode; label?: string }) {
  return <div className={styles.pane}>{label && <div className={styles.paneLabel}>{label}</div>}{children}</div>;
}

export default function Scene({ kind, lang, typed, done }: { kind: Kind; lang: Lang; typed?: string; done?: boolean }) {
  const t = T[lang];
  const ka = lang === 'ka';
  switch (kind) {
    case 'python':
      return <div className={styles.split}>
        <Code lines={['# ' + (ka ? 'თემოს პირველი პროგრამა' : "Temo's first program"), `name = '${ka ? 'თემო' : 'Temo'}'`, '', 'def greet(who):', '']} typedLast={typed} />
        <Pane label={t.out}><div className={styles.term}>{'>>> greet(name)'}<br />{done ? <b>{ka ? 'გამარჯობა, თემო!' : 'Hello, Temo!'}</b> : null}</div></Pane>
      </div>;
    case 'sql':
      return <div className={styles.split}>
        <Code lines={['SELECT city, COUNT(*) AS n', 'FROM students', "WHERE course = 'SQL'", 'GROUP BY city', 'ORDER BY n DESC;']} />
        <Pane label={`${t.out} · 4 ${t.rows}`}>
          <table className={styles.tbl}><tbody>{[[ka ? 'ოზურგეთი' : 'Ozurgeti', 12], [ka ? 'თბილისი' : 'Tbilisi', 9], [ka ? 'ბათუმი' : 'Batumi', 6], [ka ? 'ქუთაისი' : 'Kutaisi', 4]].map(([c, n]) => <tr key={String(c)}><td>{c}</td><td><i style={{ width: `${Number(n) * 6}px` }} />{n}</td></tr>)}</tbody></table>
        </Pane>
      </div>;
    case 'chat':
      return <div className={styles.chat}>
        <div className={styles.bubbleU}><b>{t.prompt}</b>{ka ? 'დაწერე 3 სათაური ჩვენი კურსისთვის და გააგზავნე ელფოსტით.' : 'Write 3 headlines for our course and email them to the team.'}</div>
        <div className={styles.bubbleA}><b>{t.ai}</b>{ka ? '1. ისწავლე უნარი, რომელიც სამუშაოს გაძლევს\n2. პრაქტიკა პირველივე დღიდან\n3. შენი AI მენტორი 24/7' : '1. Learn a skill that gets you hired\n2. Hands-on from day one\n3. Your AI mentor, 24/7'}</div>
        <div className={styles.chip}>{ka ? 'ავტომატიზაცია: გაგზავნა ელფოსტით ✓' : 'Automation: email sent ✓'}</div>
      </div>;
    case 'html':
      return <div className={styles.split}>
        <Code lines={['<button class="cta">', `  ${ka ? 'დააჭირე' : 'Click me'}`, '</button>', '', '.cta { border-radius: 12px; }', 'button.onclick = () => hi();']} />
        <Pane label="Preview"><div className={styles.pv}><h4>{ka ? 'გამარჯობა!' : 'Hello!'}</h4><button type="button" tabIndex={-1}>{ka ? 'დააჭირე' : 'Click me'}</button></div></Pane>
      </div>;
    case 'sheet':
      return <div className={styles.split}>
        <Pane label="Excel"><table className={styles.tbl}><tbody>
          <tr className={styles.head}><td>{ka ? 'თვე' : 'Month'}</td><td>{ka ? 'გაყიდვები' : 'Sales'}</td></tr>
          {[[ka ? 'იან' : 'Jan', 120], [ka ? 'თებ' : 'Feb', 150], [ka ? 'მარ' : 'Mar', 190], [ka ? 'აპრ' : 'Apr', 230]].map(([m, v]) => <tr key={String(m)}><td>{m}</td><td>{v}</td></tr>)}
          <tr className={styles.sum}><td>{t.total}</td><td>=SUM(B2:B5)</td></tr></tbody></table></Pane>
        <Pane label={ka ? 'დიაგრამა' : 'Chart'}><div className={styles.bars}>{[40, 58, 76, 100].map((h, i) => <span key={i} style={{ height: `${h}%` }} />)}</div></Pane>
      </div>;
    case 'brand':
      return <div className={styles.split}>
        <Pane label={t.logo}><div className={styles.logoBox}><span className={styles.ring} /><span className={styles.logoDot} /><b>CDC</b></div></Pane>
        <Pane label={t.palette}><div className={styles.sw}>{['#7C3AED', '#C026D3', '#22D3EE', '#0C0A1D', '#F4F1FF'].map((c) => <i key={c} style={{ background: c }} />)}</div><div className={styles.type}>Aa <small>Branding & Visual</small></div></Pane>
      </div>;
    case 'uiux':
      return <div className={styles.split}>
        <Pane label={t.frame + ' 1'}><div className={styles.phone}><i /><i className={styles.short} /><span>{t.login}</span></div></Pane>
        <Pane label={t.frame + ' 2'}><div className={styles.phone}><div className={styles.avatar} /><i /><i className={styles.short} /><span className={styles.alt}>→</span></div></Pane>
        <svg className={styles.flow} viewBox="0 0 60 20" aria-hidden="true"><path d="M2 10 H52 M46 5 L54 10 L46 15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="3 3" /></svg>
      </div>;
    case 'react':
      return <div className={styles.split}>
        <Code lines={['export function Card() {', '  const [n, setN] = useState(0)', '  return <b onClick={inc}>{n}</b>', '}', '', "app.get('/api/courses', list)"]} />
        <Pane label="API"><div className={styles.term}>{'GET /api/courses'}<br /><b>200 OK</b><br />{'[{ "title": "…" }]'}</div></Pane>
      </div>;
    case 'ads':
      return <div className={styles.split}>
        <Pane label={t.reach}><div className={styles.bars}>{[30, 46, 62, 55, 84, 100].map((h, i) => <span key={i} style={{ height: `${h}%` }} />)}</div></Pane>
        <Pane label="Ad"><div className={styles.ad}><i /><b>{ka ? 'ისწავლე ციფრული პროფესია' : 'Learn a digital profession'}</b><span>{ka ? 'დაიწყე უფასოდ' : 'Start for free'}</span></div></Pane>
      </div>;
    case 'board':
      return <div className={styles.board}>{[[t.todo, ['UI', 'API']], [t.doing, ['Auth']], [t.fin, ['DB', 'CI']]].map(([title, cards]) => <div key={String(title)}><h5>{title}</h5>{(cards as string[]).map((c) => <span key={c}>{c}</span>)}</div>)}<small>{t.sprint}</small></div>;
    case 'product':
      return <div className={styles.roadmap}>{[[t.now, ka ? 'რეგისტრაცია' : 'Sign-up', 90], [t.next, ka ? 'პროფილი' : 'Profile', 55], [t.later, ka ? 'შეტყობინებები' : 'Notifications', 25]].map(([h, label, w]) => <div key={String(h)}><b>{h}</b><span>{label}</span><i style={{ width: `${w}%` }} /></div>)}</div>;
    case 'freelance':
      return <div className={styles.split}>
        <Pane label={t.client}><div className={styles.prop}><b>{ka ? 'ლოგოს და საიტის დიზაინი' : 'Logo and website design'}</b><span>{t.scope}: 2 {ka ? 'ვერსია' : 'concepts'}</span><span>{t.price}: ✓</span></div></Pane>
        <Pane label={t.send}><div className={styles.sent}><b>✓</b>{t.sent}</div></Pane>
      </div>;
  }
}
