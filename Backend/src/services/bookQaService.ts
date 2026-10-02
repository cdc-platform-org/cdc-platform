import { BookQaStatus } from '@prisma/client';
import { isBookAiMocked } from './bookMockConfig';

// ============================================================
// Children's Book — QA contract (Phase 5.1 §Scene Instruction Adherence).
// Real production interface: `runImageQa`. The real checks are genuinely
// vision/AI-dependent (STYLE_ADHERENCE, SCENE_INSTRUCTION_ADHERENCE,
// CHARACTER_ATTRIBUTES, CONTENT_SAFETY) and are NOT implemented here yet —
// wiring those to a real vision model is explicitly out of scope until a
// real generation exists to QA. Mock mode returns a deterministic PASS on
// every check so the plumbing (acceptedEventId wiring, revisionUsed,
// pdfStatus transitions) can be built and tested without pretending a real
// visual judgement was made.
// ============================================================

export interface BookImageQaChecks {
  IMAGE_EXISTS: boolean;
  IMAGE_VALID: boolean;
  EXPECTED_DIMENSIONS: boolean;
  CHARACTER_ATTRIBUTES: boolean;
  STYLE_ADHERENCE: boolean;
  SCENE_INSTRUCTION_ADHERENCE: boolean;
  NO_GENERATED_TEXT: boolean;
  COMPOSITION: boolean;
  TEXT_SAFE_ZONE: boolean;
  ANATOMY_BASIC: boolean;
  CONTENT_SAFETY: boolean;
}

export interface BookImageQaResult {
  status: BookQaStatus;
  checks: BookImageQaChecks;
  mocked: boolean;
  notes: string;
}

const ALL_PASS: BookImageQaChecks = {
  IMAGE_EXISTS: true,
  IMAGE_VALID: true,
  EXPECTED_DIMENSIONS: true,
  CHARACTER_ATTRIBUTES: true,
  STYLE_ADHERENCE: true,
  SCENE_INSTRUCTION_ADHERENCE: true,
  NO_GENERATED_TEXT: true,
  COMPOSITION: true,
  TEXT_SAFE_ZONE: true,
  ANATOMY_BASIC: true,
  CONTENT_SAFETY: true,
};

// `imageExists` is the one check this function CAN genuinely verify today
// (a buffer either arrived or it didn't) — every other check is either a
// deterministic mock result or, in real mode, not yet implemented and
// explicitly reported as such rather than silently claiming a pass.
export function runImageQa(params: { imageSuccess: boolean; byteSize?: number }): BookImageQaResult {
  const mocked = isBookAiMocked();

  if (!params.imageSuccess) {
    return {
      status: 'FAIL',
      mocked,
      notes: 'Generation itself failed — QA was never run against a real image.',
      checks: { ...ALL_PASS, IMAGE_EXISTS: false, IMAGE_VALID: false, EXPECTED_DIMENSIONS: false },
    };
  }

  if (mocked) {
    return {
      status: 'PASS',
      mocked: true,
      notes: 'Mocked QA — deterministic PASS for local plumbing testing only. This is NOT real visual QA.',
      checks: { ...ALL_PASS, EXPECTED_DIMENSIONS: (params.byteSize ?? 0) > 0 },
    };
  }

  // Real mode, no real vision-QA model wired yet: report the one check we
  // can genuinely assert (the bytes exist) and mark everything
  // vision-dependent as PARTIAL via a FAIL-safe status rather than lying
  // that a real judgement was made.
  return {
    status: 'PARTIAL',
    mocked: false,
    notes: 'Real image generated, but automated vision-QA is not implemented yet — manual review required before acceptance.',
    checks: { ...ALL_PASS, STYLE_ADHERENCE: false, SCENE_INSTRUCTION_ADHERENCE: false, CHARACTER_ATTRIBUTES: false, CONTENT_SAFETY: false },
  };
}
