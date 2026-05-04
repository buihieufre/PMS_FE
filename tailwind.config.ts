import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      keyframes: {
        'template-preview-reveal': {
          '0%': {
            opacity: '0',
            transform: 'translateY(10px) scale(0.97)',
            filter: 'blur(2px)',
            boxShadow: '0 0 0 0 rgba(251, 191, 36, 0)',
          },
          '40%': {
            opacity: '1',
            transform: 'translateY(0) scale(1)',
            filter: 'blur(0)',
            boxShadow:
              '0 0 0 3px rgba(245, 158, 11, 0.4), 0 12px 28px rgba(15, 23, 42, 0.09)',
          },
          '100%': {
            boxShadow:
              '0 0 0 1px rgba(251, 191, 36, 0.35), 0 8px 22px rgba(15, 23, 42, 0.07)',
          },
        },
      },
      animation: {
        'template-preview-reveal':
          'template-preview-reveal 0.52s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
};
export default config;
