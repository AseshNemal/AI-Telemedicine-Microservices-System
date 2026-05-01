'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { useVoiceAssistant } from './useVoiceAssistant';

const VoiceOrb = dynamic(
  () => import('./VoiceOrb').then(mod => ({ default: mod.VoiceOrb })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center" style={{ width: 300, height: 300 }}>
        <div className="h-48 w-48 rounded-full bg-slate-800 animate-pulse" />
      </div>
    ),
  },
);

export function VoiceAssistantScreen() {
  const {
    state, amplitude, isListening, transcript, error,
    startListening, stopListening,
    options, isComplete, fullSummary, history, sendOption,
  } = useVoiceAssistant();

  const historyEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  return (
    <div className="flex flex-col items-center">

      {/* ══ STICKY COMMAND CENTER ═══════════════════════════════════════════
          Orb + transcript + controls always visible below the nav bar.
          bg-gradient fades to transparent so content beneath shows through. */}
      <div
        className="sticky z-20 flex w-full flex-col items-center px-4 pb-5"
        style={{
          top: 64, /* height of the AppShell nav */
          background: 'linear-gradient(to bottom, #020817 82%, transparent)',
        }}
      >
        {/* Back link — always visible inside sticky block */}
        <div className="flex w-full max-w-lg pt-4 pb-1">
          <Link
            href="/symptoms"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-slate-400 transition hover:bg-slate-800/60 hover:text-slate-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
            </svg>
            Chat Mode
          </Link>
        </div>

        {/* Orb — 300 × 300 container; haze overflows visually via overflow-visible */}
        <div
          className="relative flex items-center justify-center overflow-visible"
          style={{ width: 300, height: 300 }}
        >
          <VoiceOrb state={state} amplitude={amplitude} />
        </div>

        {/* Live transcript */}
        <div className="h-6 w-full max-w-sm text-center">
          {transcript && (
            <p className="text-sm italic text-blue-300/80">
              &ldquo;{transcript}&rdquo;
            </p>
          )}
        </div>

        {/* Controls */}
        <div className="relative z-10 mt-4 flex gap-3">
          {!isListening ? (
            <button
              onClick={startListening}
              className="flex items-center gap-2.5 rounded-2xl bg-blue-600 px-9 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-900/50 transition hover:bg-blue-500 active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 opacity-90">
                <path d="M7 4a3 3 0 0 1 6 0v6a3 3 0 1 1-6 0V4Z" />
                <path d="M5.5 9.643a.75.75 0 0 0-1.5 0V10c0 3.06 2.29 5.585 5.25 5.954V17.5h-1.5a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-1.5v-1.546A6.001 6.001 0 0 0 16 10v-.357a.75.75 0 0 0-1.5 0V10a4.5 4.5 0 0 1-9 0v-.357Z" />
              </svg>
              Start Assessment
            </button>
          ) : (
            <>
              <button
                onClick={stopListening}
                className="flex items-center gap-2 rounded-2xl bg-red-600/90 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-red-900/40 transition hover:bg-red-500 active:scale-95"
              >
                <span className="h-3 w-3 rounded-sm bg-white/90" />
                Stop
              </button>
              <button
                onClick={startListening}
                className="flex items-center gap-2 rounded-2xl border border-slate-600/60 bg-slate-700/50 px-6 py-3.5 text-sm font-semibold text-slate-200 backdrop-blur-sm transition hover:bg-slate-600/60 active:scale-95"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 opacity-80">
                  <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0V5.36l-.31-.31A7 7 0 0 0 3.239 8.188a.75.75 0 1 0 1.448.389A5.5 5.5 0 0 1 13.89 6.11l.311.31h-2.432a.75.75 0 0 0 0 1.5h4.243a.75.75 0 0 0 .53-.219Z" clipRule="evenodd" />
                </svg>
                Start Over
              </button>
            </>
          )}
        </div>
      </div>

      {/* ══ SCROLLABLE CONTENT ══════════════════════════════════════════════
          Everything below the controls scrolls naturally with the page.   */}
      <div className="flex w-full flex-col items-center gap-4 px-4 pb-20">

        {/* First-time hint */}
        {!isListening && history.length === 0 && (
          <p className="max-w-xs text-center text-xs text-slate-500">
            Allow microphone access, then speak naturally or tap an option button.
          </p>
        )}

        {/* Error */}
        {error && (
          <div className="flex max-w-sm items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 shrink-0">
              <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        {/* Option chips */}
        {options.length > 0 && !isComplete && (
          <div className="flex w-full max-w-md flex-wrap justify-center gap-2">
            {options.map(opt => (
              <button
                key={opt}
                onClick={() => sendOption(opt)}
                className="rounded-full border border-blue-500/40 bg-blue-950/60 px-5 py-2 text-sm font-medium text-blue-200 backdrop-blur-sm transition hover:border-blue-400/70 hover:bg-blue-900/70 hover:text-white active:scale-95"
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {/* Conversation history — no inner scroll, page scrolls naturally */}
        {history.length > 0 && (
          <div className="w-full max-w-md">
            <div className="flex flex-col gap-3">
              {history.map((entry, i) => (
                <div
                  key={i}
                  className={`flex items-end gap-2 ${entry.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {entry.role === 'assistant' && (
                    <div className="mb-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600/30 text-[9px] font-bold text-blue-300">
                      AI
                    </div>
                  )}
                  <div
                    className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      entry.role === 'user'
                        ? 'rounded-br-sm bg-blue-600 text-white'
                        : 'rounded-bl-sm bg-slate-700/80 text-slate-100'
                    }`}
                  >
                    {entry.text}
                  </div>
                </div>
              ))}
              <div ref={historyEndRef} />
            </div>
          </div>
        )}

        {/* Full assessment summary */}
        {isComplete && fullSummary && (
          <div className="w-full max-w-md">
            <div className="overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-b from-blue-950/60 to-slate-800/60 backdrop-blur-sm">
              <div className="border-b border-blue-500/10 px-5 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-400" />
                  <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
                    Assessment Complete
                  </p>
                </div>
              </div>
              <div className="px-5 py-4">
                <p className="whitespace-pre-line text-sm leading-7 text-slate-200">
                  {fullSummary}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
