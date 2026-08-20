/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans Bengali"', '"Hind Siliguri"', 'system-ui', 'sans-serif'],
      },
      colors: {
        navy: {
          50: '#f2f5fa',
          100: '#dee6f0',
          200: '#b7c6dc',
          300: '#8ba4c3',
          400: '#5f7fa8',
          500: '#3f608c',
          600: '#2f4a6f',
          700: '#243a58',
          800: '#1b2b42',
          900: '#131f30',
          950: '#0a1220',
        },
        gold: {
          50: '#fbf7ee',
          100: '#f5ead1',
          200: '#ecd39a',
          300: '#e2b866',
          400: '#d69f3f',
          500: '#c68729',
          600: '#a86d22',
          700: '#7f5220',
          800: '#5c3c1c',
          900: '#3f2a16',
        },
        teal: {
          50: '#effaf7',
          100: '#d7f0e8',
          200: '#b0e0d1',
          300: '#7fc8b3',
          400: '#4faa92',
          500: '#328c76',
          600: '#25705f',
          700: '#1e594d',
          800: '#1a483f',
          900: '#153a33',
        },
        surface: {
          DEFAULT: '#f7f8fb',
          card: '#ffffff',
        },
      },
      boxShadow: {
        soft: '0 2px 6px rgba(19,31,48,0.06), 0 1px 2px rgba(19,31,48,0.04)',
        card: '0 4px 12px rgba(19,31,48,0.08)',
      },
    },
  },
  plugins: [],
};
