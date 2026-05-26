/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#080808',
        paper: '#f2ead8',
        paperMuted: '#c7bfae',
        line: 'rgba(242, 234, 216, 0.22)',
        lineStrong: 'rgba(242, 234, 216, 0.48)',
        green: '#a7ff3f',
        red: '#ff4d4d',
        amber: '#ffcc4d',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Archivo Black', 'Anton', 'Arial Narrow', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        tech: ['IBM Plex Mono', 'JetBrains Mono', 'Space Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
}
