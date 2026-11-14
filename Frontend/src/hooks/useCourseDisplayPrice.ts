import { useEffect, useState } from 'react';
import type { Course } from '../types/lms';

/** Keep an open page honest when a server-computed sale reaches its deadline. */
export function useCourseDisplayPrice(course: Course) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const deadline = course.discountEndDate ? Date.parse(course.discountEndDate) : NaN;
    let timer: number | undefined;
    const refresh = () => {
      setNow(Date.now());
      const remaining = deadline - Date.now();
      if (Number.isFinite(remaining) && remaining > 0) timer = window.setTimeout(refresh, Math.min(remaining + 10, 2147483647));
    };
    refresh();
    return () => window.clearTimeout(timer);
  }, [course.discountEndDate]);
  const saleActive = course.saleActive && (!course.discountEndDate || now === null || new Date(course.discountEndDate).getTime() > now);
  const isNew = now !== null && now >= Date.parse(course.createdAt) && now - Date.parse(course.createdAt) < 30 * 86400000;
  return { saleActive, isNew, currentPrice: saleActive ? course.currentPrice : course.originalPrice };
}
