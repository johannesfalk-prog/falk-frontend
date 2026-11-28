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
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={title}
    >
      <circle cx="16" cy="16" r="13.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="16" cy="16" r="11.2" stroke="currentColor" strokeWidth="1.2" />
      <polygon points="16,2.5 18.2,13.8 16,16" fill="currentColor" />
      <polygon points="16,2.5 16,16 13.8,13.8" fill="currentColor" opacity="0.55" />
      <polygon points="29.5,16 18.2,18.2 16,16" fill="currentColor" />
      <polygon points="29.5,16 16,16 18.2,13.8" fill="currentColor" opacity="0.55" />
      <polygon points="16,29.5 13.8,18.2 16,16" fill="currentColor" />
      <polygon points="16,29.5 16,16 18.2,18.2" fill="currentColor" opacity="0.55" />
      <polygon points="2.5,16 13.8,13.8 16,16" fill="currentColor" />
      <polygon points="2.5,16 16,16 13.8,18.2" fill="currentColor" opacity="0.55" />
      <polygon points="23.5,8.5 18.4,15.3 16.7,13.6" fill="currentColor" />
      <polygon points="23.5,23.5 16.7,18.4 18.4,16.7" fill="currentColor" />
      <polygon points="8.5,23.5 13.6,16.7 15.3,18.4" fill="currentColor" />
      <polygon points="8.5,8.5 15.3,13.6 13.6,15.3" fill="currentColor" />
    </svg>
  );
}
