"use client";
import { useState } from "react";

export function TagListEditor({
  label,
  values,
  onChange,
  placeholder,
  tone = "neutral",
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  tone?: "allow" | "block" | "neutral";
}) {
  const [draft, setDraft] = useState("");

  const accent =
    tone === "allow" ? "text-green" : tone === "block" ? "text-red" : "text-paper";

  function add() {
    const v = draft.trim();
    if (!v) return;
    if (values.includes(v)) {
      setDraft("");
      return;
    }
    onChange([...values, v]);
    setDraft("");
  }

  return (
    <div>
      <div className={`field-label ${accent}`}>{label}</div>
      <div className="flex flex-wrap gap-2 mb-2">
        {values.length === 0 && (
          <span className="font-tech text-[11px] text-paperMuted italic">(empty)</span>
        )}
        {values.map((v) => (
          <span key={v} className="tag">
            <span className={accent}>{v}</span>
            <button
              type="button"
              className="text-paperMuted hover:text-paper ml-1"
              aria-label={`remove ${v}`}
              onClick={() => onChange(values.filter((x) => x !== v))}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="field-input"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" onClick={add} className="command-button">
          Add
        </button>
      </div>
    </div>
  );
}
