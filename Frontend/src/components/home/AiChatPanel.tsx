/**
 * Floating AI assistant chat panel (full-screen sheet below the sm breakpoint).
 */
import Image from 'next/image';
import { Rocket, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import Link from 'next/link';
import type { Dispatch, FormEvent, MutableRefObject, SetStateAction } from 'react';
import type { TFunction } from 'i18next';

// Compact overrides so the assistant's Markdown (bold/headers/bullets) fits
// a narrow chat bubble instead of using default prose spacing/sizing.
const chatMarkdownComponents = {
  p: (props: React.ComponentPropsWithoutRef<'p'>) => <p className="mb-1.5 last:mb-0" {...props} />,
  strong: (props: React.ComponentPropsWithoutRef<'strong'>) => <strong className="font-bold" {...props} />,
  ul: (props: React.ComponentPropsWithoutRef<'ul'>) => <ul className="list-disc pl-4 mb-1.5 space-y-0.5" {...props} />,
  ol: (props: React.ComponentPropsWithoutRef<'ol'>) => <ol className="list-decimal pl-4 mb-1.5 space-y-0.5" {...props} />,
  li: (props: React.ComponentPropsWithoutRef<'li'>) => <li {...props} />,
  h1: (props: React.ComponentPropsWithoutRef<'h1'>) => <p className="font-black text-[13px] mb-1 mt-1.5" {...props} />,
  h2: (props: React.ComponentPropsWithoutRef<'h2'>) => <p className="font-black text-[13px] mb-1 mt-1.5" {...props} />,
  h3: (props: React.ComponentPropsWithoutRef<'h3'>) => <p className="font-bold text-xs mb-1 mt-1.5" {...props} />,
  hr: () => <hr className="my-2 border-slate-200 dark:border-slate-700" />,
  a: (props: React.ComponentPropsWithoutRef<'a'>) => <a className="underline text-cyan-600 dark:text-cyan-400" target="_blank" rel="noopener noreferrer" {...props} />,
};

interface AiChatPanelProps {
  isChatOpen: boolean;
  chatPanelRef: MutableRefObject<HTMLDivElement | null>;
  t: TFunction<"home", undefined>;
  setIsChatOpen: Dispatch<SetStateAction<boolean>>;
  chatMessages: { sender: "bot" | "user"; text: string; }[];
  chatSending: boolean;
  chatError: string | null;
  lastFailedInput: string | null;
  sendChatMessage: (rawText: string) => Promise<void>;
  handleSendMessage: (e: React.FormEvent) => void;
  userInput: string;
  setUserInput: Dispatch<SetStateAction<string>>;
}

export default function AiChatPanel({ isChatOpen, chatPanelRef, t, setIsChatOpen, chatMessages, chatSending, chatError, lastFailedInput, sendChatMessage, handleSendMessage, userInput, setUserInput }: AiChatPanelProps) {
  return (
    <>
      {/* 🤖 AI ASSISTANT CHAT PANEL — below `sm` (< 640px) this becomes a true
          full-screen overlay (`inset-0` wrapper, `w-full h-full` borderless
          panel) instead of the floating card, per this component's own
          "don't block/obscure page content with an awkwardly-sized floating
          card on a phone screen" requirement. `isChatOpen` gates the
          mobile-only `inset-0` specifically (not just `sm:inset-auto`
          reverting it) so a CLOSED panel on mobile never leaves an invisible
          full-viewport div sitting over the page catching clicks. */}
      {/* z-[60], not z-50: FloatingButtons (fixed, z-50) mounts in _app.tsx
          AFTER <Component/>, so at equal z-index it paints on top of this
          panel regardless of open state — on mobile that put the floating
          WhatsApp/chat-trigger bubbles visibly over the full-screen overlay,
          covering part of the message input. */}
      <div className={`fixed z-[60] flex flex-col gap-3 items-end ${isChatOpen ? 'inset-0' : 'bottom-56 right-4'} sm:inset-auto sm:bottom-60 sm:right-6 md:right-6`}>
        {/* h-[700px] (sm and up only) is the "spacious" target the panel
            grows to on tall screens, anchored via `sm:bottom-60` — a plain
            `max-h-[85vh]` ignores that offset and still pushes the header
            off the top of the viewport on anything shorter than ~1050px
            tall. sm:max-h subtracts the larger (sm:bottom-60 = 15rem) of the
            two anchor offsets plus a 1rem top margin, so the panel always
            stays fully on-screen instead. Below sm, the panel is simply
            w-full h-full inside the inset-0 wrapper above — full screen,
            nothing to bound. */}
        {isChatOpen && (
          <div ref={chatPanelRef} className="w-full h-full rounded-none border-0 sm:w-[400px] sm:h-[700px] sm:max-w-full sm:max-h-[calc(100vh-16rem)] sm:rounded-2xl sm:border shadow-2xl overflow-hidden flex flex-col bg-white dark:bg-[#0e1422] text-slate-900 dark:text-white border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-[#0e1422] rounded-none sm:rounded-t-2xl">
              <div className="flex items-center gap-2 min-w-0">
                <Image src="/images/cdc-logo.png" alt="CDC" width={28} height={28} className="w-7 h-7 rounded-full object-cover shrink-0" />
                <div className="min-w-0">
                  <span className="block text-sm font-bold text-slate-900 dark:text-white truncate">{t('chatTitle')}</span>
                  <a
                    href="https://www.cdc.org.ge/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-cyan-500 truncate transition-colors"
                  >
                    {t('poweredBy')}
                  </a>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsChatOpen(false)}
                aria-label={t('close')}
                className="shrink-0 p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white transition-colors border-none bg-transparent cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs bg-slate-50 dark:bg-[#0b0f17]">
              {chatMessages.map((msg, i) =>
                // The still-empty streaming placeholder (see sendChatMessage)
                // renders as the typing-dots indicator below instead of an
                // empty bubble of its own — skipping it here avoids showing
                // both at once for the instant before the first chunk lands.
                msg.sender === 'bot' && msg.text === '' ? null : (
                  <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`p-3 rounded-xl max-w-[85%] ${msg.sender === 'user' ? 'bg-cyan-500 text-white' : 'bg-white dark:bg-[#161f30] border border-slate-200 dark:border-slate-800'}`}>
                      {msg.sender === 'bot' ? (
                        <ReactMarkdown components={chatMarkdownComponents}>{msg.text}</ReactMarkdown>
                      ) : (
                        msg.text
                      )}
                    </div>
                  </div>
                )
              )}

              {chatSending && chatMessages[chatMessages.length - 1]?.sender === 'bot' && chatMessages[chatMessages.length - 1]?.text === '' && (
                <div className="flex justify-start">
                  <div className="p-3 rounded-xl bg-white dark:bg-[#161f30] border border-slate-200 dark:border-slate-800 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
                  </div>
                </div>
              )}

              {chatError && (
                <div className="text-center pt-1">
                  <p className="text-[11px] text-red-500 dark:text-red-400">{chatError}</p>
                  {lastFailedInput && (
                    <button
                      type="button"
                      onClick={() => sendChatMessage(lastFailedInput)}
                      className="mt-1.5 text-[11px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline bg-transparent border-none cursor-pointer"
                    >
                      {t('retry')}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* QUICK REPLY: links to the real, auth-gated /career-test page —
                the quiz used to run entirely inline in this chat, but a
                dedicated page is what actually saves results to the user's
                account and lets them revisit recommendations from the
                dashboard (see /career-test and /dashboard/career-quiz). */}
            <div className="flex gap-2 p-2 justify-center bg-slate-50 dark:bg-[#0b0f17]">
              <Link
                href="/career-test"
                className="flex items-center gap-1.5 bg-cyan-500 text-white px-4 py-1.5 rounded-full text-[11px] font-black no-underline hover:bg-cyan-600 transition shadow"
              >
                <Rocket className="w-3.5 h-3.5" />{t('startTest')}
              </Link>
            </div>

            <form onSubmit={handleSendMessage} className="p-3 border-t flex gap-2 bg-white dark:bg-[#0e1422] border-slate-100 dark:border-slate-800">
              <input type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)} disabled={chatSending} placeholder={t('chatInputPlaceholder') as string} className="flex-1 border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#161f30] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-400 disabled:opacity-60" />
              <button type="submit" disabled={chatSending || !userInput.trim()} className="bg-slate-900 text-white font-bold px-4 py-2 rounded-xl text-xs border-none cursor-pointer disabled:opacity-40">OK</button>
            </form>
          </div>
        )}
      </div>
    </>
  );
}
