import { useState } from 'react';
import { useTranslation } from 'next-i18next';
import { Loader2, Printer, RectangleHorizontal, RectangleVertical } from 'lucide-react';
import {
  CUSTOM_PRINT_SIZE_MAX_MM,
  CUSTOM_PRINT_SIZE_MIN_MM,
  PRINT_SIZE_PRESETS,
  PrintRequest,
  PrintSizePreset,
} from '../../../services/childrensBookService';

interface PrintSettingsPanelProps {
  busy: boolean;
  onDownload: (settings: PrintRequest, fileSuffix: string) => Promise<void>;
}

type SizeOption = PrintSizePreset | 'CUSTOM';
const OPTIONS: SizeOption[] = ['A4', 'A5', 'A3', 'LETTER', 'SQUARE_210', 'SQUARE_200', 'CUSTOM'];
const BLEEDS: Array<0 | 3 | 5> = [0, 3, 5];

function formatMm(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

// Print settings for the finished book: paper size (A4 first and default,
// other standard sizes, or a custom size in millimetres), orientation and
// bleed for professional printing, with a to-scale preview of the page.
export default function PrintSettingsPanel({ busy, onDownload }: PrintSettingsPanelProps) {
  const { t } = useTranslation('childrensBook');
  const [size, setSize] = useState<SizeOption>('A4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [customWidth, setCustomWidth] = useState('210');
  const [customHeight, setCustomHeight] = useState('210');
  const [bleedMm, setBleedMm] = useState<0 | 3 | 5>(0);
  const [working, setWorking] = useState(false);

  const isCustom = size === 'CUSTOM';
  const isSquare = !isCustom && PRINT_SIZE_PRESETS[size].widthMm === PRINT_SIZE_PRESETS[size].heightMm;
  const customW = Number(customWidth);
  const customH = Number(customHeight);
  const inRange = (v: number) => Number.isFinite(v) && v >= CUSTOM_PRINT_SIZE_MIN_MM && v <= CUSTOM_PRINT_SIZE_MAX_MM;
  const customValid = inRange(customW) && inRange(customH);

  let widthMm: number;
  let heightMm: number;
  if (isCustom) {
    widthMm = customValid ? customW : 210;
    heightMm = customValid ? customH : 210;
  } else {
    const preset = PRINT_SIZE_PRESETS[size];
    const short = Math.min(preset.widthMm, preset.heightMm);
    const long = Math.max(preset.widthMm, preset.heightMm);
    widthMm = orientation === 'landscape' && !isSquare ? long : short;
    heightMm = orientation === 'landscape' && !isSquare ? short : long;
  }

  // Preview box: the page drawn to scale inside a 120px square.
  const previewScale = 120 / Math.max(widthMm, heightMm);
  const sizeLabel = isCustom ? t('printSizeCustom') : t(`printSize.${size}`);

  async function download() {
    const settings: PrintRequest = isCustom
      ? { size, orientation: customW > customH ? 'landscape' : 'portrait', widthMm: customW, heightMm: customH, bleedMm }
      : { size, orientation: isSquare ? 'portrait' : orientation, bleedMm };
    const suffix = `${isCustom ? `${formatMm(customW)}x${formatMm(customH)}mm` : size}${bleedMm ? `-bleed${bleedMm}mm` : ''}`;
    setWorking(true);
    try {
      await onDownload(settings, suffix);
    } finally {
      setWorking(false);
    }
  }

  return (
    <section aria-labelledby="print-settings-title" className="rounded-xl border border-gray-200 bg-gray-50 p-4 sm:p-5 mb-6">
      <h3 id="print-settings-title" className="font-semibold text-gray-800 flex items-center gap-2 mb-1">
        <Printer className="w-5 h-5 text-purple-600" /> {t('printSettingsTitle')}
      </h3>
      <p className="text-sm text-gray-600 mb-4">{t('printSettingsIntro')}</p>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="space-y-4 min-w-0">
          <fieldset>
            <legend className="block text-sm font-medium text-gray-700 mb-2">{t('printPaperSize')}</legend>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {OPTIONS.map((option) => {
                const selected = option === size;
                const dims = option === 'CUSTOM' ? t('printSizeCustomHint') : `${formatMm(PRINT_SIZE_PRESETS[option].widthMm)} × ${formatMm(PRINT_SIZE_PRESETS[option].heightMm)} ${t('printMm')}`;
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setSize(option)}
                    className={`min-w-0 text-left rounded-lg border px-3 py-2 transition-colors ${selected ? 'border-purple-500 bg-white ring-2 ring-purple-200' : 'border-gray-200 bg-white hover:border-purple-300'}`}
                  >
                    <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm font-semibold text-gray-900">
                      {option === 'CUSTOM' ? t('printSizeCustom') : t(`printSize.${option}`)}
                      {option === 'A4' && <span className="text-[10px] font-medium uppercase tracking-wide text-purple-700 bg-purple-50 rounded px-1.5 py-0.5">{t('printRecommended')}</span>}
                    </span>
                    <span className="block text-xs text-gray-500 break-words">{dims}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {isCustom && (
            <div className="grid grid-cols-2 gap-3 max-w-xs">
              <label className="text-sm text-gray-700">
                {t('printWidth')}
                <div className="mt-1 flex items-center rounded-lg border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-purple-300">
                  <input type="number" inputMode="decimal" min={CUSTOM_PRINT_SIZE_MIN_MM} max={CUSTOM_PRINT_SIZE_MAX_MM} value={customWidth} onChange={(e) => setCustomWidth(e.target.value)} className="w-full rounded-lg px-3 py-2 outline-none" />
                  <span className="pr-3 text-xs text-gray-500">{t('printMm')}</span>
                </div>
              </label>
              <label className="text-sm text-gray-700">
                {t('printHeight')}
                <div className="mt-1 flex items-center rounded-lg border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-purple-300">
                  <input type="number" inputMode="decimal" min={CUSTOM_PRINT_SIZE_MIN_MM} max={CUSTOM_PRINT_SIZE_MAX_MM} value={customHeight} onChange={(e) => setCustomHeight(e.target.value)} className="w-full rounded-lg px-3 py-2 outline-none" />
                  <span className="pr-3 text-xs text-gray-500">{t('printMm')}</span>
                </div>
              </label>
              <p className={`col-span-2 text-xs ${customValid ? 'text-gray-500' : 'text-red-600'}`}>{t('printCustomRange', { min: CUSTOM_PRINT_SIZE_MIN_MM, max: CUSTOM_PRINT_SIZE_MAX_MM })}</p>
            </div>
          )}

          {!isCustom && !isSquare && (
            <fieldset>
              <legend className="block text-sm font-medium text-gray-700 mb-2">{t('printOrientation')}</legend>
              <div className="grid grid-cols-2 w-full sm:inline-grid sm:w-auto rounded-lg border border-gray-300 bg-white p-0.5">
                {(['portrait', 'landscape'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={orientation === value}
                    onClick={() => setOrientation(value)}
                    className={`min-w-0 flex items-center justify-center gap-1.5 rounded-md px-2 sm:px-3 py-1.5 text-center text-sm font-medium ${orientation === value ? 'bg-purple-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    {value === 'portrait' ? <RectangleVertical className="hidden sm:block w-4 h-4 shrink-0" /> : <RectangleHorizontal className="hidden sm:block w-4 h-4 shrink-0" />}
                    <span>{t(value === 'portrait' ? 'printPortrait' : 'printLandscape')}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <fieldset>
            <legend className="block text-sm font-medium text-gray-700 mb-2">{t('printBleed')}</legend>
            <div className="inline-flex rounded-lg border border-gray-300 bg-white p-0.5">
              {BLEEDS.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={bleedMm === value}
                  onClick={() => setBleedMm(value)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${bleedMm === value ? 'bg-purple-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  {value === 0 ? t('printBleedNone') : `${value} ${t('printMm')}`}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">{t('printBleedHint')}</p>
          </fieldset>
        </div>

        <div className="flex flex-col items-center justify-start gap-2 sm:w-40">
          <div className="flex h-[132px] w-[132px] items-center justify-center rounded-lg bg-white border border-gray-200">
            <div
              className="relative bg-white shadow-md border border-gray-300"
              style={{ width: widthMm * previewScale, height: heightMm * previewScale }}
              aria-hidden
            >
              <div className="absolute inset-[8%] bottom-[38%] rounded-sm bg-purple-100" />
              <div className="absolute left-[15%] right-[15%] bottom-[22%] h-[4%] rounded bg-gray-200" />
              <div className="absolute left-[22%] right-[22%] bottom-[14%] h-[4%] rounded bg-gray-200" />
              {bleedMm > 0 && <div className="absolute -inset-[3px] border border-dashed border-red-300 pointer-events-none" />}
            </div>
          </div>
          <p className="text-xs text-gray-600 text-center">
            <span className="font-medium text-gray-800">{sizeLabel}</span><br />
            {formatMm(widthMm)} × {formatMm(heightMm)} {t('printMm')}
          </p>
        </div>
      </div>

      <button
        type="button"
        disabled={busy || working || (isCustom && !customValid)}
        onClick={download}
        className="mt-5 px-5 py-2 rounded-lg bg-purple-600 text-white font-medium disabled:opacity-50 inline-flex items-center gap-2"
      >
        {working ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />} {t('printDownloadButton')}
      </button>
    </section>
  );
}
