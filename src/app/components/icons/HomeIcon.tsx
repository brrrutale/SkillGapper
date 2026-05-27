import type { SVGProps } from 'react';

/**
 * Home (Haus) — Header-Back-Button.
 * Quelle: Figma UI3 Kit Node 1:531890.
 * `fill="currentColor"` damit Tailwind text-color den Pfad färbt.
 */
export function HomeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 16 17"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      {...props}
    >
      <path
        d="M15 15.9996V6.99958L8 0.999581L1 6.99958V15.9996H5V9.99958C5 9.4473 5.44772 8.99958 6 8.99958H10C10.5523 8.99958 11 9.4473 11 9.99958V15.9996H15ZM16 15.9996C16 16.5519 15.5523 16.9996 15 16.9996H11C10.4477 16.9996 10 16.5519 10 15.9996V9.99958H6V15.9996C6 16.5519 5.55228 16.9996 5 16.9996H1C0.447715 16.9996 0 16.5519 0 15.9996V6.99958C0 6.70766 0.127964 6.43077 0.349609 6.24079L7.34961 0.240792L7.42188 0.184151C7.79251 -0.0790277 8.29936 -0.0600884 8.65039 0.240792L15.6504 6.24079C15.872 6.43077 16 6.70766 16 6.99958V15.9996Z"
        fillOpacity="0.9"
      />
    </svg>
  );
}
