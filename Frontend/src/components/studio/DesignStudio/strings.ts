// UI strings for the Design Studio shell (top bar + AI mentor panel).
// The embedded editors carry their own translations (public/studio/*).
// en/ka written by hand; the other site locales live in strings.generated.ts.
import { GENERATED_STRINGS } from './strings.generated';

export const EN = {
  brand: 'CDC Design Studio',
  photo: 'Photo',
  photoHint: 'Raster editing: layers, brushes, selections, retouching, filters',
  vector: 'Vector',
  vectorHint: 'Vector drawing: pen and curves, shapes, text, artboards',
  sendToVector: 'Send to Vector',
  sendToPhoto: 'Send to Photo',
  sent: 'Added as a new layer',
  download: 'Download',
  submit: 'Submit assignment',
  submitting: 'Submitting…',
  submitted: 'Assignment submitted',
  submitFailed: 'Could not submit. Please try again.',
  fullscreen: 'Full screen',
  exitFullscreen: 'Exit full screen',
  loading: 'Loading editor…',
  notReady: 'The editor is still loading. Try again in a moment.',
  mentor: 'AI Mentor',
  mentorIntro: 'Ask me how to do anything in this workspace. I see which mode and tool you are using.',
  mentorPlaceholder: 'For example: how do I remove a background?',
  send: 'Send',
  thinking: 'Thinking…',
  mentorError: 'The mentor is unavailable right now. Please try again.',
  close: 'Close',
  shortcuts: 'Shortcuts',
  quickPhoto1: 'How do I remove a background?',
  quickPhoto2: 'How do I retouch skin or remove a blemish?',
  quickPhoto3: 'How do I fix a dark photo with levels or curves?',
  quickVector1: 'How do I draw a curve with the pen tool?',
  quickVector2: 'How do I design a simple logo?',
  quickVector3: 'How do I export my work as SVG or PDF?',
};

export type StudioStrings = typeof EN;

const KA: StudioStrings = {
  brand: 'CDC დიზაინ სტუდიო',
  photo: 'ფოტო',
  photoHint: 'რასტრული რედაქტირება: ფენები, ფუნჯები, მონიშვნა, რეტუში, ფილტრები',
  vector: 'ვექტორი',
  vectorHint: 'ვექტორული ხატვა: კალამი და მრუდები, ფიგურები, ტექსტი, არტბორდები',
  sendToVector: 'ვექტორში გადატანა',
  sendToPhoto: 'ფოტოში გადატანა',
  sent: 'დაემატა ახალ ფენად',
  download: 'ჩამოტვირთვა',
  submit: 'დავალების ჩაბარება',
  submitting: 'იგზავნება…',
  submitted: 'დავალება ჩაბარებულია',
  submitFailed: 'ჩაბარება ვერ მოხერხდა. სცადეთ თავიდან.',
  fullscreen: 'სრული ეკრანი',
  exitFullscreen: 'სრული ეკრანიდან გასვლა',
  loading: 'რედაქტორი იტვირთება…',
  notReady: 'რედაქტორი ჯერ იტვირთება. სცადეთ ცოტა ხანში.',
  mentor: 'AI მენტორი',
  mentorIntro: 'მკითხეთ, როგორ გააკეთოთ ნებისმიერი რამ ამ სამუშაო სივრცეში. ვხედავ, რომელ რეჟიმსა და ინსტრუმენტს იყენებთ.',
  mentorPlaceholder: 'მაგალითად: როგორ მოვაშორო ფონი?',
  send: 'გაგზავნა',
  thinking: 'ვფიქრობ…',
  mentorError: 'მენტორი ახლა მიუწვდომელია. სცადეთ თავიდან.',
  close: 'დახურვა',
  shortcuts: 'მალსახმობები',
  quickPhoto1: 'როგორ მოვაშორო ფონი?',
  quickPhoto2: 'როგორ გავაკეთო რეტუში ან მოვაშორო ლაქა?',
  quickPhoto3: 'როგორ გავასწორო ბნელი ფოტო Levels-ით ან Curves-ით?',
  quickVector1: 'როგორ დავხატო მრუდი კალმის ინსტრუმენტით?',
  quickVector2: 'როგორ შევქმნა მარტივი ლოგო?',
  quickVector3: 'როგორ გავიტანო ნამუშევარი SVG ან PDF ფორმატში?',
};

export function studioStrings(locale: string): StudioStrings {
  if (locale === 'ka') return KA;
  const generated = (GENERATED_STRINGS as Record<string, Partial<StudioStrings>>)[locale];
  return generated ? { ...EN, ...generated } : EN;
}
