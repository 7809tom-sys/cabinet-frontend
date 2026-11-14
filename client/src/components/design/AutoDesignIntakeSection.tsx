import {
  type AutoDesignIntake,
  UTILITY_QUESTIONS,
  PREFERENCE_OPTIONS,
  togglePreference,
  intakeMissing,
  type UtilityId,
  type PreferenceId,
  type IslandOrPeninsula,
} from "@/lib/autoDesignFifteenRules";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

export function AutoDesignIntakeSection(props: {
  intake: AutoDesignIntake;
  onChange: (next: AutoDesignIntake) => void;
}) {
  const { intake, onChange } = props;

  const missing = intakeMissing(intake);

  const constructionLine =
    intake.construction === "new"
      ? "More room to play with the dimensions."
      : intake.construction === "old"
        ? "The layout respects the existing walls and openings."
        : "Pick one before the layout math starts.";

  const setCanMove = (id: UtilityId, value: boolean) => {
    onChange({
      ...intake,
      canMove: { ...intake.canMove, [id]: value },
    });
  };

  const setIslandOrPeninsula = (value: IslandOrPeninsula) => {
    onChange({
      ...intake,
      islandOrPeninsula: value,
      peninsulaSide: value === "peninsula" ? intake.peninsulaSide : null,
    });
  };

  const setPeninsulaSide = (side: "left" | "right") => {
    onChange({ ...intake, peninsulaSide: side });
  };

  return (
    <section
      data-testid="auto-design-intake"
      className="grid gap-3 rounded-lg border border-[#d7a46c]/60 bg-[#fffdf9] p-3"
    >
      {/* Step 1 · New or old construction (rule 11) */}
      <div className="grid gap-2">
        <p className="text-sm font-semibold text-[#244338]">
          Step 1 · New or old construction
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={intake.construction === "new" ? "default" : "outline"}
            aria-pressed={intake.construction === "new"}
            data-testid="intake-construction-new"
            onClick={() => onChange({ ...intake, construction: "new" })}
          >
            New construction
          </Button>
          <Button
            type="button"
            size="sm"
            variant={intake.construction === "old" ? "default" : "outline"}
            aria-pressed={intake.construction === "old"}
            data-testid="intake-construction-old"
            onClick={() => onChange({ ...intake, construction: "old" })}
          >
            Old construction
          </Button>
        </div>
        <p className="text-xs text-neutral-500">{constructionLine}</p>
      </div>

      {/* Step 2 · Utilities and wiggle room (rule 2) */}
      <div className="grid gap-2">
        <p className="text-sm font-semibold text-[#244338]">
          Step 2 · Utilities and wiggle room
        </p>
        <p className="text-xs text-neutral-500">
          Yes keeps the standard 3 in wiggle room each way. No locks it where it is.
        </p>
        <div className="grid gap-2">
          {UTILITY_QUESTIONS.map((q) => {
            const value = intake.canMove[q.id];
            return (
              <div key={q.id} className="grid gap-1">
                <p className="text-xs font-bold text-[#244338]">{q.label}</p>
                <p className="text-xs text-neutral-600">{q.question}</p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={value === true ? "default" : "outline"}
                    aria-pressed={value === true}
                    data-testid={`intake-move-${q.id}-yes`}
                    onClick={() => setCanMove(q.id, true)}
                  >
                    Yes
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={value === false ? "default" : "outline"}
                    aria-pressed={value === false}
                    data-testid={`intake-move-${q.id}-no`}
                    onClick={() => setCanMove(q.id, false)}
                  >
                    No
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step 3 · What the customer wants (rule 12) */}
      <div className="grid gap-2">
        <p className="text-sm font-semibold text-[#244338]">
          Step 3 · What the customer wants
        </p>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="outline"
              data-testid="intake-preferences-trigger"
            >
              Pick options ({intake.preferences.length} selected)
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuLabel>Customer preferences</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {PREFERENCE_OPTIONS.map((opt) => (
              <DropdownMenuCheckboxItem
                key={opt.id}
                checked={intake.preferences.includes(opt.id)}
                onCheckedChange={(checked) =>
                  onChange(togglePreference(intake, opt.id, checked === true))
                }
                onSelect={(e) => e.preventDefault()}
              >
                <span className="flex flex-col">
                  <span>{opt.label}</span>
                  <span className="text-xs text-neutral-500">{opt.hint}</span>
                </span>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {intake.preferences.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {intake.preferences.map((id: PreferenceId) => {
              const opt = PREFERENCE_OPTIONS.find((o) => o.id === id);
              return (
                <span
                  key={id}
                  data-testid={`intake-pref-chip-${id}`}
                  className="rounded-full bg-[#f6f3ed] px-2 py-0.5 text-xs text-[#244338]"
                >
                  {opt ? opt.label : id}
                </span>
              );
            })}
          </div>
        ) : null}

        <div className="grid gap-2">
          <Select
            value={intake.islandOrPeninsula}
            onValueChange={(value) => setIslandOrPeninsula(value as IslandOrPeninsula)}
          >
            <SelectTrigger size="sm" aria-label="Island or peninsula">
              <SelectValue placeholder="Island or peninsula" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Neither</SelectItem>
              <SelectItem value="island">Island</SelectItem>
              <SelectItem value="peninsula">Peninsula</SelectItem>
            </SelectContent>
          </Select>

          {intake.islandOrPeninsula === "peninsula" ? (
            <Select
              value={intake.peninsulaSide ?? undefined}
              onValueChange={(value) => setPeninsulaSide(value as "left" | "right")}
            >
              <SelectTrigger size="sm" aria-label="Peninsula wall">
                <SelectValue placeholder="Peninsula wall" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Left wall</SelectItem>
                <SelectItem value="right">Right wall</SelectItem>
              </SelectContent>
            </Select>
          ) : null}
        </div>
      </div>

      {/* Missing answers */}
      {missing.length > 0 ? (
        <ul data-testid="intake-missing" className="grid gap-1">
          {missing.map((sentence) => (
            <li key={sentence} className="text-xs font-medium text-[#244338]">
              {sentence}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
