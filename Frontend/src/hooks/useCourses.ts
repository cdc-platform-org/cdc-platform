import { useState, useEffect } from 'react';
import { Course } from '../types/lms';
import { getCourses } from '../services/courseService';
import { isPublishedCourse } from '../utils/courseCatalog';

export function useCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCourses()
      .then((data) => setCourses(data.filter(isPublishedCourse)))
      .finally(() => setLoading(false));
  }, []);

  return { courses, loading };
}
