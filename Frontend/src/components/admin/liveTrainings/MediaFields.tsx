/**
 * Live training form: cover image and promo / trailer video.
 */
import VideoEmbed, { parseVideoUrl } from '../../shared/VideoEmbed';
import { LiveTrainingPayload } from '../../../services/adminLiveTrainingService';
import { ChangeEvent } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import { at } from '../../../i18n/admin';
interface MediaFieldsProps {
  form: Omit<LiveTrainingPayload, "discountBadgeText"> & { scheduledAtLocal: string; startDateLocal: string; endDateLocal: string; discountEndDateLocal: string; discountBadgeText: string; };
  imageUploading: boolean;
  handleCoverImageChange: (e: ChangeEvent<HTMLInputElement>) => Promise<void>;
  setForm: Dispatch<SetStateAction<Omit<LiveTrainingPayload, "discountBadgeText"> & { scheduledAtLocal: string; startDateLocal: string; endDateLocal: string; discountEndDateLocal: string; discountBadgeText: string; }>>;
  inputClass: "w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";
}

export default function MediaFields({
  form,
  imageUploading,
  handleCoverImageChange,
  setForm,
  inputClass,
}: MediaFieldsProps) {
  return (
    <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  ქავერ ფოტო <span className="text-gray-400 font-normal">(რეკომენდებული ზომა: 1280 × 720px / 16:9)</span>
                </label>
                <div className="flex items-center gap-3">
                  {form.thumbnailUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.thumbnailUrl} alt="" className="w-20 h-12 rounded-lg object-cover border border-gray-200 shrink-0" />
                  )}
                  <label className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 cursor-pointer hover:bg-gray-50">
                    {imageUploading ? 'იტვირთება…' : form.thumbnailUrl ? 'ფოტოს შეცვლა' : '📁 ატვირთვა'}
                    <input type="file" accept="image/*" onChange={handleCoverImageChange} className="hidden" disabled={imageUploading} />
                  </label>
                </div>
              </div>
              <div>
                <label htmlFor="training-video-url" className="block text-sm font-medium text-gray-700 mb-1.5">{at("YouTube / Video Trailer Link")}</label>
                <input
                  id="training-video-url"
                  type="url"
                  value={form.videoUrl ?? ''}
                  onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
                  placeholder="მაგ. https://www.youtube.com/watch?v=..."
                  className={inputClass}
                />
                {form.videoUrl?.trim() && (
                  <div className="mt-3">
                    {parseVideoUrl(form.videoUrl.trim()) ? <VideoEmbed url={form.videoUrl.trim()} title={at("Training trailer preview")} /> : (
                      <p role="status" className="text-xs text-amber-700">გამოიყენეთ YouTube, Vimeo ან პირდაპირი MP4/WebM/OGG/MOV ბმული. ეს ბმული საჯარო გვერდზე ვერ გამოჩნდება.</p>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label htmlFor="training-trainer-video-url" className="block text-sm font-medium text-gray-700 mb-1.5">
                  ლექტორის ვიდეო <span className="text-gray-400 font-normal">(YouTube / Vimeo / MP4 — გამოჩნდება საჯარო გვერდზე)</span>
                </label>
                <input
                  id="training-trainer-video-url"
                  type="url"
                  value={form.trainerVideoUrl ?? ''}
                  onChange={(e) => setForm({ ...form, trainerVideoUrl: e.target.value })}
                  placeholder="მაგ. https://www.youtube.com/watch?v=..."
                  className={inputClass}
                />
                {form.trainerVideoUrl?.trim() && (
                  <div className="mt-3">
                    {parseVideoUrl(form.trainerVideoUrl.trim()) ? <VideoEmbed url={form.trainerVideoUrl.trim()} title={at("Trainer video preview")} /> : (
                      <p role="status" className="text-xs text-amber-700">გამოიყენეთ YouTube, Vimeo ან პირდაპირი MP4/WebM/OGG/MOV ბმული. ეს ბმული საჯარო გვერდზე ვერ გამოჩნდება.</p>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label htmlFor="training-media-consent-url" className="block text-sm font-medium text-gray-700 mb-1.5">
                  ფოტო/ვიდეო თანხმობის ფორმა <span className="text-gray-400 font-normal">(Google Forms ბმული — მთელი ტრენინგისთვის ერთხელ)</span>
                </label>
                <input
                  id="training-media-consent-url"
                  type="url"
                  value={form.mediaConsentFormUrl ?? ''}
                  onChange={(e) => setForm({ ...form, mediaConsentFormUrl: e.target.value })}
                  placeholder="https://forms.gle/..."
                  className={inputClass}
                />
                <p className="text-xs text-gray-400 mt-1.5">ცარიელი — მონაწილეს „ფოტო/ვიდეო თანხმობის" ღილაკი არ უჩანს.</p>
              </div>
            </div>
    </>
  );
}
