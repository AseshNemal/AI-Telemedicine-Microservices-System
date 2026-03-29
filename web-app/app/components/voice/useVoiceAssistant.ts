'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';

export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking';

export interface UseVoiceAssistantResult {
  state: VoiceState;
  amplitude: number;
  isListening: boolean;
  transcript: string;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  lastMessage: string;
}

type SymptomContext = {
  type?: string;
  duration?: string;
  severity?: string;
  painType?: string;
  location?: string;
  redFlags?: boolean;
};

type SymptomChatApiResponse = {
  reply?: string;
  response?: string;
  collectedData?: SymptomContext;
  nextQuestion?: {
    question?: string;
  } | null;
};

const START_THRESHOLD = 0.08;
const SILENCE_THRESHOLD = 0.03;
const SILENCE_MS = 850;
const INTERRUPT_THRESHOLD = 0.18;
const INTERRUPT_HOLD_MS = 350;
const MIN_SPEAK_BEFORE_INTERRUPT_MS = 1200;

function truncateAtSentenceBoundary(message: string, maxChars: number): string {
  if (message.length <= maxChars) return message;

  const slice = message.slice(0, maxChars);
  const lastSentenceEnd = Math.max(
    slice.lastIndexOf('.'),
    slice.lastIndexOf('!'),
    slice.lastIndexOf('?'),
  );

  if (lastSentenceEnd >= Math.floor(maxChars * 0.5)) {
    return slice.slice(0, lastSentenceEnd + 1).trim();
  }

  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace >= Math.floor(maxChars * 0.6)) {
    return `${slice.slice(0, lastSpace).trim()}...`;
  }

  return `${slice.trim()}...`;
}

