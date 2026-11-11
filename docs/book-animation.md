# Children's book — animated video add-on

A paid add-on (10 GEL; `ANIMATION_PRICE_TETRI` in `bookAnimationPlan.ts`) that turns a finished book (`FINAL_READY` / `COMPLETED`) into a 1280×720 H.264/AAC MP4.

## What the video contains

- **Cover + every page.** Each illustration is placed on a 16:9 frame over a blurred copy of itself, so portrait and square art keep their shape.
- **4 Sora moments.** The cover and the 3 most dramatic pages (chosen by the text model, with evenly spaced pages as the fallback) are animated with Azure OpenAI **Sora 2** image-to-video: 8 s, 1280×720, the page as the first frame, and a prompt asking for gentle motion only, no text and no new characters. Sora's own audio is dropped. Each clip gets at most 2 tries. If a clip fails, or Sora isn't configured, that page falls back to Ken Burns. The video itself never fails because of Sora.
- **Ken Burns** (slow zoom/pan, 4 alternating variants) on every other page. Pages are joined with crossfade / slide transitions.
- **Narration.** Uses the book's own per-page narration (Azure Speech, ka-GE / en-US). Pages without narration, and the title, are narrated during the render with the same voice. These clips are not saved as narration artifacts, because narration stays the separate audio add-on. Each page lasts as long as its narration, with a minimum of about 4 s.
- **Page text** as a subtitle bar, and the **title** on the cover. Text is drawn with FiraGO, which covers both Georgian and Latin.
- **Music.** A quiet music-box lullaby that gets quieter whenever narration plays.

### Music licence

The music is **synthesised by code** in `Backend/src/services/bookAnimationMusic.ts` (3 variations: key, tempo and chord progression). No third-party audio is bundled, so no external licence applies. It is original work under the repository's own terms.

## Flow

| Status | Meaning |
| --- | --- |
| `PAYMENT_PENDING` | Checkout created (`POST /api/childrens-books/:id/animation`), waiting for BOG |
| `QUEUED` | Paid (BOG callback, 100% promo, admin, or dev simulation) |
| `RENDERING` | The background job is running (one render per process at a time) |
| `READY` | `videoKey` is stored in book storage (`books/<bookId>/animation/<id>-v<n>.mp4`) |
| `FAILED` | Paid rows are retried once automatically at startup. The owner can retry for free. |

- On startup, `resumeBookAnimations()` restarts `QUEUED` and `RENDERING` rows (cut off by a deploy) and gives a paid `FAILED` row one automatic retry (`autoRetried`).
- **Payment:** BOG purpose `BOOK_ANIMATION`, with `referenceId` = the book id. Promo codes and gift cards work through `AI_TOOL` / `book-animation`. `ALL` codes also apply.
- **Admin testing:** `POST /api/childrens-books/:id/animation/admin-render` (`SUPER_ADMIN` / `MANAGER`), body `{ "force": true }` to re-render a ready video. It's free.
- **Playback:** `GET /:id/animation` returns `videoUrl` and `downloadUrl`. In cloud storage the player uses a 2-hour SAS URL. Otherwise, and for every download, it uses an HMAC-signed backend link (`/api/childrens-books/animation-video/:id?exp&sig`, with Range support).
- **Share page:** `GET /api/childrens-books/shared/:token/animation` returns the video only when it's `READY` and sharing is on.

## Sora availability

Azure's model retirement schedule lists `sora-2` (2025-12-08, Preview) as retired on **2026-10-15** with no replacement. Until another video model is deployed, the add-on renders every page with Ken Burns. That is why the price is 10 GEL and not 20 GEL. The buy card only promises "AI animation" when `soraEnabled` is true, which means `AZURE_VIDEO_*` is set and AI isn't mocked. Otherwise it describes animated pages with narration and music. Turning Sora back on later only needs the env vars, no code change.

## Environment

| Variable | Default | |
| --- | --- | --- |
| `AZURE_VIDEO_ENDPOINT` | — | Azure OpenAI resource, e.g. `https://<res>.openai.azure.com` (`/openai/v1` is added) |
| `AZURE_VIDEO_API_KEY` | — | Sent as the `api-key` header |
| `AZURE_VIDEO_DEPLOYMENT` | `sora-2` | Sora 2 deployment name |
| `FFMPEG_PATH` | ffmpeg-static | Optional override |

Sora uses the v1 video jobs API: `POST /openai/v1/videos` (multipart `model`, `prompt`, `size=1280x720`, `seconds=8`, `input_reference`), then `GET /openai/v1/videos/{id}`, then `GET /openai/v1/videos/{id}/content`. Outside production, Sora is mocked (Ken Burns only) unless `BOOK_FORCE_REAL_AI=true`, which is the same rule as the rest of the book pipeline.

ffmpeg comes from `ffmpeg-static`, which is already a dependency and is copied into the Docker image with `node_modules`. No Dockerfile change is needed.

## Cost tracking

Every finished render logs one line, and the same numbers are stored on `book_animations` (`soraSecondsUsed`, `soraPages`, `renderMs`):

```
[book-animation] cost animation=<id> book=<id> soraSeconds=32 soraClips=4/4 durationSec=74.2 renderMs=… bytes=…
```

Only completed clips are counted (normally 4 × 8 s = 32 Sora seconds per book).

## QA

- `pnpm exec jest src/services/__tests__/bookAnimation`: page choice, timeline, Sora client, and a 3-page ffmpeg render.
- `pnpm exec ts-node -T scripts/render-book-animation-sample.ts <dir> <out.mp4>` renders from local files with no database.
