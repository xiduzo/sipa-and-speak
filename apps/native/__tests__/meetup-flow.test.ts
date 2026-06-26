import { addDays, startOfDay } from "date-fns";

import { combineLocal, formatDayFull, toIsoDate } from "@/lib/dates";
import {
  ALL_SLOTS,
  buildSuggestions,
  freeSlotsFor,
  isValidTimeFormat,
  pickProposedScheduledAt,
  timeFromDate,
  validateProposedScheduledAt,
  validateScheduledAt,
  type ProposeSelection,
  type Suggestion,
} from "@/utils/meetup-flow";

// A fixed device-local day used throughout. Assertions compare against the same
// `combineLocal` / `toIsoDate` helpers the production code uses, so they hold
// regardless of the machine timezone Jest runs in.
const DATE = "2026-06-01";

const sel = (over: Partial<ProposeSelection> = {}): ProposeSelection => ({
  customMode: false,
  customDateIso: "",
  customTime: "",
  selectedSuggestionIdx: null,
  suggestions: [],
  ...over,
});

describe("ALL_SLOTS", () => {
  it("covers every half hour from 08:00 to 20:00 inclusive", () => {
    expect(ALL_SLOTS).toHaveLength(25);
    expect(ALL_SLOTS[0]).toBe("08:00");
    expect(ALL_SLOTS[ALL_SLOTS.length - 1]).toBe("20:00");
    expect(ALL_SLOTS).toContain("08:30");
    expect(ALL_SLOTS).toContain("14:00");
  });

  it("only contains well-formed HH:MM strings", () => {
    expect(ALL_SLOTS.every(isValidTimeFormat)).toBe(true);
  });
});

describe("isValidTimeFormat", () => {
  it("accepts two-digit HH:MM", () => {
    expect(isValidTimeFormat("14:00")).toBe(true);
    expect(isValidTimeFormat("08:30")).toBe(true);
  });

  it("rejects malformed shapes", () => {
    expect(isValidTimeFormat("9:00")).toBe(false);
    expect(isValidTimeFormat("14:0")).toBe(false);
    expect(isValidTimeFormat("1400")).toBe(false);
    expect(isValidTimeFormat("ab:cd")).toBe(false);
    expect(isValidTimeFormat("")).toBe(false);
  });

  it("checks shape only, not range (combineLocal rejects impossible values)", () => {
    expect(isValidTimeFormat("25:99")).toBe(true);
    expect(combineLocal(DATE, "25:99")).toBeNull();
  });
});

describe("timeFromDate", () => {
  it("round-trips a combineLocal instant back to its wall-clock HH:MM", () => {
    expect(timeFromDate(combineLocal(DATE, "14:00")!)).toBe("14:00");
    expect(timeFromDate(combineLocal(DATE, "08:30")!)).toBe("08:30");
  });
});

