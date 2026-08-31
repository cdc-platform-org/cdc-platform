import { useState, useEffect } from 'react';

function TeacherDashboard() {
  const [activeGroups, setActiveGroups] = useState(0);
  const [quizzesGenerated, setQuizzesGenerated] = useState(0);
  const [lessonsGenerated, setLessonsGenerated] = useState(0);
  const [tasksReviewed, setTasksReviewed] = useState(0);

  useEffect(() => {
    // Simulate fetching data from an API
    setActiveGroups(5);
    setQuizzesGenerated(20);
    setLessonsGenerated(15);
    setTasksReviewed(50);
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Welcome to the Teacher Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-md p-4">
          <h2 className="text-lg font-semibold">Active Student Groups</h2>
          <p className="text-2xl font-bold">{activeGroups}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <h2 className="text-lg font-semibold">Quizzes Generated</h2>
          <p className="text-2xl font-bold">{quizzesGenerated}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <h2 className="text-lg font-semibold">Lessons Generated</h2>
          <p className="text-2xl font-bold">{lessonsGenerated}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <h2 className="text-lg font-semibold">Tasks Reviewed</h2>
          <p className="text-2xl font-bold">{tasksReviewed}</p>
        </div>
      </div>
    </div>
  );
}
