"use client";

import { LAUNCHED_CATEGORIES, isCompactPicker } from "@/lib/categories";
import type { RequestKind } from "@/lib/requests";

export type TypeFilterValue = "all" | RequestKind;

/** Narrow a list to one type. Always offers every launched type, so the layout does not shift between tabs. */
export default function TypeFilter({
  value,
  onChange,
  label,
  idPrefix,
}: {
  value: TypeFilterValue;
  onChange: (value: TypeFilterValue) => void;
  label: string;
  idPrefix: string;
}) {
  // One type is nothing to choose between.
  if (LAUNCHED_CATEGORIES.length < 2) return null;
  const options: { value: TypeFilterValue; label: string }[] = [
    { value: "all", label: "All types" },
    ...LAUNCHED_CATEGORIES.map((c) => ({ value: c.id as TypeFilterValue, label: c.filterLabel })),
  ];

  if (isCompactPicker(LAUNCHED_CATEGORIES.length)) {
    return (
      <div className="board-select">
        <label className="board-select-label" htmlFor={`${idPrefix}-show`}>
          Type
        </label>
        <select
          id={`${idPrefix}-show`}
          className="input select board-select-input"
          value={value}
          onChange={(e) => onChange(e.target.value as TypeFilterValue)}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="tabs board-filter" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" className="tab" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
