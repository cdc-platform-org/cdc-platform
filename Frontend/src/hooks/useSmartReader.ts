import { useState, useEffect } from 'react';

interface WordAnalysis {
  word: string;
  status: 'GREEN' | 'YELLOW' | 'RED';
  feedback?: string;
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

  const words = text.split(/(\s+)/);

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      setSelectedText(selection.toString().trim());
    } else {
      setSelectedText('');
    }
  };

  const togglePlay = () => {
    if (!('speechSynthesis' in window)) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = playbackSpeed;

    utterance.onboundary = (event) => {
      const wordIndex = words.findIndex((word) => text.indexOf(word) === event.charIndex);
      setCurrentWordIdx(wordIndex);
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setCurrentWordIdx(-1);
    };

    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
    } else {
      window.speechSynthesis.speak(utterance);
      setIsPlaying(true);
    }
  };

  const handleSummarize = async () => {
    setLoadingAi(true);
    setSummary(null);
    setCefrLevel(null);

    try {
      const res = await fetch('/api/language-teacher/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      const [summaryText, cefr] = data.summary.split('CEFR Level:');
      setSummary(summaryText.trim());
      setCefrLevel(cefr.trim());
    } catch {
      setSummary('Error summarizing text.');
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
    recognition.lang = learningLang === 'German' ? 'de-DE' : learningLang === 'Spanish' ? 'es-ES' : 'en-US';
    recognition.interimResults = false;

    setIsListening(true);
    setRecordingError(null);
    setWordScores([]);

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      setIsListening(false);

      try {
        const res = await fetch('/api/language-teacher/analyze-pronunciation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            referenceText: text,
            transcribedText: transcript,
            learningLanguage: learningLang,
            nativeLanguage: nativeLang
          })
        });
        const data = await res.json();
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
    loadingAi,
    handleSummarize,
    isListening,
    startListening,
    recordingError,
    wordScores,
    teacherAdvice,
  };
}
