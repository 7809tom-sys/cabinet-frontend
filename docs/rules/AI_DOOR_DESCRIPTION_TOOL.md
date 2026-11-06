# AI door-description comparison

A door-editor tool for comparing GPT, Claude, and Gemini descriptions of one door photo, previewing each, and writing the answer into the door's own description field.

**Door editor only.** It is mounted in the admin edit dialog (`FeaturedStylesAdmin.tsx`) and is not on the public Door Styles page.

## How it works

1. The operator presses **Compare descriptions**. Nothing runs before that: the panel mounts collapsed and reads no storage and no text until the button is pressed.
2. Each of the three columns holds a **pre-loaded standing prompt** (GPT, Claude, Gemini). Pressing **Generate** is the only step: the server runs that prompt — with the operator's own instructions from the door's description field appended — and the answer fills that column.
3. A column's mini preview draws the door from what that text actually says. **A column with no text draws no door at all**: there is no placeholder outline and no default front waiting to be mistaken for a result.
4. **The answer lands in the door's own Profile Description field**, the same field the operator typed their instructions into. The panel keeps its copy, so all three answers stay readable and comparable. The editor's normal **Save** persists the field with the rest of the profile.
5. **Choose as official** records one description as the official profile: it fills the editor's profile fields from the winner, keeps the other two as reference, and the **3D Designer redraws the door from the choice straight away**.
6. Nothing runs on its own. Opening the panel and typing in a box never call a model; only the **Generate** button in a column does.

## The status indicator

Each column shows its state beside the model's label, from one `generated[model]` record:

| State | Looks like | Means |
|---|---|---|
| waiting | amber pill, spinner, "Sending to AI…" | the call is in flight |
| saving | amber pill, spinner, "Saving to the door field…" | the model answered; the text is being handed to the door record |
| saved | **green check**, "Description received and saved to the door field" | the text is really in the door's field |
| failed | red pill, a specific reason, plus the plain sentence | see the reasons below |
| not connected | amber pill, "AI not connected" | a key is missing — a setup message, not an alarm |

Green is only set once the handoff into the door field actually succeeded. A model reply on its own is never reported as success: if the editor could not take the text, the column shows `handoff-failed` ("Not saved to the door field") instead.

