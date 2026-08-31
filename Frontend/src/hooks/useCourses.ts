import { useState, useEffect } from 'react';
import { Course } from '../types/lms';
import { getCourses } from '../services/courseService';

export function useCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCourses()
      .then((data) => setCourses(data.filter((c) => c.published)))
      .finally(() => setLoading(false));
  }, []);

  return { courses, loading };
}
