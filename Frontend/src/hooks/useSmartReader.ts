import { useState, useEffect } from 'react';
import apiClient from '../services/apiClient';
import { speakNaturally, stopNaturalSpeech } from '../utils/naturalSpeech';

interface WordAnalysis {
  word: string;
  status: 'GREEN' | 'YELLOW' | 'RED';
  feedback?: string;
}

export interface TextAnalysis {
  cefrLevel: string;
  /** In the native (right-hand) language. */
  explanation: string;
  /** Same explanation in the text's own (left-hand) language; '' when both are the same. */
  explanationSource: string;
  vocabulary: { word: string; meaning: string; explanation?: string }[];
  learningLanguage: string;
  nativeLanguage: string;
}

export function useSmartReader(initialText: string) {
  const [text, setText] = useState<string>(initialText);
  const [learningLang, setLearningLang] = useState<string>('English');
  const [nativeLang, setNativeLang] = useState<string>('Georgian');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [currentWordIdx, setCurrentWordIdx] = useState<number>(-1);
  const [selectedText, setSelectedText] = useState<string>('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [cefrLevel, setCefrLevel] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [wordScores, setWordScores] = useState<WordAnalysis[]>([]);
  const [teacherAdvice, setTeacherAdvice] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<TextAnalysis | null>(null);

  // A result written for another language pair would now be in the wrong language.
  useEffect(() => {
    setAnalysis(null);
    setSummary(null);
    setCefrLevel(null);
  }, [learningLang, nativeLang]);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentWordIdx(-1);
    return () => stopNaturalSpeech();
  }, [text, learningLang, playbackSpeed]);

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      setSelectedText(selection.toString().trim());
    } else {
      setSelectedText('');
    }
  };

  const togglePlay = () => {
    const locale = ({ English: 'en-US', Georgian: 'ka-GE', Spanish: 'es-ES', French: 'fr-FR', German: 'de-DE' } as Record<string, string>)[learningLang] ?? 'en-US';
    const finish = () => {
      setIsPlaying(false);
      setCurrentWordIdx(-1);
    };

    if (isPlaying) {
      stopNaturalSpeech();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      void speakNaturally(text, locale, playbackSpeed, { onEnd: finish, onError: finish });
    }
  };

  const handleSummarize = async () => {
    setLoadingAi(true);
    setSummary(null);
    setCefrLevel(null);
    setAnalysis(null);

    try {
      const { data } = await apiClient.post<{ summary: string; analysis?: TextAnalysis }>('/language-teacher/summarize', {
        text,
        learningLanguage: learningLang,
        nativeLanguage: nativeLang,
      });
      if (data.analysis) {
        setAnalysis(data.analysis);
        setSummary(data.analysis.explanation);
        setCefrLevel(data.analysis.cefrLevel);
      } else {
        // Older Backend: "<summary>\nCEFR Level: <level>" only.
        const [summaryText, cefr] = data.summary.split('CEFR Level:');
        setSummary(summaryText.trim());
        setCefrLevel((cefr ?? '').trim());
      }
    } catch (err: any) {
      // The Backend always responds 200 with a clean fallback summary rather
      // than throwing on an AI-provider failure (see routes/languageTeacher.ts's
      // /summarize), so this only fires for a genuine network/CORS failure.
      console.error('[useSmartReader] /language-teacher/summarize request failed:', err?.message ?? err);
      setSummary(nativeLang === 'Georgian'
        ? 'სერვერთან კავშირი ვერ მოხერხდა. შეამოწმეთ ინტერნეტი და სცადეთ თავიდან.'
        : 'Could not reach the server. Please check your connection and try again.');
    } finally {
      setLoadingAi(false);
    }
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = learningLang === 'German' ? 'de-DE' : learningLang === 'Spanish' ? 'es-ES' : learningLang === 'French' ? 'fr-FR' : 'en-US';
    recognition.interimResults = false;

    setIsListening(true);
    setRecordingError(null);
    setWordScores([]);

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      setIsListening(false);

      try {
        const { data } = await apiClient.post<{ words: WordAnalysis[]; teacherAdvice: string }>(
          '/language-teacher/analyze-pronunciation',
          { referenceText: text, transcribedText: transcript, learningLanguage: learningLang, nativeLanguage: nativeLang }
        );
        setWordScores(data.words || []);
        setTeacherAdvice(data.teacherAdvice || null);
      } catch {
        console.error('Failed to analyze pronunciation');
      }
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      setRecordingError(event.error || 'An error occurred during recording.');
    };
    recognition.start();
  };

  return {
    text,
    setText,
    learningLang,
    setLearningLang,
    nativeLang,
    setNativeLang,
    isPlaying,
    togglePlay,
    playbackSpeed,
    setPlaybackSpeed,
    currentWordIdx,
    selectedText,
    handleTextSelection,
    aiResponse,
    summary,
    cefrLevel,
    analysis,
    loadingAi,
    handleSummarize,
    isListening,
    startListening,
    recordingError,
    wordScores,
    teacherAdvice,
  };
}
