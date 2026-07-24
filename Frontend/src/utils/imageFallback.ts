// A tiny inline SVG (data: URI, no network round-trip — can't itself fail
// to load) shown when an admin-supplied image URL 404s or the underlying
// file gets deleted. Swapping `src` directly (rather than hiding the <img>)
// keeps layout/aspect-ratio classes on the element intact.
const PLACEHOLDER_SVG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
      <rect width="400" height="300" fill="#1e293b"/>
      <g fill="none" stroke="#64748b" stroke-width="2">
        <rect x="130" y="100" width="140" height="100" rx="6"/>
        <circle cx="165" cy="130" r="10"/>
        <path d="M130 180l35-35 25 25 30-30 50 50" />
      </g>
    </svg>`
  );

export function onImageErrorFallback(e: React.SyntheticEvent<HTMLImageElement>): void {
  const img = e.currentTarget;
  if (img.src === PLACEHOLDER_SVG) return; // avoid an infinite error loop if the placeholder itself somehow errors
  img.src = PLACEHOLDER_SVG;
}
