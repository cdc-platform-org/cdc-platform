# Narration and approved-text illustration checks

Georgian and English lesson/forum/tutor narration, A1 pronunciation and Smart Reader now prefer Azure neural speech. An installed browser voice in the matching language remains the fallback. Short pronunciation exercises synthesize the requested pace; long narration preserves pitch when playback speed changes. Long text is split into bounded requests rather than truncated. POST requests keep narration out of query strings; the original GET endpoint remains compatible.

Frontend and Backend use identical SSML preparation, enforced by a regression test. Semantic paragraph markup lets the voice choose paragraph pauses. Books use a gentle 0.96 pace; A1's slow option is 0.8 instead of 0.55. The English book default is Jenny; an explicit `AZURE_SPEECH_VOICE_EN` still takes precedence. Book and Media Studio synthesis apply a narrative style only when Azure's voice list advertises it for that exact voice. Georgian voices without an expressive style use their normal neural intonation.

Final book illustrations require a valid `storyPlan.textApprovedAt` and text for every page. The approved words remain in every generation attempt, including content-filter retries. Reference sheets establish appearance and cannot override page-specific species, setting or action.

Each generated page and proposed revision is decoded and sent, with its approved page text, to the existing Azure multimodal chat service for structured visual review. All required scene, character/species, action, contradiction, safety and printed-text checks must pass. Failed scenes provide corrective feedback for bounded regeneration, retained across automatic rounds. An unavailable or malformed review stops the run without accepting images or finishing the PDF. Invalid image bytes can be regenerated. A failed revision preserves the previous accepted image and does not consume the free revision. Review results are saved in page scene metadata; no schema migration is needed.

## Configuration and limits

- Frontend and Backend each need their existing `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` settings for cloud speech. Optional book voices remain `AZURE_SPEECH_VOICE` and `AZURE_SPEECH_VOICE_EN`.
- Both configured Azure chat deployments used by the existing failover service must accept image input and JSON responses. Scene review adds a chat request per generated candidate within the existing bounded image-attempt budget. An outage does not bypass review.
- Visual review is probabilistic and does not guarantee perfect illustrations. The existing reader and revision workflow remain available for human review.
- Existing stored MP3s and already accepted illustrations are not automatically regenerated. New generation/revision uses the updated pipeline. Legacy projects without explicit text approval cannot start a new final illustration run.
- Local Azure Speech is unconfigured, so live voice samples and subjective listening were not verified. Tests mock provider calls and incur no AI-provider charges. Nothing was deployed.

## Validation

Frontend typecheck and production build, and Backend TypeScript build passed. Twelve focused Backend suites cover narration, visual review, book recovery, revisions, payments and audio. The eight Frontend narration regressions include actual Chromium component checks for pausing during synthesis, preserving speed across chunks and rejecting stale responses.

Run Frontend narration checks with `node node_modules/@playwright/test/cli.js test --config=playwright.narration.config.ts` from `Frontend`; they require no running app or login. Backend checks use Jest and the existing disposable PostgreSQL test database.
