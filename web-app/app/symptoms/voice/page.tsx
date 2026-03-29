'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Suspense } from 'react';

const VoiceAssistantScreen = dynamic(
  () => import('@/app/components/voice/VoiceAssistantScreen').then((mod) => ({
    default: mod.VoiceAssistantScreen,
  })),
  {
    ssr: false,
    loading: () => (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        <div className="h-64 w-64 rounded-full bg-slate-800 animate-pulse" />
      </main>
    ),
  },
);

export default function SymptomsVoicePage() {
  return (
    <main className="bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <div className="mx-auto flex w-full max-w-6xl justify-end px-4 pt-4">
        <Link
          href="/symptoms"
          className="rounded-lg border border-slate-600 bg-slate-800/80 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-700"
        >
          Back to Chat Mode
        </Link>
      </div>

      <Suspense
        fallback={
          <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
            <div className="h-64 w-64 rounded-full bg-slate-800 animate-pulse" />
          </main>
        }
      >
        <VoiceAssistantScreen />
      </Suspense>
    </main>
  );
}
