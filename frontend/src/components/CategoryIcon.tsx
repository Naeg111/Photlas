import type { JSX } from "react";

interface CategoryIconProps {
  category: string;
  className?: string;
}

export function CategoryIcon({
  category,
  className = "w-4 h-4",
}: CategoryIconProps) {
  const icons: Record<string, JSX.Element> = {
    風景: (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
      >
        <path d="M14 6l-3.75 5 2.85 3.8-1.6 1.2C9.81 13.75 7 10 7 10l-6 8h22L14 6z" />
      </svg>
    ),
    街並み: (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
      >
        <path d="M15 11V5l-3-3-3 3v2H3v14h18V11h-6zm-8 8H5v-2h2v2zm0-4H5v-2h2v2zm0-4H5V9h2v2zm6 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V9h2v2zm0-4h-2V5h2v2zm6 12h-2v-2h2v2zm0-4h-2v-2h2v2z" />
      </svg>
    ),
    ポートレート: (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
      >
        <circle cx="12" cy="8" r="4" />
        <path d="M12 14c-4.42 0-8 2.69-8 6v2h16v-2c0-3.31-3.58-6-8-6z" />
      </svg>
    ),
    植物: (
      <svg
        viewBox="0 0 512 512"
        fill="currentColor"
        className={className}
      >
        <circle cx="256" cy="256" r="44" />
        <circle cx="256" cy="124" r="66" />
        <circle cx="256" cy="388" r="66" />
        <circle cx="124" cy="256" r="66" />
        <circle cx="388" cy="256" r="66" />
        <circle cx="179" cy="179" r="55" />
        <circle cx="333" cy="179" r="55" />
        <circle cx="179" cy="333" r="55" />
        <circle cx="333" cy="333" r="55" />
      </svg>
    ),
    動物: (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
      >
        <circle cx="4.5" cy="9.5" r="2.5" />
        <circle cx="9" cy="5.5" r="2.5" />
        <circle cx="15" cy="5.5" r="2.5" />
        <circle cx="19.5" cy="9.5" r="2.5" />
        <path d="M17.34 14.86c-.87-1.02-1.6-1.89-2.48-2.91-.46-.54-1.05-1.08-1.75-1.32-.11-.04-.22-.07-.33-.09-.25-.04-.52-.04-.78-.04s-.53 0-.79.05c-.11.02-.22.05-.33.09-.7.24-1.28.78-1.75 1.32-.87 1.02-1.6 1.89-2.48 2.91-1.31 1.31-2.92 2.76-2.62 4.79.29 1.02 1.02 2.03 2.33 2.32.73.15 3.06-.44 5.54-.44h.18c2.48 0 4.81.58 5.54.44 1.31-.29 2.04-1.31 2.33-2.32.31-2.04-1.3-3.49-2.61-4.8z" />
      </svg>
    ),
    自動車: (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
      >
        <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
      </svg>
    ),
    バイク: (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
      >
        <path d="M19.44 9.03L15.41 5H11v2h3.59l2 2H5c-2.8 0-5 2.2-5 5s2.2 5 5 5c2.46 0 4.45-1.69 4.9-4h1.65l2.77-2.77c-.21.54-.32 1.14-.32 1.77 0 2.8 2.2 5 5 5s5-2.2 5-5c0-2.65-1.97-4.77-4.56-4.97zM7.82 15C7.4 16.15 6.28 17 5 17c-1.63 0-3-1.37-3-3s1.37-3 3-3c1.28 0 2.4.85 2.82 2H5v2h2.82zM19 17c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z" />
      </svg>
    ),
    鉄道: (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
      >
        <path d="M4 15.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h12v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V5c0-3.5-3.58-4-8-4s-8 .5-8 4v10.5zm8 1.5c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm6-7H6V5h12v5z" />
      </svg>
    ),
    飛行機: (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
      >
        <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
      </svg>
    ),
    星空: (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
      >
        {/* 星ひとつ */}
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ),
    食べ物: (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
      >
        <path d="M8.1 13.34l2.83-2.83L3.91 3.5c-1.56 1.56-1.56 4.09 0 5.66l4.19 4.18zm6.78-1.81c1.53.71 3.68.21 5.27-1.38 1.91-1.91 2.28-4.65.81-6.12-1.46-1.46-4.2-1.1-6.12.81-1.59 1.59-2.09 3.74-1.38 5.27L3.7 19.87l1.41 1.41L12 14.41l6.88 6.88 1.41-1.41L13.41 13l1.47-1.47z" />
      </svg>
    ),
    その他: (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
      >
        <circle cx="6" cy="12" r="2" />
        <circle cx="12" cy="12" r="2" />
        <circle cx="18" cy="12" r="2" />
      </svg>
    ),
  };

  return icons[category] || null;
}