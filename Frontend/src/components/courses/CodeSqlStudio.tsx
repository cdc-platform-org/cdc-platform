/**
 * @fileoverview 2-in-1 Frontend Code Sandbox (HTML/CSS/JS) & SQL Query Lab Studio.
 * Allows students to write and run frontend web code with live preview or execute
 * SQL queries against educational relational tables, and submit their work directly
 * to the active lesson assignment.
 */

import { useMemo, useRef, useState } from 'react';
import { Code2, Database, Play, RotateCcw, Upload } from 'lucide-react';
import { SqlSandboxSession, SqlExecutionResult } from '../../utils/sqlSimulatorEngine';

interface CodeSqlStudioProps {
  lang?: string;
  onSubmitWork?: (file: File) => Promise<void>;
}

const DEFAULT_HTML = `<div class="card">
  <span class="badge">CDC DEV LAB</span>
  <h2>Interactive Student Card</h2>
  <p id="status">Ready to build and test live code.</p>
  <button id="btn">Run Action</button>
</div>`;

const DEFAULT_CSS = `body {
  margin: 0;
  font-family: system-ui, sans-serif;
  background: #090d16;
  color: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
}
.card {
  background: #111827;
  border: 1px solid #1e293b;
  border-radius: 16px;
  padding: 24px;
  max-width: 340px;
  box-shadow: 0 20px 50px rgba(0,0,0,0.45);
}
.badge {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.14em;
  color: #38bdf8;
}
button {
  margin-top: 12px;
  background: #0284c7;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 8px 14px;
  font-weight: 700;
  cursor: pointer;
}`;

const DEFAULT_JS = `document.getElementById('btn')?.addEventListener('click', () => {
  const el = document.getElementById('status');
  if (el) el.textContent = '✓ JavaScript event executed successfully!';
});`;

const DEFAULT_SQL = `SELECT id, name, track, score, city
FROM students
WHERE score >= 90
ORDER BY score DESC;`;

