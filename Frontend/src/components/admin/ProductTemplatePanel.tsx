// Admin: attach / replace / remove the editable "cdc-template/1" layout of a
// Digital Store product (shown under a product row in pages/admin/products.tsx).
// The server validates the JSON (Backend/src/schemas/designTemplateSchemas.ts)
// and returns the exact problems, which are shown here as-is.
import { useEffect, useState } from 'react';
import { deleteProductTemplate, getProductTemplate, putProductTemplate } from '../../services/designService';

import { at, atf } from '../../i18n/admin';
export default function ProductTemplatePanel({ productId }: { productId: string }) {
  const [current, setCurrent] = useState<{ version: number; pages: number } | null | undefined>(undefined);
  const [text, setText] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getProductTemplate(productId)
      .then((template) => {
        setCurrent(template ? { version: template.version, pages: template.data.pages.length } : null);
        if (template) setText(JSON.stringify(template.data, null, 2));
      })
      .catch(() => setCurrent(null));
  }, [productId]);

  const save = async () => {
    setMessage(null);
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { setMessage({ ok: false, text: at("Not valid JSON.") }); return; }
    setBusy(true);
    try {
      const result = await putProductTemplate(productId, parsed);
      const pages = (parsed as { pages?: unknown[] }).pages?.length ?? 0;
      setCurrent({ version: result.version, pages });
      setMessage({ ok: true, text: `Saved (version ${result.version}). Buyers can now open it in the editor.` });
    } catch (error: unknown) {
      setMessage({ ok: false, text: (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? at('Save failed.') });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(at("Remove the editable template? Existing buyer designs are kept."))) return;
    setBusy(true);
    try { await deleteProductTemplate(productId); setCurrent(null); setText(''); setMessage({ ok: true, text: at("Template removed.") }); }
    finally { setBusy(false); }
  };

  const loadFile = async (file: File) => setText(await file.text());

  return (
    <div className="mt-2 rounded-lg border border-gray-200 p-3 space-y-2">
      <p className="text-xs font-semibold text-gray-700">
        {at("Editable template (design editor):")}{' '}
        {current === undefined ? at("loading…") : current ? atf("attached, v{0}, {1} page(s)", current.version, current.pages) : 'none'}
      </p>
      <input type="file" accept="application/json,.json" className="text-xs"
        onChange={(e) => { const file = e.target.files?.[0]; if (file) void loadFile(file); e.target.value = ''; }} />
      <textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false}
        placeholder={at("{\"format\":\"cdc-template/1\", ...}")}
        className="w-full h-48 rounded border border-gray-300 p-2 font-mono text-[11px]" />
      {message && <p className={`text-xs ${message.ok ? 'text-emerald-700' : 'text-red-600'} break-words`}>{message.text}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={busy || !text.trim()}
          className="text-xs font-medium text-white bg-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-60">
          {current ? at("Replace template") : at("Attach template")}
        </button>
        {current && (
          <button type="button" onClick={remove} disabled={busy}
            className="text-xs font-medium text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-60">
            {at("Remove")}
          </button>
        )}
      </div>
    </div>
  );
}
