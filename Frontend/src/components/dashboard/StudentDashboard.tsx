import { useState, useEffect } from 'react';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';

function StudentDashboard() {
  const [xp, setXp] = useState(0);
  const [tasksCompleted, setTasksCompleted] = useState(0);
  const [courseProgress, setCourseProgress] = useState(0);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    // Simulate fetching data from an API
    setXp(1200);
    setTasksCompleted(45);
    setCourseProgress(75);
    setStreak(10);
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Welcome to the Student Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-md p-4">
          <h2 className="text-lg font-semibold">XP Points</h2>
          <p className="text-2xl font-bold">{xp}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <h2 className="text-lg font-semibold">Tasks Completed</h2>
          <p className="text-2xl font-bold">{tasksCompleted}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <h2 className="text-lg font-semibold">Course Progress</h2>
          <CircularProgressbar
            value={courseProgress}
            text={`${courseProgress}%`}
            styles={buildStyles({
              textColor: '#000',
              pathColor: '#4caf50',
              trailColor: '#d6d6d6',
            })}
          />
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <h2 className="text-lg font-semibold">Streak</h2>
          <p className="text-2xl font-bold">{streak} days</p>
        </div>
      </div>
    </div>
  );
}
