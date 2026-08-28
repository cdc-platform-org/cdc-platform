// Curated category list for the digital-products submission form
// (Frontend/pages/dashboard.tsx). DigitalProduct.category is a plain
// String column, not a DB enum — this only constrains the picker UI to a
// consistent set rather than free text, same "curated suggestion list"
// posture as src/data/freelancerSkills.ts. A product saved before this
// list existed may hold a category value not in here; the dropdown that
// renders this list is responsible for keeping that value selectable
// rather than silently discarding it on the next save (see dashboard.tsx).
export interface DigitalProductCategoryDefinition {
  value: string;
  labelKa: string;
  labelEn: string;
  emoji: string;
}

export const DIGITAL_PRODUCT_CATEGORIES: DigitalProductCategoryDefinition[] = [
  { value: 'ebooks_guides', emoji: '📘', labelKa: 'ელ-წიგნები & გზამკვლევები', labelEn: 'E-Books & Guides' },
  { value: 'design_graphics', emoji: '🎨', labelKa: 'დიზაინი & გრაფიკა', labelEn: 'Design & Graphics' },
  { value: 'code_scripts', emoji: '💻', labelKa: 'კოდი & სკრიპტები', labelEn: 'Code & Scripts' },
  { value: 'uiux_kits_templates', emoji: '🛠️', labelKa: 'UI/UX Kits & შაბლონები', labelEn: 'UI/UX Kits & Templates' },
  { value: 'audio_presets', emoji: '🎵', labelKa: 'აუდიო & პრესეტები', labelEn: 'Audio & Presets' },
  { value: 'ai_prompts_tools', emoji: '🤖', labelKa: 'AI Prompts & ინსტრუმენტები', labelEn: 'AI Prompts & Tools' },
  { value: 'other', emoji: '📦', labelKa: 'სხვა ციფრული რესურსი', labelEn: 'Other Digital Asset' },
];
