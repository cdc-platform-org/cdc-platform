/**
 * Admin course list: create/edit/publish/delete courses, open the
 * curriculum editor and the marketing Launch Kit.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';
import { Sparkles } from 'lucide-react';
import LaunchKitDrawer from '../LaunchKitDrawer';
import { Course } from '../../../types/lms';
import { getCourses, updateCourse, deleteCourse } from '../../../services/courseService';
import { CourseForm } from './CourseForm';
import { ExamSettingsPanel } from './ExamSettingsPanel';
import { CurriculumEditor } from './CurriculumEditor';

export function AdminCoursesDashboard() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [managingCourse, setManagingCourse] = useState<Course | null>(null);
  const [togglingPublishId, setTogglingPublishId] = useState<string | null>(null);
  const [launchKitCourse, setLaunchKitCourse] = useState<Course | null>(null);
  const formCardRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCourses(await getCourses());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSaved = (course: Course) => {
    setCourses((prev) => {
      const exists = prev.some((c) => c.id === course.id);
      return exists ? prev.map((c) => (c.id === course.id ? course : c)) : [course, ...prev];
    });
    setEditingCourse(null);
    if (!managingCourse) setManagingCourse(course);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this course and its entire curriculum?')) return;
    await deleteCourse(id);
    setCourses((prev) => prev.filter((c) => c.id !== id));
    if (managingCourse?.id === id) setManagingCourse(null);
  };

  const handleEdit = (course: Course) => {
    setEditingCourse(course);
    formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleTogglePublish = async (course: Course) => {
    setTogglingPublishId(course.id);
    try {
      const updated = await updateCourse(course.id, { published: !course.published });
      setCourses((prev) => prev.map((c) => (c.id === course.id ? updated : c)));
      if (editingCourse?.id === course.id) setEditingCourse(updated);
    } catch {
      alert('Unable to change publish status. Please try again.');
    } finally {
      setTogglingPublishId(null);
    }
  };

  return (
    <>
      <Head>
        <title>Courses | Admin</title>
      </Head>
      <div className="max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Course Management</h1>
          <p className="text-sm text-gray-500 mt-1">Create courses, then manage their sections, lessons, and lesson videos.</p>
        </div>

        <div ref={formCardRef} className="bg-white/95 backdrop-blur-md rounded-2xl border border-gray-200/80 shadow-md shadow-slate-200/40 transition-all duration-300 hover:border-cyan-400/50 hover:shadow-lg hover:shadow-cyan-500/10 p-6 md:p-8 mb-10">
          <h2 className="text-base font-semibold text-gray-900 mb-6">{editingCourse ? 'Edit Course' : 'New Course'}</h2>
          <CourseForm editingCourse={editingCourse} onSaved={handleSaved} onCancel={() => setEditingCourse(null)} />
          {managingCourse && <CurriculumEditor course={managingCourse} />}
          {managingCourse && <ExamSettingsPanel course={managingCourse} />}
        </div>

        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-4">Courses ({courses.length})</h2>
          {loading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : (
            <div className="space-y-3">
              {courses.map((course) => (
                <div key={course.id} className="bg-white/90 dark:bg-slate-900/70 backdrop-blur-sm border border-gray-200 dark:border-slate-800 rounded-xl p-4 flex items-center gap-4 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                        {course.category}
                      </span>
                      {!course.published && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded">Draft</span>
                      )}
                    </div>
                    <h3 className="font-semibold text-sm text-gray-900 dark:text-white truncate mt-1">{course.title}</h3>
                    {course.mentorName && <p className="text-xs text-gray-500">{course.mentorName} · {course.mentorTitle}</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setManagingCourse(course)}
                      className="text-xs font-medium text-emerald-600 hover:text-emerald-800 px-3 py-1.5 rounded-lg hover:bg-emerald-50"
                    >
                      Curriculum
                    </button>
                    <button
                      type="button"
                      onClick={() => setLaunchKitCourse(course)}
                      className="flex items-center gap-1 text-xs font-medium text-white bg-gradient-to-r from-cyan-500 to-purple-600 px-3 py-1.5 rounded-lg hover:opacity-90"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Launch Kit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTogglePublish(course)}
                      disabled={togglingPublishId === course.id}
                      className={`text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-60 ${
                        course.published
                          ? 'text-amber-600 hover:text-amber-800 hover:bg-amber-50'
                          : 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'
                      }`}
                    >
                      {togglingPublishId === course.id ? '…' : course.published ? 'Unpublish' : 'Publish'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEdit(course)}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800 px-3 py-1.5 rounded-lg hover:bg-indigo-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(course.id)}
                      className="text-xs font-medium text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {launchKitCourse && (
        <LaunchKitDrawer target={{ courseId: launchKitCourse.id }} title={launchKitCourse.title} onClose={() => setLaunchKitCourse(null)} />
      )}
    </>
  );
}
