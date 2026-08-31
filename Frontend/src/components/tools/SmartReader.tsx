import React, { useState } from 'react';

interface WordAnalysis {
  word: string;
  status: 'GREEN' | 'YELLOW' | 'RED';
  feedback?: string;
}

export const SmartReader: React.FC = () => {
  const [text, setText] = useState<string>(
    'Learning a new language opens up doors to different cultures and ways of thinking.'
  );
  const [learningLang, setLearningLang] = useState<string>('English');
  const [nativeLang, setNativeLang] = useState<string>('Georgian');
  
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [currentWordIdx, setCurrentWordIdx] = useState<number>(-1);

  const [selectedText, setSelectedText] = useState<string>('');
  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(null);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [cefrLevel, setCefrLevel] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState<boolean>(false);

  const [isListening, setIsListening] = useState<boolean>(false);
  const [wordScores, setWordScores] = useState<WordAnalysis[]>([]);
  const [teacherAdvice, setTeacherAdvice] = useState<string | null>(null);

  const words = text.split(/(\s+)/);

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelectedText(selection.toString().trim());
      setPopupPos({
        x: rect.left + rect.width / 2,
        y: rect.top - 10
      });
    } else {
      setPopupPos(null);
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
    if (!('speechSynthesis' in window)) return;

    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      setCurrentWordIdx(-1);
    } else {
      const utterance, = new SpeechSynthesisUtterance(selectedText);
      u.rate = 0.8;
      window.speechSynthesis.speak(u);
      return;
    }

    setLoadingAi(true);
    setAiResponse(null);

    try {
      const endpoint = action === 'explain' ? '/api/language-teacher/explain' : '/api/language-teacher/translate';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          targetPhrase: selectedText,
          learningLanguage: learningLang,
          nativeLanguage: nativeLang
        })
      });
      const data = await res.json();
      setAiResponse(data.explanation || data.translation || 'No response.');
    } catch {
      setAiResponse('Error reaching AI Teacher service.');
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

    recognition.onerror = () => setIsListening(false);
    recognition.start();
  };

  return (
    <div className="max-w-5xl mx-auto p-6 bg-slate-900 text-white rounded-2xl shadow-xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            AI Smart Reader & Language Teacher
          </h2>
          <p className="text-xs text-slate-400">Interactive Reader, Karaoke Highlight & Pronunciation Coach</p>
        </div>

        <div className="flex items-center space-x-3 text-sm">
          <select 
            value={learningLang} 
            onChange={(e) => setLearningLang(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200"
          >
            <option value="English">🇬🇧 English</option>
            <option value="German">🇩🇪 German</option>
            <option value="Spanish">🇪🇸 Español</option>
            <option value="French">🇫🇷 Français</option>
          </select>

          <span className="text-slate-500">➔</span>

          <select 
            value={nativeLang} 
            onChange={(e) => setNativeLang(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200"
          >
            <option value="Georgian">🇬🇪 ქართული</option>
            <option value="English">🇬🇧 English</option>
            <option value="Ukrainian">🇺🇦 Українська</option>
            <option value="Turkish">🇹🇷 Türkçe</option>
            <option value="Armenian">🇦🇲 Հայերեն</option>
            <option value="Azerbaijani">🇦🇿 Azərbaycan</option>
          </select>
        </div>
      </div>

      <div className="space-y-3">
        <button
          onClick={handleSummarize}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
        >
          Summarize & CEFR Analysis
        </button>

        {summary && (
          <div className="bg-slate-800 p-4 rounded-lg mt-4">
            <p className="text-slate-200">{summary}</p>
            {cefrLevel && (
              <span
                className={`inline-block px-3 py-1 mt-2 text-sm font-semibold rounded-full ${
                  cefrLevel.startsWith('A')
                    ? 'bg-green-500 text-white'
                    : cefrLevel.startsWith('B')
                    ? 'bg-yellow-500 text-black'
                    : 'bg-red-500 text-white'
                }`}
              >
                CEFR Level: {cefrLevel}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center space-x-4 mt-4">
          <button
            onClick={togglePlay}
            className={`px-4 py-2 rounded-lg ${
              isPlaying ? 'bg-red-600' : 'bg-green-600'
            } text-white hover:opacity-90 transition`}
          >
            {isPlaying ? 'Stop' : 'Play'}
          </button>
          <label className="text-slate-400">
            Speed:
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
              className="ml-2"
            />
          </label>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste or type any text here..."
          className="w-full h-24 p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
        />

        <div 
        powupPos && (
          <div 
            style={{ left: popupPos.x, top: popupPos.y }}
            className="fixed -translate-x-1/2 -translate-y-full z-50 bg-slate-800 text-white border border-indigo-500/50 shadow-2xl rounded-xl p-2 flex items-center space-x-2"
          >
            <button 
              onClick={() => handleAction('pronounce')}
              className="px-2.5 py-1 text-xs bg-slate-700 hover:bg-indigo-600 rounded-lg transition-colors flex items-center space-x-1"
            >
              <span>🔊</span> <span>Pronounce</span>
            </button>
            <button 
              onClick={() => handleAction('explain')}
              className="px-2.5 py-1 text-xs bg-slate-700 hover:bg-indigo-600 rounded-lg transition-colors flex items-center space-x-1"
            >
              <span>�2</span> <span>Explain</span>
            </button>
            <button 
              onClick={() => handleAction('translate')}
              className="px-2.5 py-1 text-xs bg-slate-700 hover:bg-indigo-600 rounded-lg transition-colors flex items-center space-x-1"
            >
              <span>🌐/span> <span>Translate</span>
            </button>
          </div>
        )}

        {(loadingAi || aiResponse || teacherAdvice) && (
          <div className="bg-slate-800/90 border border-indigo-500/30 p-5 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs text-indigo-400 font-semibold">
              <span>🤦 AI Teacher Feedback</span>
              <button onClick={() => { setAiResponse(null); setTeacherAdvice(null); }} className="hover:text-white">✕</button>
            </div>
            {loadingAi ? (
              <p className="text-sm text-slate-400 animate-pulse">Analyzing context with Azure GPT-4o...</p>
            ) : (
              <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                {aiResponse || teacherAdvice}
              </div>
            )}
          </divO
        )}
      </divO
    );
};

export default SmartReader;
