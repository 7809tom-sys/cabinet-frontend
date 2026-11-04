# AI door-description comparison

A door-editor tool for comparing GPT, Claude, and Gemini descriptions of one door photo, previewing each, and keeping the best one as the door's official profile.

**Door editor only.** It is mounted in the admin edit dialog (`FeaturedStylesAdmin.tsx`) and is not on the public Door Styles page.

## How it works

1. The operator presses **Compare descriptions**. Nothing runs before that: the panel mounts collapsed and reads no storage and no text until the button is pressed.
2. Each of the three columns holds a tailored prompt (GPT, Claude, Gemini). The operator copies a prompt, runs it in that model, and pastes the answer into that column.
3. Under each pasted description a mini preview draws the door from what that text actually says. The three previews sit side by side.
4. **Choose as official** records that description as the door's profile. The other two are kept as reference.

There are no AI API calls. This is a paste-back workflow: the tool only reads text the operator pasted.

## Prompts

`AI_DOOR_PROMPTS` in `shared/aiDoorDescription.ts`. Each prompt is tailored per model but asks for the same comparable fields: profile/style family, frame and rail/stile, panel type (flat, raised, recessed), edge/bevel details, mitered vs cope-and-stick, molding, grain vs painted, sheen, undertone, and color.

Every prompt tells the model to write "not visible" rather than guess, and to give color in words — explicitly not a hex code.

## Parsing: nothing is invented

`parseAiDoorDescription` reads the text into profile parameters. A parameter the text does not state stays **null** and is listed in `unstated`, so the preview and the record both show what is actually known.

- Dimensions parse from inches (`2 1/2 in`, `2.75"`, `3 inches`). No measurement means no value.
- "not visible", "unknown", "n/a", and "cannot tell" are treated as unstated, not as values.
- Family is checked raised panel → slab → shaker, so "a raised shaker-style panel" is raised and "slab-fronted shaker look" is a slab.
- An unstated dimension draws at the library default (`raisedPanelFrameGeometry` and the shaker blueprint supply it), and the column says so in plain words.

## Previews

`client/src/lib/aiDoorPreview.ts` draws one door front with the same proportions the renderer uses:

- `raisedPanelFrameGeometry` supplies the frame widths, bevel width, and raised-center inset.
- The shaker entry uses the same frame arithmetic with a flat center.
- A painted face is solid; a stained one shows grain lines.

The color always comes from `resolveDoorColor`, so an accepted render wins and nothing is snapped to the brand palette. A description's own color words are shown as text beside the preview, never converted into a hex.

Door and drawer fronts only: the preview draws a front, never a cabinet side or end.

## The official record

`chooseOfficialAiDescription` builds the record: the winning model, its description, its parsed parameters, its unstated list, and the other two descriptions by model name.

**Choose as official** then fills the door editor's own fields from the record through `officialRecordAsStylePatch`, writing only values the description actually stated. The editor's normal **Save** persists them with the rest of the profile, so the existing `doorStyles.adminUpdateDoorStyle` path does the saving and nothing else has to change.

## Color description

A plain-text field on the door profile (`DoorColorDescriptionField`) for what a hex cannot say: sheen, undertone, and the finish in words, e.g. *"warm ivory with a soft matte, low-luster finish, slight cream undertone"*.

Blank by default. It is never derived from a color name or a hex, and nothing guesses it.

## Storage

Browser draft today, following the pattern the door editor already uses for `doorSkin` and glazing: `shared/aiDoorDescriptionStore.ts` keeps, per style, the three pasted descriptions, which one won, and the reference copies — plus the color description.

`docs/sql/0247_door_style_ai_description.tidb.sql` holds the two columns that would replace this store (`colorDescription`, `doorAiDescription`). **That file is not run against production.** It only adds nullable columns, inserts nothing, and backfills nothing.

## Rules that still hold

- Shaker from any distributor — including DL — defaults to the library profiles unless a WalzCraft wizard record exists; the wizard overrides. See `docs/rules/SHAKER_DOOR_RULE.md`.
- The WalzCraft wizard stays only in the door editor. The comparison tool does not touch its storage.
- No color snapping to the brand palette.
- The profile goes on door and drawer fronts only.

## Tests

- `shared/aiDoorDescription.test.ts` — the prompts, the parser, the unstated list, the official choice, the reference copies, the color description.
- `client/src/components/admin/AiDoorDescriptionCompare.test.tsx` — the three fields render, the previews update from pasted text, choosing official persists the winner and keeps the others, nothing runs on open, the color description saves.
- `client/src/components/admin/AiDoorDescriptionCompare.editor.test.ts` — the tool is in the door editor only, and the wizard stays where it was.
- `client/src/lib/aiDoorPreview.test.ts` — preview geometry from the shipped blueprints, and no brand-palette snap.