describe("buildSuggestions", () => {
  it("offers +1/+2/+4 days at the fixed coffee times", () => {
    const now = new Date("2026-06-01T09:00:00Z");
    const out = buildSuggestions(now);
    const base = startOfDay(now);

    expect(out).toHaveLength(3);
    expect(out.map((s) => s.time)).toEqual(["10:30", "14:00", "15:00"]);
    expect(out.map((s) => s.hint)).toEqual(["your usual coffee slot", undefined, undefined]);
    expect(out.map((s) => s.date)).toEqual([
      toIsoDate(addDays(base, 1)),
      toIsoDate(addDays(base, 2)),
      toIsoDate(addDays(base, 4)),
    ]);
    expect(out.map((s) => s.weekday)).toEqual([
      formatDayFull(addDays(base, 1)),
      formatDayFull(addDays(base, 2)),
      formatDayFull(addDays(base, 4)),
    ]);
  });

  it("defaults to the current day and yields well-formed cards", () => {
    const out = buildSuggestions();
    expect(out).toHaveLength(3);
    for (const s of out) {
      expect(s.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(isValidTimeFormat(s.time)).toBe(true);
      expect(s.weekday.length).toBeGreaterThan(0);
    }
  });
});

describe("freeSlotsFor", () => {
  it("returns every slot when nothing is blocked", () => {
    expect(freeSlotsFor(DATE, [])).toEqual(ALL_SLOTS);
  });

  it("removes a slot blocked by a Date instant", () => {
    const blocked = combineLocal(DATE, "10:30")!;
    const free = freeSlotsFor(DATE, [blocked]);
    expect(free).not.toContain("10:30");
    expect(free).toContain("10:00");
    expect(free).toHaveLength(ALL_SLOTS.length - 1);
  });

  it("accepts ISO strings as blocked instants too", () => {
    const blocked = combineLocal(DATE, "14:00")!.toISOString();
    expect(freeSlotsFor(DATE, [blocked])).not.toContain("14:00");
  });

  it("ignores unparseable blocked entries", () => {
    expect(freeSlotsFor(DATE, ["not-a-date"])).toEqual(ALL_SLOTS);
  });

  it("does not block a slot whose collision is on a different day", () => {
    const otherDay = combineLocal("2026-06-02", "10:30")!;
    expect(freeSlotsFor(DATE, [otherDay])).toContain("10:30");
  });

  it("returns an empty list when the date itself is malformed", () => {
    expect(freeSlotsFor("nonsense", [])).toEqual([]);
  });
});

describe("pickProposedScheduledAt", () => {
  it("resolves a valid custom date + time", () => {
    const got = pickProposedScheduledAt(
      sel({ customMode: true, customDateIso: DATE, customTime: "14:00" }),
    );
    expect(got?.getTime()).toBe(combineLocal(DATE, "14:00")!.getTime());
  });

  it("returns null for a custom selection missing the date", () => {
    expect(
      pickProposedScheduledAt(sel({ customMode: true, customDateIso: "", customTime: "14:00" })),
    ).toBeNull();
  });

  it("returns null for a custom selection with a malformed time", () => {
    expect(
      pickProposedScheduledAt(sel({ customMode: true, customDateIso: DATE, customTime: "2pm" })),
    ).toBeNull();
  });

  it("resolves the chosen suggestion in suggested mode", () => {
    const suggestions: Suggestion[] = [
      { date: DATE, time: "10:30", weekday: "Monday" },
      { date: DATE, time: "14:00", weekday: "Monday" },
    ];
    const got = pickProposedScheduledAt(sel({ selectedSuggestionIdx: 1, suggestions }));
    expect(got?.getTime()).toBe(combineLocal(DATE, "14:00")!.getTime());
  });

  it("returns null when no suggestion is selected", () => {
    expect(pickProposedScheduledAt(sel({ selectedSuggestionIdx: null }))).toBeNull();
  });

  it("returns null when the selected index is out of range", () => {
    const suggestions: Suggestion[] = [{ date: DATE, time: "10:30", weekday: "Monday" }];
    expect(pickProposedScheduledAt(sel({ selectedSuggestionIdx: 5, suggestions }))).toBeNull();
  });
});

describe("validateProposedScheduledAt", () => {
  const NOW_BEFORE = new Date("2020-01-01T00:00:00Z");
  const NOW_AFTER = new Date("2030-01-01T00:00:00Z");

  it("rejects an incomplete custom selection with the custom-path copy", () => {
    expect(
      validateProposedScheduledAt(sel({ customMode: true, customDateIso: "", customTime: "" })),
    ).toEqual({ ok: false, error: "Please pick a date and time (HH:MM)" });
  });

  it("rejects an empty suggested selection with the suggested-path copy", () => {
    expect(
      validateProposedScheduledAt(sel({ customMode: false, selectedSuggestionIdx: null })),
    ).toEqual({ ok: false, error: "Please pick a suggested time" });
  });

  it("rejects a resolved-but-past instant", () => {
    expect(
      validateProposedScheduledAt(
        sel({ customMode: true, customDateIso: DATE, customTime: "14:00" }),
        NOW_AFTER,
      ),
    ).toEqual({ ok: false, error: "The selected date and time must be in the future" });
  });

  it("accepts a resolved future custom instant", () => {
    const result = validateProposedScheduledAt(
      sel({ customMode: true, customDateIso: DATE, customTime: "14:00" }),
      NOW_BEFORE,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.scheduledAt.getTime()).toBe(combineLocal(DATE, "14:00")!.getTime());
    }
  });

  it("accepts a resolved future suggested instant", () => {
    const suggestions: Suggestion[] = [{ date: DATE, time: "10:30", weekday: "Monday" }];
    const result = validateProposedScheduledAt(
      sel({ selectedSuggestionIdx: 0, suggestions }),
      NOW_BEFORE,
    );
    expect(result.ok).toBe(true);
  });
});

describe("validateScheduledAt", () => {
  const NOW_BEFORE = new Date("2020-01-01T00:00:00Z");
  const NOW_AFTER = new Date("2030-01-01T00:00:00Z");

  it("rejects an unparseable date/time", () => {
    expect(validateScheduledAt("", "")).toEqual({
      ok: false,
      error: "Enter a valid date and time",
    });
    expect(validateScheduledAt(DATE, "99")).toEqual({
      ok: false,
      error: "Enter a valid date and time",
    });
  });

  it("rejects a past instant", () => {
    expect(validateScheduledAt(DATE, "14:00", NOW_AFTER)).toEqual({
      ok: false,
      error: "Date and time must be in the future",
    });
  });

  it("accepts a future instant and returns the resolved date", () => {
    const result = validateScheduledAt(DATE, "14:00", NOW_BEFORE);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.scheduledAt.getTime()).toBe(combineLocal(DATE, "14:00")!.getTime());
    }
  });
});
