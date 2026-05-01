'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const VoiceAssistantScreen = dynamic(
  () => import('@/app/components/voice/VoiceAssistantScreen').then((mod) => ({
    default: mod.VoiceAssistantScreen,
  })),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 items-center justify-center py-24">
        <div className="h-56 w-56 rounded-full bg-slate-800 animate-pulse" />
      </div>
    ),
  },
);

export default function SymptomsVoicePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-[#0d1a3a] to-slate-950">
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-24">
            <div className="h-56 w-56 rounded-full bg-slate-800 animate-pulse" />
          </div>
        }
      >
        <VoiceAssistantScreen />
      </Suspense>
    </main>
  );
}
