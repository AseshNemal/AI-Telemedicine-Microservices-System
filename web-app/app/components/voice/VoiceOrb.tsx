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

  const getStatePalette = () => {
    switch (state) {
      case 'listening':
        return {
          edge: '95 108 255',
          coreA: '221 238 255',
          coreB: '242 185 224',
          haze: '230 195 255',
        };
      case 'processing':
        return {
          edge: '146 102 255',
          coreA: '229 225 255',
          coreB: '227 178 246',
          haze: '217 187 255',
        };
      case 'speaking':
        return {
          edge: '88 166 255',
          coreA: '224 246 255',
          coreB: '198 224 255',
          haze: '197 231 255',
        };
      default:
        return {
          edge: '128 139 235',
          coreA: '229 240 255',
          coreB: '243 211 234',
          haze: '230 208 247',
        };
    }
  };

  const palette = getStatePalette();
  const glowScale = state === 'idle' ? 1.02 : 1.08 + amplitude * 0.1;

  const stateLabel = {
    idle: 'Idle',
    listening: 'Listening',
    processing: 'Processing',
    speaking: 'Speaking',
  }[state];

  return (
    <motion.div
      className="relative flex flex-col items-center gap-6"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Soft haze */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 320,
          height: 320,
          background: `radial-gradient(circle, rgb(${palette.haze} / 0.35) 0%, rgb(${palette.haze} / 0.12) 46%, rgb(${palette.haze} / 0) 74%)`,
        }}
        animate={{
          opacity: getGlowOpacity(),
          scale: glowScale,
        }}
        transition={{ duration: 0.25 }}
      />

      {/* Organic ring layer 1 */}
      <motion.div
        className="absolute z-10"
        style={{
          width: 258,
          height: 258,
          border: `2px solid rgb(${palette.edge} / 0.5)`,
          borderRadius: '48% 52% 55% 45% / 44% 46% 54% 56%',
          boxShadow: `0 0 24px rgb(${palette.edge} / 0.26)`,
        }}
        animate={{
          scale: 1 + amplitude * 0.08,
          opacity: getGlowOpacity(),
          rotate: [0, 12, -8, 6, 0],
          borderRadius: [
            '48% 52% 55% 45% / 44% 46% 54% 56%',
            '54% 46% 49% 51% / 58% 44% 56% 42%',
            '46% 54% 52% 48% / 43% 57% 46% 54%',
            '48% 52% 55% 45% / 44% 46% 54% 56%',
          ],
        }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Organic ring layer 2 */}
      <motion.div
        className="absolute z-0"
        style={{
          width: 276,
          height: 276,
          border: `1.5px solid rgb(${palette.edge} / 0.24)`,
          borderRadius: '56% 44% 47% 53% / 41% 55% 45% 59%',
        }}
        animate={{
          scale: 1 + amplitude * 0.06,
          opacity: 0.45 + getGlowOpacity() * 0.35,
          rotate: [0, -10, 8, -6, 0],
          borderRadius: [
            '56% 44% 47% 53% / 41% 55% 45% 59%',
            '49% 51% 54% 46% / 53% 43% 57% 47%',
            '58% 42% 45% 55% / 46% 56% 44% 54%',
            '56% 44% 47% 53% / 41% 55% 45% 59%',
          ],
        }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Core orb */}
      <motion.div
        className="relative z-20 rounded-full"
        style={{
          width: 220,
          height: 220,
          background: `linear-gradient(145deg, rgb(${palette.coreA} / 0.95), rgb(${palette.coreB} / 0.92))`,
          boxShadow: `inset -10px -14px 28px rgb(${palette.edge} / 0.14), inset 8px 10px 18px rgb(255 255 255 / 0.48)`,
        }}
        animate={{
          scale: getOrbScale(),
          opacity: 0.92 + getGlowOpacity() * 0.1,
        }}
        transition={{ duration: 0.25 }}
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'radial-gradient(circle at 67% 34%, rgb(244 167 212 / 0.58) 0%, rgb(244 167 212 / 0.08) 38%, transparent 64%)',
          }}
        />
      </motion.div>

      <motion.p
        className="mt-6 text-sm font-medium text-slate-500"
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {stateLabel}
      </motion.p>
    </motion.div>
  );
}
