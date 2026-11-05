// ============================================================
// Children's Book — illustration styles. Each key is what the wizard sends
// and what BookProject.illustrationStyle stores; the description is what the
// image model actually receives (a bare key like "MODERN_3D" gives it far
// less to work with). Character preview, final pages and the page revision
// all describe the style the same way, so a book never changes style.
// ============================================================

export const ILLUSTRATION_STYLES = {
  STORYBOOK_WATERCOLOR: 'classic children\'s storybook watercolor: soft watercolor textures, gentle washes of colour, delicate clean linework',
  MODERN_3D: 'modern 3D animated-film look: soft rounded 3D characters, warm cinematic lighting, smooth materials, friendly feature-animation style',
  SOFT_DIGITAL: 'soft digital painting: smooth brush strokes, gentle gradients, pastel palette, cosy and calm atmosphere',
  CARTOON: 'cute 2D cartoon: bold clean outlines, bright flat colours, simple expressive shapes, playful and cheerful',
  FANTASY: 'magical fantasy illustration: glowing light, sparkles, rich jewel-tone colours, enchanted dreamy atmosphere',
  CLASSIC: 'classic picture-book illustration: fine ink linework with coloured-pencil and gouache shading, timeless vintage storybook feel',
} as const;

export type IllustrationStyle = keyof typeof ILLUSTRATION_STYLES;

export const ILLUSTRATION_STYLE_KEYS = Object.keys(ILLUSTRATION_STYLES) as IllustrationStyle[];

export function isIllustrationStyle(value: unknown): value is IllustrationStyle {
  return typeof value === 'string' && value in ILLUSTRATION_STYLES;
}

export function illustrationStylePromptLine(style: string | null | undefined): string {
  const key: IllustrationStyle = isIllustrationStyle(style) ? style : 'STORYBOOK_WATERCOLOR';
  return `Art style: ${ILLUSTRATION_STYLES[key]}. Use exactly this style on every image of the book.`;
}
