'use client';

import dynamic from 'next/dynamic';
import { useVoiceAssistant } from './useVoiceAssistant';

const VoiceOrb = dynamic(() => import('./VoiceOrb').then(mod => ({ default: mod.VoiceOrb })), {
  ssr: false,
  loading: () => <div className="h-64 w-64 rounded-full bg-slate-800 animate-pulse" />,
});

export function VoiceAssistantScreen() {
  const { state, amplitude, isListening, transcript, error, startListening, stopListening, lastMessage } =
    useVoiceAssistant();
  const controlsVisible = true;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4">
      <section className="flex flex-col items-center gap-12">
        {/* Orb */}
        <div className="relative h-64 w-64">
          <VoiceOrb state={state} amplitude={amplitude} />
        </div>

        {/* Status and Messages */}
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            {isListening ? 'Continuous voice loop active' : 'Standby'}
          </p>
          
          {transcript && (
            <p className="mt-3 max-w-md text-sm text-slate-300">
              <span className="font-medium text-blue-400">You:</span> {transcript}
            </p>
          )}

          {lastMessage && (
            <p className="mt-2 max-w-md text-sm text-slate-300">
              <span className="font-medium text-green-400">Assistant:</span> {lastMessage}
            </p>
          )}

          {error && (
            <p className="mt-2 text-sm text-red-400">
              <span className="font-medium">Error:</span> {error}
            </p>
          )}
        </div>

        {/* Controls */}
        {controlsVisible && (
          <div className="flex gap-4">
            <button
              onClick={startListening}
              disabled={isListening}
              className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition-all hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start
            </button>
            <button
              onClick={stopListening}
              disabled={!isListening}
              className="rounded-lg bg-red-600 px-6 py-2 text-sm font-semibold text-white transition-all hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Stop
            </button>
          </div>
        )}

        {/* Info text */}
        <p className="max-w-md text-center text-xs text-slate-500">
          Allow microphone access to begin. Speak naturally—the system listens continuously and responds with guidance.
        </p>
      </section>
    </main>
  );
}
