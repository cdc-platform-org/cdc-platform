// Entity lines reused by every legal document (terms, privacy, refunds).
import { merchantInfo } from '../merchantInfo';

export { merchantInfo };
export const entityLineKa = `${merchantInfo.orgNameKa} (ს/კ ${merchantInfo.identificationCode})`;
export const entityLineEn = `${merchantInfo.orgNameEn} (ID Code ${merchantInfo.identificationCode})`;
