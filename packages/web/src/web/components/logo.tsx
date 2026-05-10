export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer hexagon frame */}
      <path
        d="M16 2L28 9V23L16 30L4 23V9L16 2Z"
        fill="none"
        stroke="#6e56cf"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Inner nodes */}
      <circle cx="16" cy="11" r="2.5" fill="#6e56cf" />
      <circle cx="9" cy="20" r="2" fill="#8b72e8" opacity="0.7" />
      <circle cx="23" cy="20" r="2" fill="#8b72e8" opacity="0.7" />
      {/* Connecting lines */}
      <line x1="16" y1="13.5" x2="9.8" y2="18.5" stroke="#6e56cf" strokeWidth="1.2" strokeDasharray="2 1.5" opacity="0.8" />
      <line x1="16" y1="13.5" x2="22.2" y2="18.5" stroke="#6e56cf" strokeWidth="1.2" strokeDasharray="2 1.5" opacity="0.8" />
      <line x1="11" y1="20" x2="21" y2="20" stroke="#6e56cf" strokeWidth="1.2" strokeDasharray="2 1.5" opacity="0.5" />
    </svg>
  );
}