export function useVoiceAssistant(): UseVoiceAssistantResult {
  const [state, setState] = useState<VoiceState>('idle');
  const [amplitude, setAmplitude] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState('');

  const recognitionRef = useRef<any>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const ttsPulseRef = useRef(0);
  const interruptStartRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isListeningRef = useRef(false);
  const isStoppingRef = useRef(false);
  const lastUiUpdateRef = useRef(0);
  const lastAmplitudeRef = useRef(0);
  const contextRef = useRef<SymptomContext>({});
  const speakingStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Speech Recognition not supported');
      return;
    }

    recognitionRef.current = new SpeechRecognition();
    const recognition = recognitionRef.current;

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setError(null);
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript + ' ';
        } else {
          interim += transcript;
        }
      }

      if (final) {
        setTranscript(final);
        silenceStartRef.current = Date.now();
      }
      if (interim) {
        setTranscript(prev => (final ? final : interim));
      }
    };

    recognition.onerror = (event: any) => {
      setError(`Recognition error: ${event.error}`);
      setState('idle');
      setIsListening(false);
    };

    recognition.onend = () => {
      // Auto-restart listening only when actively running and not stopping.
      if (isStoppingRef.current || !isListeningRef.current) return;

      setTimeout(() => {
        if (isStoppingRef.current || !isListeningRef.current) return;
        try {
          recognition.start();
        } catch {
          // Ignore transient browser "already started" or restart errors.
        }
      }, 180);
    };

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Amplitude monitoring loop
  useEffect(() => {
    if (!isListening || !analyserRef.current) return;

    const monitor = () => {
      if (!analyserRef.current) return;

      const dataArray = dataArrayRef.current!;
      analyserRef.current.getByteFrequencyData(dataArray as any);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length / 255;

      // Add TTS pulse contribution if speaking
      const combinedAmplitude = state === 'speaking'
        ? Math.max(avg, ttsPulseRef.current)
        : avg;

      // Throttle UI updates to reduce re-render pressure on lower-end laptops.
      const now = performance.now();
      const shouldPushUi = now - lastUiUpdateRef.current >= 120; // ~8 FPS for laptop-friendly rendering
      if (shouldPushUi) {
        const smoothed = lastAmplitudeRef.current * 0.65 + combinedAmplitude * 0.35;
        if (Math.abs(smoothed - lastAmplitudeRef.current) >= 0.01 || smoothed < 0.01) {
          setAmplitude(smoothed);
          lastAmplitudeRef.current = smoothed;
        }
        lastUiUpdateRef.current = now;
      }

      // Interrupt detection: if speaking and user speaks
      if (state === 'speaking' && combinedAmplitude > INTERRUPT_THRESHOLD) {
        const canInterrupt =
          speakingStartedAtRef.current !== null &&
          Date.now() - speakingStartedAtRef.current > MIN_SPEAK_BEFORE_INTERRUPT_MS;

        if (canInterrupt) {
          if (!interruptStartRef.current) {
            interruptStartRef.current = Date.now();
          } else if (Date.now() - interruptStartRef.current > INTERRUPT_HOLD_MS) {
            // Cancel TTS only on sustained, strong interrupt signal.
            window.speechSynthesis.cancel();
            setState('listening');
            interruptStartRef.current = null;
          }
        }
      } else {
        interruptStartRef.current = null;
      }

      // Silence detection for silence-based state transitions
      if (state === 'listening' && combinedAmplitude < SILENCE_THRESHOLD) {
        if (!silenceStartRef.current) {
          silenceStartRef.current = Date.now();
        } else if (Date.now() - silenceStartRef.current > SILENCE_MS) {
          if (transcript.trim()) {
            handleSendMessage(transcript);
            setTranscript('');
            setState('processing');
          }
          silenceStartRef.current = null;
        }
      } else if (combinedAmplitude > START_THRESHOLD) {
        silenceStartRef.current = null;
        if (state === 'idle') {
          setState('listening');
        }
      }

      animationFrameRef.current = requestAnimationFrame(monitor);
    };

    animationFrameRef.current = requestAnimationFrame(monitor);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isListening, state, transcript]);

  const handleSendMessage = useCallback(async (msg: string) => {
    if (!msg.trim()) return;

    try {
      setState('processing');
      const response = await fetch('/api/symptoms/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, context: contextRef.current }),
      });

      if (!response.ok) {
        throw new Error('Chat API failed');
      }

      const data: SymptomChatApiResponse = await response.json();

      if (data?.collectedData && typeof data.collectedData === 'object') {
        contextRef.current = {
          ...contextRef.current,
          ...data.collectedData,
        };
      }

      const baseReply =
        (typeof data?.reply === 'string' && data.reply.trim()) ||
        (typeof data?.response === 'string' && data.response.trim()) ||
        'I received your message.';

      const followUpQuestion =
        (typeof data?.nextQuestion?.question === 'string' && data.nextQuestion.question.trim()) ||
        '';

      const normalizedReply = baseReply.trim().toLowerCase();
      const normalizedQuestion = followUpQuestion.trim().toLowerCase();
      const alreadyContainsQuestion =
        normalizedQuestion.length > 0 && normalizedReply.includes(normalizedQuestion);

      const botMessage = followUpQuestion && !alreadyContainsQuestion
        ? `${baseReply} ${followUpQuestion}`
        : baseReply;
      
      // Truncate for voice while preserving sentence boundaries.
      const truncated = truncateAtSentenceBoundary(botMessage, 420);

      setLastMessage(truncated);
      speakMessage(truncated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error sending message');
      setState('idle');
    }
  }, []);

  const speakMessage = useCallback((message: string) => {
    setState('speaking');
    speakingStartedAtRef.current = Date.now();

    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 0.8;

    utterance.onboundary = () => {
      // Update TTS pulse on word boundary for animation
      ttsPulseRef.current = 0.15;
      setTimeout(() => {
        ttsPulseRef.current = 0;
      }, 100);
    };

    utterance.onend = () => {
      setState('listening');
      ttsPulseRef.current = 0;
      speakingStartedAtRef.current = null;
    };

    utterance.onerror = () => {
      setState('idle');
      ttsPulseRef.current = 0;
      speakingStartedAtRef.current = null;
    };

    synthRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, []);

  const startListening = useCallback(async () => {
    try {
      isStoppingRef.current = false;
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      contextRef.current = {};

      // Setup Web Audio API for amplitude monitoring
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      
      source.connect(analyser);
      analyser.fftSize = 256;

      analyserRef.current = analyser;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;

      setIsListening(true);
      setState('idle');
      try {
        recognitionRef.current?.start();
      } catch {
        // Ignore if browser reports recognition already started.
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Microphone access denied');
    }
  }, []);

  const stopListening = useCallback(() => {
    isStoppingRef.current = true;
    setIsListening(false);
    setState('idle');
    recognitionRef.current?.stop();
    window.speechSynthesis.cancel();

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }

    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setTranscript('');
    setAmplitude(0);
    lastAmplitudeRef.current = 0;
    lastUiUpdateRef.current = 0;
    contextRef.current = {};
    speakingStartedAtRef.current = null;
    ttsPulseRef.current = 0;
  }, []);

  return {
    state,
    amplitude,
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
    lastMessage,
  };
}
