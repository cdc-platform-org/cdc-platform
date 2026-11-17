// Georgian strings for the admin panel, keyed by the English source text
// passed to at()/atf() (see ../runtime.ts). Enum badge values use the
// `enum:VALUE` key form (atEnum). Split by area to keep each file small;
// `npm run check:admin-i18n` fails when an at() string has no entry here.
import { KA_CONTENT } from './content';
import { KA_ENUMS } from './enums';
import { KA_FINANCE } from './finance';
import { KA_LEARNING } from './learning';
import { KA_MARKET } from './market';
import { KA_PEOPLE } from './people';
import { KA_SYSTEM } from './system';

export const KA: Record<string, string> = {
  ...KA_ENUMS,
  ...KA_SYSTEM,
  ...KA_PEOPLE,
  ...KA_LEARNING,
  ...KA_MARKET,
  ...KA_CONTENT,
  ...KA_FINANCE,
};