export default function CodeSqlStudio({ lang = 'ka', onSubmitWork }: CodeSqlStudioProps) {
  const isKa = lang === 'ka';
  const [mode, setMode] = useState<'frontend' | 'sql'>('frontend');

  // Frontend Sandbox state
  const [htmlCode, setHtmlCode] = useState(DEFAULT_HTML);
  const [cssCode, setCssCode] = useState(DEFAULT_CSS);
  const [jsCode, setJsCode] = useState(DEFAULT_JS);

  // SQL Lab state
  const sqlSessionRef = useRef<SqlSandboxSession>(new SqlSandboxSession());
  const [sqlQuery, setSqlQuery] = useState(DEFAULT_SQL);
  const [sqlResult, setSqlResult] = useState<SqlExecutionResult>(() =>
    sqlSessionRef.current.execute(DEFAULT_SQL)
  );

  const [submitting, setSubmitting] = useState(false);
  const [submittedOk, setSubmittedOk] = useState(false);

  const compiledSrcDoc = useMemo(
    () => `<!doctype html><html><head><style>${cssCode}</style></head><body>${htmlCode}<script>${jsCode}<\/script></body></html>`,
    [htmlCode, cssCode, jsCode]
  );

  const runSql = () => {
    setSqlResult(sqlSessionRef.current.execute(sqlQuery));
  };

  const resetSql = () => {
    sqlSessionRef.current.reset();
    setSqlQuery(DEFAULT_SQL);
    setSqlResult(sqlSessionRef.current.execute(DEFAULT_SQL));
  };

  const handleSubmitDeliverable = async () => {
    if (!onSubmitWork) return;
    setSubmitting(true);
    setSubmittedOk(false);
    try {
      const content =
        mode === 'frontend'
          ? compiledSrcDoc
          : `-- SQL Assignment Deliverable\n${sqlQuery}\n\n-- Result: ${sqlResult.message}\n${JSON.stringify(sqlResult.rows, null, 2)}`;
      const fileName = mode === 'frontend' ? `frontend-lab-${Date.now()}.html` : `sql-lab-${Date.now()}.sql`;
      const mime = mode === 'frontend' ? 'text/html' : 'text/plain';
      const file = new File([content], fileName, { type: mime });
      await onSubmitWork(file);
      setSubmittedOk(true);
      setTimeout(() => setSubmittedOk(false), 4000);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0d1117] text-slate-100 overflow-hidden shadow-2xl">
      {/* Top Studio Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#161b22] border-b border-slate-800 px-4 py-2.5 text-xs">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMode('frontend')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold cursor-pointer border-none ${
              mode === 'frontend' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            Frontend Sandbox (HTML/CSS/JS)
          </button>
          <button
            type="button"
            onClick={() => setMode('sql')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold cursor-pointer border-none ${
              mode === 'sql' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            SQL Database Lab
          </button>
        </div>

        {onSubmitWork && (
          <button
            type="button"
            onClick={handleSubmitDeliverable}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-3.5 py-1.5 font-bold text-white cursor-pointer border-none"
          >
            <Upload className="w-3.5 h-3.5" />
            {submitting
              ? isKa
                ? 'იგზავნება...'
                : 'Submitting...'
              : submittedOk
                ? isKa
                  ? '✓ ჩაბარებულია'
                  : '✓ Submitted'
                : isKa
                  ? 'დავალებად გაგზავნა'
                  : 'Submit to Lesson'}
          </button>
        )}
      </div>

      {mode === 'frontend' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[460px]">
          <div className="lg:col-span-6 border-r border-slate-800 p-3 space-y-2.5 bg-[#0d1117]">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-cyan-400 mb-1">HTML</label>
              <textarea
                value={htmlCode}
                onChange={(e) => setHtmlCode(e.target.value)}
                rows={5}
                className="w-full rounded-lg bg-slate-950 border border-slate-800 p-2 font-mono text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-purple-400 mb-1">CSS</label>
              <textarea
                value={cssCode}
                onChange={(e) => setCssCode(e.target.value)}
                rows={5}
                className="w-full rounded-lg bg-slate-950 border border-slate-800 p-2 font-mono text-xs text-slate-200 focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-1">JavaScript</label>
              <textarea
                value={jsCode}
                onChange={(e) => setJsCode(e.target.value)}
                rows={4}
                className="w-full rounded-lg bg-slate-950 border border-slate-800 p-2 font-mono text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="lg:col-span-6 flex flex-col bg-slate-950">
            <div className="px-3 py-1.5 border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {isKa ? 'ცოცხალი შედეგი (Live Preview)' : 'Live Browser Preview'}
            </div>
            <iframe
              title="Frontend Live Preview"
              sandbox="allow-scripts"
              srcDoc={compiledSrcDoc}
              className="w-full flex-1 min-h-[420px] border-none bg-[#090d16]"
            />
          </div>
        </div>
      ) : (
        <div className="p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap gap-2">
              {sqlSessionRef.current.getSchemaSummary().map((s) => (
                <span key={s.table} className="rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1 font-mono text-[11px] text-slate-300">
                  <b className="text-purple-400">{s.table}</b> ({s.columns.join(', ')})
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={runSql}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 font-bold text-white cursor-pointer border-none"
              >
                <Play className="w-3.5 h-3.5" /> {isKa ? 'გაშვება (Run SQL)' : 'Run Query'}
              </button>
              <button
                type="button"
                onClick={resetSql}
                className="inline-flex items-center gap-1 rounded-lg bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 font-semibold text-slate-300 cursor-pointer border-none"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset DB
              </button>
            </div>
          </div>

          <textarea
            value={sqlQuery}
            onChange={(e) => setSqlQuery(e.target.value)}
            rows={5}
            className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 font-mono text-xs text-cyan-200 focus:outline-none focus:border-purple-500"
          />

          {sqlResult.error ? (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300 font-mono">
              {sqlResult.error}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-emerald-400 font-semibold">{sqlResult.message}</p>
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-900 text-slate-300">
                    <tr>
                      {sqlResult.columns.map((col) => (
                        <th key={col} className="px-3 py-2 border-b border-slate-800 font-mono">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sqlResult.rows.map((row, idx) => (
                      <tr key={idx} className="border-b border-slate-800/60 hover:bg-slate-900/50">
                        {sqlResult.columns.map((col) => (
                          <td key={col} className="px-3 py-2 font-mono text-slate-200">{String(row[col] ?? '')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}