The specific failure reasons are `not-connected`, `timeout`, `rate-limited`, `empty-response`, `handoff-failed`, and `provider-error` (with the model's own message when it sent one). No state is ever just the word "error".

## Generate: where the model call lives

The button is a server call, never a browser one. The browser holds no provider key and sends none.

| Column | Procedure | Server key | Where the key is set |
|---|---|---|---|
| GPT | `aiDoorDescription.describeWithAi` (`model: "gpt"`) | `OPENAI_API_KEY` | cabinet-backend on Railway |
| Claude | `aiDoorDescription.describeWithAi` (`model: "claude"`) | `ANTHROPIC_API_KEY` | cabinet-backend on Railway |
| Gemini | `aiDoorDescription.describeWithAi` (`model: "gemini"`) | `GEMINI_API_KEY` | cabinet-backend on Railway (already set for image work) |

The API is the separate **cabinet-backend** repository. This repo (frontend) carries:

- `shared/aiDoorPrompts.ts` — the three standing prompts, and the field list they ask for.
- `shared/aiDoorDescribe.ts` — the request/result contract, the procedure path, the environment variable each column reads, the prompt composer that appends the operator's instructions, and the plain message plus specific reason per outcome.
- `client/src/lib/aiDoorDescribeClient.ts` — the one call, from the button.

The server side is `docs/patches/cabinet-backend-ai-door-description.patch` in this repo: `server/lib/aiDoorDescribe.ts` (provider calls), `server/routers/aiDoorDescription.ts` (the tRPC boundary), and its tests. It must be applied and deployed before the button can answer; until then the column says so in plain words rather than failing silently.

The prompt is capped at 6,000 characters and only the three known models are accepted, so the procedure cannot be used as a general-purpose model proxy. It is admin-only.

**A missing key is data, not an error.** The procedure answers `{ status: "not-connected" }` with one plain sentence ("Claude isn't connected yet. Add ANTHROPIC_API_KEY on the API server."), and the column shows it as a status, not a red alarm.

Photo: when the door has a sample image, its stored URL travels with the prompt and the server loads the bytes with the service-role key. Without a photo the prompt is still sent, with an added instruction to say "not visible" rather than guess, so a generated description is no more inventive than a pasted one.

## Prompts: pre-loaded and standing

`AI_DOOR_PROMPTS` in `shared/aiDoorPrompts.ts`. Each prompt is a **constant that is already loaded**, so pressing **Generate** is the only step — there is no button, dialog, or extra action to compose or submit a prompt.

Every prompt names the reader: *the 3D Designer in our cabinet software, which builds the actual door in the photograph from the description alone*. It then asks for one labelled line per field, in this order, because that is what `parseAiDoorDescription` reads:

| Field | Read by |
|---|---|
| Style family | `doorRenderIdentity.ts`, `doorLibraryProfiles.ts` |
| Frame construction (five-piece / slab / glass, mitered or cope-and-stick) | `doorRenderIdentity.ts`, `raisedPanelDoorBlueprint.ts` |
| Stile width | `doorFrameMetrics.ts`, `doorStyleAppearance.ts` |
| Rail width | `doorFrameMetrics.ts`, `doorStyleAppearance.ts` |
| Top rail / Bottom rail / Mid rail | requested for the rebuild; the parser does not yet map these |
| Panel type (flat / raised / recessed / slab) | `doorStyleAppearance.ts`, `raisedPanelDoorBlueprint.ts` |
| Bevel width | `doorStyleAppearance.ts`, `raisedPanelDoorBlueprint.ts` |
| Panel profile | requested for the rebuild |
| Door outside profile (edge treatment) | requested for the rebuild |
| Inside edge (sticking profile) | `doorStyleAppearance.ts` |
| Moulding (applied) | description parser (`molding`) |
| Beads and grooves | requested for the rebuild |
| Finish (painted / stained) | `paintedFinish.ts`, `shakerDoorBlueprint.ts` |
| Color — in words, never a hex | `doorColorResolve.ts` |
| Sheen | `doorStyleAppearance.ts` |
| Undertone | description parser (`undertone`) |
| Grain direction | `doorStyleAppearance.ts` |
| Material / species | `shakerDoorBlueprint.ts` |
| Door proportions | requested for the rebuild |

Every prompt tells the model to write "not visible" rather than guess, so an unstated value stays `null` and the library default is drawn instead of an invented number.

**No drawer front is requested.** The Designer reads this text as *construction* words, and `doorProfileIsSlabOrGlass` scans them for "slab" and "glass". A raised-panel door whose drawer front was described as "slab" would therefore lose its raised-panel blueprint entirely. The drawer front has its own field in the editor instead.

### The operator's own instructions

The text in the door's **Profile Description** field is appended to the standing prompt, so what the operator types actually reaches the model. The composed prompt is capped at the server's 6,000-character limit, and the standing prompt always survives intact — only the instruction is clipped.

The text is also sent as its own `instructions` key. **The deployed router does not declare that key yet, so it is stripped today**; the text still arrives because it is inside `prompt`. To use it natively the backend needs one addition to `server/routers/aiDoorDescription.ts`:

```ts
instructions: z.string().max(4_000).nullable().optional(),
```

and, in `describeDoorWithAi`, the same append (`composeAiDoorPrompt`-equivalent) on the server side. Until then the frontend stays backward compatible: when the field is empty, no `instructions` key is sent at all.

The AI's own previous answer is never re-sent as an instruction. The editor remembers the last description it wrote into the field and treats that text as an answer, not as operator input, so one model's words cannot drift the next model's answer.

## Parsing: nothing is invented

`parseAiDoorDescription` reads the text into profile parameters. A parameter the text does not state stays **null** and is listed in `unstated`, so the preview and the record both show what is actually known.

- Dimensions parse from inches (`2 1/2 in`, `2.75"`, `3 inches`). No measurement means no value.
- "not visible", "unknown", "n/a", and "cannot tell" are treated as unstated, not as values.
- Family is checked raised panel → slab → shaker, so "a raised shaker-style panel" is raised and "slab-fronted shaker look" is a slab.
- An unstated dimension draws at the library default (`raisedPanelFrameGeometry` and the shaker blueprint supply it), and the column says so in plain words.

A generated description goes through this same parser. Nothing about it is trusted more than a pasted one.

## Previews

`client/src/lib/aiDoorPreview.ts` draws one door front with the same proportions the renderer uses:

- `raisedPanelFrameGeometry` supplies the frame widths, bevel width, and raised-center inset.
- The shaker entry uses the same frame arithmetic with a flat center.
- A painted face is solid; a stained one shows grain lines.

**No text, no preview.** The preview is rendered only for a column whose paste box holds real (non-whitespace) text. An empty column shows its controls and its empty field, and nothing that could read as a door.

The color always comes from `resolveDoorColor`, so an accepted render wins and nothing is snapped to the brand palette. A description's own color words are shown as text beside the preview, never converted into a hex.

Door and drawer fronts only: the preview draws a front, never a cabinet side or end.

## The official record

`chooseOfficialAiDescription` builds the record: the winning model, its description, its parsed parameters, its unstated list, and the other two descriptions by model name.

**Choose as official** then fills the door editor's own fields from the record through `officialRecordAsStylePatch`, writing only values the description actually stated. The editor's normal **Save** persists them with the rest of the profile, so the existing `doorStyles.adminUpdateDoorStyle` path does the saving and nothing else has to change.

## Seeing the choice on the actual door

Save is still the only write. Tom also wants to see the choice on the door he is looking at without waiting for a reload, so the choice is bridged into the Designer:

- `shared/aiDoorChosenProfile.ts` keeps one browser record per style with **only the values the description stated** — profile family, construction, rail/stile/bevel widths, inside edge, sheen, grain, and the winning text.
- `client/src/lib/useChosenDoorProfiles.ts` merges that record onto the door-style rows the Designer already holds, for the active style and for every placed cabinet. The 3D door and the elevation redraw from it on the next frame.
- The record is dropped as soon as the saved row already carries every value in it, so an old choice can never shadow a newer catalog edit.

Two things the bridge never does:

- **Color is not in the record.** Color precedence stays with `resolveDoorColor`: an accepted render still wins, nothing snaps to the brand palette, and a description's color words remain text on the profile.
- **No value is defaulted.** An unstated measurement is absent, so the renderer keeps the library's own default — "don't put something in if you don't know".

## Color description

A plain-text field on the door profile (`DoorColorDescriptionField`) for what a hex cannot say: sheen, undertone, and the finish in words, e.g. *"warm ivory with a soft matte, low-luster finish, slight cream undertone"*.

Blank by default. It is never derived from a color name or a hex, and nothing guesses it.

## Storage

Browser draft today, following the pattern the door editor already uses for `doorSkin` and glazing: `shared/aiDoorDescriptionStore.ts` keeps, per style, the three pasted or generated descriptions, which one won, and the reference copies — plus the color description.

`docs/sql/0247_door_style_ai_description.tidb.sql` holds the two columns that would replace this store (`colorDescription`, `doorAiDescription`). **That file is not run against production.** It only adds nullable columns, inserts nothing, and backfills nothing.

## Rules that still hold

- Shaker from any distributor — including DL — defaults to the library profiles unless a WalzCraft wizard record exists; the wizard overrides. See `docs/rules/SHAKER_DOOR_RULE.md`.
- The WalzCraft wizard stays only in the door editor. The comparison tool does not touch its storage.
- No color snapping to the brand palette. A chosen description never carries a hex.
- The profile goes on door and drawer fronts only.
- No provider key is ever in the browser: not in a component, not in the bundle, not in a `VITE_` variable, not in a request.

## Tests

- `shared/aiDoorDescription.test.ts` — the standing prompts name the 3D Designer as the reader, ask for every field the door builder reads, require a flat labelled line per field, never ask for a drawer front, never ask for a hex, the parser, the unstated list, the official choice, the reference copies, and the color description.
- `shared/aiDoorDescribe.test.ts` — the Generate contract: the prompt is pre-loaded, the operator's instructions are appended and capped and also sent as their own key (and left out entirely when empty), every failure carries a specific reason with its own label and sentence, a build without the procedure answers plainly, and no key reaches the bundle.
- `shared/aiDoorChosenProfile.test.ts` — the choice bridge: only stated values travel, color and the accepted-render marker are untouched, a caught-up draft stops applying, and the Designer is wired to it.
- `client/src/components/admin/AiDoorDescriptionCompare.test.tsx` — the three columns render with no separate prompt step, **nothing calls a model on open**, **no preview while a column is empty**, **Generate fills that column's box only**, **the reply is handed to the door field through `onDescription`**, **green only after the handoff**, **a handoff failure is reported as one**, **each status renders (waiting, saved, not-connected, timeout, rate-limited, empty-response)**, the instructions are included in the request, previews update from pasted text, and choosing official persists the winner and keeps the others.
- `client/src/components/admin/AiDoorDescriptionCompare.editor.test.ts` — the tool is in the door editor only, one Generate call site wired to the button, no key in the file, the preview is gated on text, and the designer wiring is in place.
- `client/src/components/admin/FeaturedStylesAdmin.aiDescriptionHandoff.test.ts` — **the generated text reaches `profileDescription`**, the field's text travels as instructions, the AI's own previous answer is never fed back as an instruction, and the citation gate, the wizard, and color precedence are untouched.
- `client/src/lib/aiDoorPreview.test.ts` — preview geometry from the shipped blueprints, and no brand-palette snap.
