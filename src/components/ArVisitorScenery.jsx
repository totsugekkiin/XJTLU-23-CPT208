import React from "react";

export function ArGateOutline() {
  return (
    <svg className="ar-gate-outline" viewBox="0 0 180 150" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
        <path d="M25 144V80h130v64M17 80h146M33 76V55h114v21M25 55h130M54 51V33h72v18" />
        <path d="M8 77c18 2 34-7 43-18h78c9 11 25 20 43 18M21 52c17 2 32-5 42-15h54c10 10 25 17 42 15M39 30c16 5 29-1 35-15h32c6 14 19 20 35 15" />
        <path d="M20 74v9M160 74v9M35 49v9M145 49v9M55 27v10M125 27v10M38 86v51M142 86v51M60 86v51M120 86v51M76 144v-33a14 14 0 0 1 28 0v33M18 144h144" />
        <path d="M42 63h96M66 42h48M68 22h44M90 15V7M56 90h68" />
      </g>
    </svg>
  );
}

export function ArVisitorScenery() {
  return (
    <div className="ar-visitor-scenery" aria-hidden="true">
      <svg className="ar-visitor-scenery__sun" viewBox="0 0 110 116" fill="none">
        <circle cx="36" cy="45" r="43" fill="#f65340" />
        <path d="m39 2-30 82M48 4 18 86M57 9 29 87" stroke="#3b5557" strokeWidth="1.5" />
        <path d="M0 67h13a6 6 0 0 1 0 12h-4a5 5 0 0 0 0 10h44a5 5 0 0 1 0 10H16a4 4 0 0 0 0 8h6a4 4 0 0 1 0 8H0" fill="#f3e9d6" />
      </svg>
      <svg className="ar-visitor-scenery__cloud" viewBox="0 0 72 64" fill="#f3e9d6">
        <path d="M0 0h14a8 8 0 0 1 0 16h33a6 6 0 0 1 0 12H14a4 4 0 0 0 0 8h5a5 5 0 0 1 0 10H0Z" />
      </svg>
      <svg className="ar-visitor-scenery__wave" viewBox="0 0 600 100" preserveAspectRatio="none" fill="none">
        <path d="M0 37c75 37 100 43 162 39s77 33 141 14 95-65 166-27c44 24 31-53 91-53 17 0 29 4 40 12v78H0Z" fill="#ee5c47" fillOpacity=".88" />
        <path d="M600 56h-29a6 6 0 0 0 0 12h-43a6 6 0 0 0 0 12h-72a6 6 0 0 0 0 12h53a5 5 0 0 1 0 10h91" fill="#f3e9d6" fillOpacity=".85" />
      </svg>
    </div>
  );
}
