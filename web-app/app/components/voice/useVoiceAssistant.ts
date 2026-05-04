'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking';

export type ConversationEntry = {
  role: 'user' | 'assistant';
  text: string;
};

export interface UseVoiceAssistantResult {
  state: VoiceState;
  amplitude: number;
  isListening: boolean;
  transcript: string;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  lastMessage: string;
  options: string[];
  isComplete: boolean;
  fullSummary: string;
  history: ConversationEntry[];
  sendOption: (option: string) => void;
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
    options?: string[];
  } | null;
};

const START_THRESHOLD = 0.08;
const SILENCE_THRESHOLD = 0.03;
const SILENCE_MS = 500;
const INTERRUPT_THRESHOLD = 0.18;
const INTERRUPT_HOLD_MS = 280;
const MIN_SPEAK_BEFORE_INTERRUPT_MS = 900;
const POST_SPEAK_COOLDOWN_MS = 600;

type SpeechRecognitionAlternativeLike = { transcript: string };
type SpeechRecognitionResultLike = {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
};
type SpeechRecognitionResultListLike = {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
};
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
};
type SpeechRecognitionErrorEventLike = { error: string };
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type WindowWithSpeechAPIs = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
  webkitAudioContext?: typeof AudioContext;
};

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

// Strip emoji and markdown symbols so TTS reads cleanly
function stripForVoice(text: string): string {
  return text
    .replace(/[\u{1F300}-\u{1FFFF}]/gu, '')
    .replace(/[🩺✅⚠️🚑🟢🟠🔴•]/gu, '')
    .replace(/#+\s/g, '')
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .trim();
}

export function useVoiceAssistant(): UseVoiceAssistantResult {
  const [state, setState] = useState<VoiceState>('idle');
  const [amplitude, setAmplitude] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [fullSummary, setFullSummary] = useState('');
  const [history, setHistory] = useState<ConversationEntry[]>([]);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const silenceStartRef = useRef<number | null>(null);
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
  const lastFinalResultRef = useRef<number | null>(null);
  const stateRef = useRef<VoiceState>('idle');
  const isSendingRef = useRef(false);
  const postSpeakCooldownRef = useRef<number | null>(null);

  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);
  useEffect(() => { stateRef.current = state; }, [state]);

  // ── Speech Recognition setup ────────────────────────────────────────────────
  useEffect(() => {
    const speechWindow = window as WindowWithSpeechAPIs;
    const SpeechRecognitionCtor =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setError('Speech recognition not supported in this browser. Try Chrome.');
      return;
    }

    recognitionRef.current = new SpeechRecognitionCtor();
    const recognition = recognitionRef.current;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => { setError(null); };

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      // Block echo from TTS playback
      if (stateRef.current === 'speaking') return;
      // Block buffered echo that arrives right after TTS ends
      if (
        postSpeakCooldownRef.current !== null &&
        Date.now() - postSpeakCooldownRef.current < POST_SPEAK_COOLDOWN_MS
      ) return;

      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const t = result?.[0]?.transcript ?? '';
        if (result?.isFinal) {
          final += `${t} `;
        } else {
          interim += t;
        }
      }
      if (final) {
        setTranscript(final);
        silenceStartRef.current = Date.now();
        lastFinalResultRef.current = Date.now();
      }
      if (interim) {
        setTranscript(final || interim);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      if (event.error === 'no-speech') return; // ignore quiet moments
      setError(`Recognition error: ${event.error}`);
      setState('idle');
      setIsListening(false);
    };

    recognition.onend = () => {
      if (isStoppingRef.current || !isListeningRef.current) return;
      setTimeout(() => {
        if (isStoppingRef.current || !isListeningRef.current) return;
        try { recognition.start(); } catch { /* already running */ }
      }, 180);
    };

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  // ── TTS ─────────────────────────────────────────────────────────────────────
  const speakMessage = useCallback((message: string) => {
    stateRef.current = 'speaking';
    setState('speaking');
    speakingStartedAtRef.current = Date.now();
    setTranscript('');
    silenceStartRef.current = null;
    lastFinalResultRef.current = null;
    isSendingRef.current = false;

    const clean = stripForVoice(message);
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1.15;
    utterance.pitch = 1;
    utterance.volume = 0.9;

    utterance.onboundary = () => {
      ttsPulseRef.current = 0.15;
      setTimeout(() => { ttsPulseRef.current = 0; }, 100);
    };

    utterance.onend = () => {
      postSpeakCooldownRef.current = Date.now();
      setTranscript('');
      silenceStartRef.current = null;
      lastFinalResultRef.current = null;
      isSendingRef.current = false;
      stateRef.current = 'listening';
      setState('listening');
      ttsPulseRef.current = 0;
      speakingStartedAtRef.current = null;
    };

    utterance.onerror = () => {
      postSpeakCooldownRef.current = Date.now();
      setTranscript('');
      silenceStartRef.current = null;
      lastFinalResultRef.current = null;
      isSendingRef.current = false;
      stateRef.current = 'idle';
      setState('idle');
      ttsPulseRef.current = 0;
      speakingStartedAtRef.current = null;
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  // ── Send message to API ─────────────────────────────────────────────────────
  const handleSendMessage = useCallback(async (msg: string, isUserVisible = true) => {
    if (!msg.trim()) return;
    if (isSendingRef.current) return;
    isSendingRef.current = true;

    // Add user message to conversation history
    if (isUserVisible) {
      setHistory(prev => [...prev, { role: 'user', text: msg.trim() }]);
    }

    try {
      setState('processing');
      const response = await fetch('/api/symptoms/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, context: contextRef.current }),
      });

      if (!response.ok) throw new Error('Chat API failed');

      const data: SymptomChatApiResponse = await response.json();

      if (data?.collectedData && typeof data.collectedData === 'object') {
        contextRef.current = { ...contextRef.current, ...data.collectedData };
      }

      const baseReply =
        (typeof data?.reply === 'string' && data.reply.trim()) ||
        (typeof data?.response === 'string' && data.response.trim()) ||
        'I received your message.';

      const followUpQuestion =
        (typeof data?.nextQuestion?.question === 'string' && data.nextQuestion.question.trim()) || '';

      const normalizedReply = baseReply.trim().toLowerCase();
      const normalizedQuestion = followUpQuestion.trim().toLowerCase();
      const alreadyContains =
        normalizedQuestion.length > 0 && normalizedReply.includes(normalizedQuestion);

      const fullMessage = followUpQuestion && !alreadyContains
        ? `${baseReply} ${followUpQuestion}`
        : baseReply;

      // Detect completion: no follow-up question means assessment is done
      const complete = !data?.nextQuestion;
      setIsComplete(complete);
      if (complete) setFullSummary(fullMessage);

      // Options for the next question
      const newOptions = data?.nextQuestion?.options ?? [];
      setOptions(newOptions);

      // Add assistant reply to history (full text, untruncated)
      setHistory(prev => [...prev, { role: 'assistant', text: fullMessage }]);

      // Speak a clean, truncated version
      const forVoice = truncateAtSentenceBoundary(fullMessage, 240);
      setLastMessage(forVoice);
      speakMessage(forVoice);
    } catch (err) {
      isSendingRef.current = false;
      setError(err instanceof Error ? err.message : 'Error sending message');
      setState('idle');
    }
  }, [speakMessage]);

  // ── Tap an option button ────────────────────────────────────────────────────
  const sendOption = useCallback((option: string) => {
    if (!isListening) return;
    window.speechSynthesis.cancel();
    setTranscript('');
    setOptions([]);
    silenceStartRef.current = null;
    lastFinalResultRef.current = null;
    void handleSendMessage(option);
  }, [isListening, handleSendMessage]);

  // ── Amplitude monitor loop ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isListening || !analyserRef.current) return;

    const monitor = () => {
      if (!analyserRef.current) return;

      const dataArray = dataArrayRef.current!;
      analyserRef.current.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      const avg = sum / dataArray.length / 255;

      const combinedAmplitude = state === 'speaking'
        ? Math.max(avg, ttsPulseRef.current)
        : avg;

      const now = performance.now();
      if (now - lastUiUpdateRef.current >= 120) {
        const smoothed = lastAmplitudeRef.current * 0.65 + combinedAmplitude * 0.35;
        if (Math.abs(smoothed - lastAmplitudeRef.current) >= 0.01 || smoothed < 0.01) {
          setAmplitude(smoothed);
          lastAmplitudeRef.current = smoothed;
        }
        lastUiUpdateRef.current = now;
      }

      // Interrupt detection
      if (state === 'speaking' && combinedAmplitude > INTERRUPT_THRESHOLD) {
        const canInterrupt =
          speakingStartedAtRef.current !== null &&
          Date.now() - speakingStartedAtRef.current > MIN_SPEAK_BEFORE_INTERRUPT_MS;
        if (canInterrupt) {
          if (!interruptStartRef.current) {
            interruptStartRef.current = Date.now();
          } else if (Date.now() - interruptStartRef.current > INTERRUPT_HOLD_MS) {
            window.speechSynthesis.cancel();
            setState('listening');
            interruptStartRef.current = null;
          }
        }
      } else {
        interruptStartRef.current = null;
      }

      // Noisy-environment fallback
      if (state === 'listening' && lastFinalResultRef.current !== null) {
        if (Date.now() - lastFinalResultRef.current > 1500 && transcript.trim()) {
          void handleSendMessage(transcript);
          setTranscript('');
          setState('processing');
          lastFinalResultRef.current = null;
          silenceStartRef.current = null;
        }
      }

      // Silence detection
      if (state === 'listening' && combinedAmplitude < SILENCE_THRESHOLD) {
        if (!silenceStartRef.current) {
          silenceStartRef.current = Date.now();
        } else if (Date.now() - silenceStartRef.current > SILENCE_MS) {
          if (transcript.trim()) {
            void handleSendMessage(transcript);
            setTranscript('');
            setState('processing');
            lastFinalResultRef.current = null;
          }
          silenceStartRef.current = null;
        }
      } else if (combinedAmplitude > START_THRESHOLD) {
        silenceStartRef.current = null;
        if (state === 'idle') setState('listening');
      }

      animationFrameRef.current = requestAnimationFrame(monitor);
    };

    animationFrameRef.current = requestAnimationFrame(monitor);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [handleSendMessage, isListening, state, transcript]);

  // ── Start ───────────────────────────────────────────────────────────────────
  const startListening = useCallback(async () => {
    try {
      isStoppingRef.current = false;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      // Reset session state
      contextRef.current = {};
      setHistory([]);
      setOptions([]);
      setIsComplete(false);
      setFullSummary('');
      setLastMessage('');
      setError(null);
      setTranscript('');
      silenceStartRef.current = null;
      lastFinalResultRef.current = null;
      isSendingRef.current = false;
      postSpeakCooldownRef.current = null;

      const speechWindow = window as WindowWithSpeechAPIs;
      const AudioContextConstructor = window.AudioContext || speechWindow.webkitAudioContext;
      if (!AudioContextConstructor) throw new Error('Web Audio API not supported');

      const audioContext = new AudioContextConstructor();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      dataArrayRef.current = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));

      setIsListening(true);
      setState('idle');
      try { recognitionRef.current?.start(); } catch { /* already started */ }

      // Greet the user and begin the assessment
      setTimeout(() => {
        speakMessage("Hello! I'm your AI medical assistant. Please tell me your main symptom.");
      }, 300);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Microphone access denied');
    }
  }, [speakMessage]);

  // ── Stop ────────────────────────────────────────────────────────────────────
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
      micStreamRef.current.getTracks().forEach(t => t.stop());
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
    speakingStartedAtRef.current = null;
    ttsPulseRef.current = 0;
    lastFinalResultRef.current = null;
    isSendingRef.current = false;
    postSpeakCooldownRef.current = null;
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
    options,
    isComplete,
    fullSummary,
    history,
    sendOption,
  };
}
