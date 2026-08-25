"use client";

import { useMemo } from "react";

// A short, curated list rather than an exhaustive ~200-country one -- this
// product's whole audience is Indian SMBs (India first and default), plus a
// handful of countries covering realistic edge cases (NRI customers, a
// clinic with an international patient, etc).
export const COUNTRY_CODES = [
  { code: "91", label: "India" },
  { code: "1", label: "US/Canada" },
  { code: "44", label: "UK" },
  { code: "971", label: "UAE" },
  { code: "966", label: "Saudi Arabia" },
  { code: "65", label: "Singapore" },
  { code: "61", label: "Australia" },
] as const;

// Longest-code-first so "1" (US) doesn't shadow-match the start of "966"
// or similar during the split below.
const CODE_LIST = [...COUNTRY_CODES].map((c) => c.code).sort((a, b) => b.length - a.length);

export function splitE164(value: string): { countryCode: string; national: string } {
  const digits = value.replace(/^\+/, "").replace(/\D/g, "");
  for (const code of CODE_LIST) {
    if (digits.startsWith(code)) {
      return { countryCode: code, national: digits.slice(code.length) };
    }
  }
  return { countryCode: "91", national: digits };
}

interface PhoneInputProps {
  label?: string;
  value: string; // full E.164 value, e.g. "+919876543210", or ""
  onChange: (next: string) => void;
  required?: boolean;
  hint?: string;
  error?: string;
  disabled?: boolean;
}

// Composes a full E.164 string on every keystroke -- +<countryCode><digits>
// -- so the value handed to onChange is always in the exact canonical shape
// normalizePhone()/isValidPhone() expect. This is the actual fix for the
// bug class that broke tonight's WhatsApp send: a plain text field lets
// someone type a bare 10-digit number and silently produce an
// undeliverable one; this can't produce that shape at all, since a country
// code is always selected (defaulting to India).
export function PhoneInput({ label, value, onChange, required, hint, error, disabled }: PhoneInputProps) {
  const { countryCode, national } = useMemo(() => splitE164(value), [value]);

  function update(nextCode: string, nextNational: string) {
    const digits = nextNational.replace(/\D/g, "");
    onChange(digits ? `+${nextCode}${digits}` : "");
  }

  const inputId = label ? `phone-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-text">
          {label}
        </label>
      )}
      <div className="flex gap-2">
        <select
          aria-label="Country code"
          value={countryCode}
          disabled={disabled}
          onChange={(e) => update(e.target.value, national)}
          className="h-10 w-28 cursor-pointer rounded-md border border-border bg-card px-2 text-sm text-text outline-none transition-colors focus:border-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {COUNTRY_CODES.map((c) => (
            <option key={c.code} value={c.code}>
              +{c.code} {c.label}
            </option>
          ))}
        </select>
        <input
          id={inputId}
          type="tel"
          required={required}
          disabled={disabled}
          value={national}
          onChange={(e) => update(countryCode, e.target.value)}
          placeholder="98765 43210"
          className={`h-10 flex-1 rounded-md border bg-card px-3 text-sm text-text placeholder:text-text-muted outline-none transition-colors focus:border-primary disabled:cursor-not-allowed disabled:opacity-50 ${
            error ? "border-danger" : "border-border"
          }`}
        />
      </div>
      {hint && !error && <p className="text-xs text-text-muted">{hint}</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
