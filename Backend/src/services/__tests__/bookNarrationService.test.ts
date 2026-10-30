import {
  AUDIO_ADDON_PRICE_TETRI,
  calculateAudioPrice,
  calculateTotalBookPrice,
  canGenerateNarration,
  buildNarrationArtifactKey,
} from '../bookNarrationService';

describe('children book audio addon pricing', () => {
  it('uses a fixed +5 GEL addon and totals are book + audio', () => {
    expect(AUDIO_ADDON_PRICE_TETRI).toBe(500);
    expect(calculateAudioPrice(true)).toBe(500);
    expect(calculateAudioPrice(false)).toBe(0);
    expect(calculateTotalBookPrice(500, true)).toBe(1000);
    expect(calculateTotalBookPrice(1000, true)).toBe(1500);
    expect(calculateTotalBookPrice(1500, true)).toBe(2000);
    expect(calculateTotalBookPrice(2000, true)).toBe(2500);
  });

  it('gates narration to audio-enabled books after payment', () => {
    expect(canGenerateNarration({ audioAddOnPurchased: false, paymentStatus: 'PAID' })).toBe(false);
    expect(canGenerateNarration({ audioAddOnPurchased: true, paymentStatus: 'CHARACTER_APPROVED' })).toBe(false);
    expect(canGenerateNarration({ audioAddOnPurchased: true, paymentStatus: 'PAID' })).toBe(true);
    expect(canGenerateNarration({ audioAddOnPurchased: true, paymentStatus: 'FINAL_READY' })).toBe(true);
  });

  it('keeps narration page identity stable and deterministic', () => {
    expect(buildNarrationArtifactKey({ bookProjectId: 'b1', pageNumber: 3, revisionVersion: 0 })).toBe('b1:page:3:0');
    expect(buildNarrationArtifactKey({ bookProjectId: 'b1', pageNumber: 3, revisionVersion: 1 })).toBe('b1:page:3:1');
  });
});
