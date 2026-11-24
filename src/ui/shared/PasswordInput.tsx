"use client";

import { useState } from "react";

// Password field with an eye button to show or hide what was typed. Used on every login and set-password form.
// The button is a real <button type="button">, so it is reachable with Tab and works with Enter/Space;
// its label and aria-pressed tell screen readers whether the password is visible.
export function PasswordInput({ showLabel, hideLabel, ...input }: { showLabel: string; hideLabel: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  const label = visible ? hideLabel : showLabel;
  return (
    <span className="pw" dir="ltr">
      <input {...input} type={visible ? "text" : "password"} autoCapitalize="none" autoCorrect="off" spellCheck={false} dir="ltr" />
      <button type="button" className="pw-eye" onClick={() => setVisible((v) => !v)} aria-label={label} aria-pressed={visible} title={label}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
          {visible && <path d="M3 3l18 18" />}
        </svg>
      </button>
    </span>
  );
}
