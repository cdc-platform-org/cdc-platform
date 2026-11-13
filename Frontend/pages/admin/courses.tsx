/**
 * /admin/courses — admin course management (SUPER_ADMIN / MANAGER only).
 * The UI lives in src/components/admin/courses/: AdminCoursesDashboard (list),
 * CourseForm (create/edit), CurriculumEditor → SectionCard → LessonRow, and
 * ExamSettingsPanel.
 */
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import { AdminCoursesDashboard } from '../../src/components/admin/courses/AdminCoursesDashboard';

export default function AdminCoursesPage() {
  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}>
      <AdminLayout>
        <AdminCoursesDashboard />
      </AdminLayout>
    </AdminGuard>
  );
}
