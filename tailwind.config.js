/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Literary Editorial Palette
        paper: '#FEFEF8',    // Warm Off-White
        ink: {
          DEFAULT: '#0A0E27', // Deep Navy/Black
          light: '#4A4E69',   // Softer Ink
        },
        accent: {
          electric: '#00F0FF', // Cyan
          coral: '#FF6B6B',    // Pink/Red
          violet: '#7C3AED',   // Purple
        },
        // Mapping to functional names for compatibility
        background: {
          DEFAULT: '#FEFEF8',
          paper: '#FFFFFF',
          subtle: '#F4F4F0',
        },
        text: {
          main: '#0A0E27',
          secondary: '#4A4E69',
          muted: '#8D90A1',
        },
        secondary: {
          ocean: '#0EA5E9',
          'ocean-dark': '#0284C7',
        },
        border: {
          DEFAULT: '#0A0E27',
          light: '#E5E5E5',
        },
        primary: {
          DEFAULT: '#0A0E27',
          hover: '#2D3142',
        },
        status: {
          success: '#10B981',
          warning: '#F59E0B',
          error: '#FF6B6B', // Using Coral for error
        }
      },
      fontFamily: {
        sans: ['"Zen Kaku Gothic New"', 'sans-serif'],
        display: ['"Space Grotesk"', 'sans-serif'],
        mono: ['"Space Mono"', 'monospace'],
      },
      boxShadow: {
        'offset': '4px 4px 0px 0px #0A0E27',
        'offset-hover': '6px 6px 0px 0px #0A0E27',
        'card': '4px 4px 0px 0px #0A0E27', // Alias for offset
      },
    },
  },
  plugins: [],
}
