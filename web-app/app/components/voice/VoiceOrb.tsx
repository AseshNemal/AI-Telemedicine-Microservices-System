'use client';

import { motion } from 'framer-motion';
import { VoiceState } from './useVoiceAssistant';

interface VoiceOrbProps {
  state: VoiceState;
  amplitude: number;
}

export function VoiceOrb({ state, amplitude }: VoiceOrbProps) {
  const getOrbScale = () => {
    switch (state) {
      case 'idle':
        return 1;
      case 'listening':
        return 1 + amplitude * 0.18;
      case 'processing':
        return 1.04;
      case 'speaking':
        return 1 + amplitude * 0.24;
      default:
        return 1;
    }
  };

  const getGlowOpacity = () => {
    switch (state) {
      case 'idle':
        return 0.35;
      case 'listening':
        return 0.7 + amplitude * 0.25;
      case 'processing':
        return 0.55;
      case 'speaking':
        return 0.7 + amplitude * 0.25;
      default:
        return 0.35;
    }
  };

  const getOrbColor = () => {
    switch (state) {
      case 'listening':
        return 'rgb(59, 130, 246)'; // blue-500
      case 'processing':
        return 'rgb(168, 85, 247)'; // purple-500
      case 'speaking':
        return 'rgb(34, 197, 94)'; // green-500
      default:
        return 'rgb(100, 116, 139)'; // slate-500
    }
  };

  const stateLabel = {
    idle: 'Idle',
    listening: 'Listening',
    processing: 'Processing',
    speaking: 'Speaking',
  }[state];

  return (
    <motion.div
      className="flex flex-col items-center gap-6"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Outer glow layer */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          width: 240,
          height: 240,
          background: getOrbColor(),
          filter: 'blur(30px)',
        }}
        animate={{
          opacity: getGlowOpacity(),
          scale: getOrbScale() * 1.2,
        }}
        transition={{ duration: 0.2 }}
      />

      {/* Inner orb */}
      <motion.div
        className="relative z-10 rounded-full shadow-2xl"
        style={{
          width: 200,
          height: 200,
          background: `radial-gradient(circle at 30% 30%, ${getOrbColor()}, ${getOrbColor()}dd)`,
          boxShadow: `0 0 40px ${getOrbColor()}`,
        }}
        animate={{
          scale: getOrbScale(),
          rotate: state === 'processing' ? 360 : 0,
        }}
        transition={
          state === 'processing'
            ? {
                rotate: { duration: 10, repeat: Infinity, ease: 'linear' },
                scale: { duration: 1.6, repeat: Infinity, repeatType: 'reverse' }
              }
            : { duration: 0.2 }
        }
      />

      {/* State label */}
      <motion.p
        className="mt-6 text-sm font-medium text-slate-400"
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {stateLabel}
      </motion.p>
    </motion.div>
  );
}
