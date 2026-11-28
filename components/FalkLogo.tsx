import React from 'react';

interface FalkLogoProps {
  className?: string;
  title?: string;
}

export function FalkLogo({
  className = 'h-5 w-auto',
  title = 'FALK',
}: FalkLogoProps) {
  return (
    <svg
      viewBox="0 0 120 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={title}
    >
      <path
        d="M4 5H18L13.5 12.5H19.5L8.5 23.5L11 15H4V5Z"
        fill="currentColor"
      />
      <text
        x="26"
        y="20"
        fill="currentColor"
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        fontSize="16"
        fontWeight="700"
        letterSpacing="0.18em"
      >
        FALK
      </text>
    </svg>
  );
}
