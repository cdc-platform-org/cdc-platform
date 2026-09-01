import fs from 'fs';
import path from 'path';
import glob from 'glob';
/**
 * Scans all UI pages and locale files to locate missing translation keys.
 * @param {string[]} supportedLocales - List of supported locale files (e.g., ['ka', 'en', 'az', 'hy']).
 * @returns {Record<string, string[]>} - Missing keys for each locale.
 */
export function findMissingTranslationKeys(supportedLocales: string[]): Record<string, string[]> {
  const localeDir = path.resolve(__dirname, '../../locales');
  const uiFiles = glob.sync(path.resolve(__dirname, '../../frontend/pages/**/*.tsx'));
  const missingKeys: Record<string, string[]> = {};

  supportedLocales.forEach((locale) => {
    const localeFilePath = path.join(localeDir, `${locale}.json`);
    const localeData = JSON.parse(fs.readFileSync(localeFilePath, 'utf-8'));
    const keysInLocale = new Set(Object.keys(localeData));

    uiFiles.forEach((file) => {
      const fileContent = fs.readFileSync(file, 'utf-8');
      const regex = /t\(['"]([^'"]+)['"]/g;
      let match;
      while ((match = regex.exec(fileContent)) !== null) {
        const key = match[1];
        if (!keysInLocale.has(key)) {
          if (!missingKeys[locale]) missingKeys[locale] = [];
          missingKeys[locale].push(key);
        }
      }
    });
  });

  return missingKeys;
}

/**
 * Ensures AI translation preserves dynamic variables like {{count}}, {{days}}, etc.
 * @param {string} text - The text to be translated.
 * @returns {string} - The sanitized text with variables preserved.
 */
export function sanitizeForTranslation(text: string): string {
  return text.replace(/{{\s*[\w]+\s*}}/g, (match) => `__VAR__${match}__VAR__`);
}
