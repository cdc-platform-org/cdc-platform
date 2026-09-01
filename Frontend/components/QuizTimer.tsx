import { useEffect, useState } from 'react';

interface QuizTimerProps {
  duration: number; // in seconds
  onExpire: () => void;
}

export default function QuizTimer({ duration, onExpire }: QuizTimerProps) {
  const [remainingTime, setRemainingTime] = useState(() => {
    const savedTime = localStorage.getItem('quiz-remaining-time');
    const savedDuration = localStorage.getItem('quiz-duration');
    if (savedTime && savedDuration && parseInt(savedDuration, 10) === duration) {
      return parseInt(savedTime, 10);
    }
    localStorage.setItem('quiz-duration', duration.toString());
    return duration;
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingTime((prev) => {
        const newTime = prev - 1;
        localStorage.setItem('quiz-remaining-time', newTime.toString());
        if (newTime <= 0) {
          clearInterval(interval);
          localStorage.removeItem('quiz-remaining-time');
          onExpire();
        }
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [onExpire]);

  const minutes = Math.floor(remainingTime / 60);
  const seconds = remainingTime % 60;

  return (
    <div className="quiz-timer px-4 sm:px-6">
      {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
    </div>
  );
}
