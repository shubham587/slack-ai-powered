/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'slack': {
          'purple': '#611f69',
          'aubergine': '#4A154B',
          'sidebar': '#19171D',
          'hover': '#27242C',
          'border': '#49274b',
          'text': '#CFC3CF',
          'active': '#1164A3',
        },
        primary: {
          background: '#1A1D21',
          accent: '#611F69',
          hover: '#4A154B',
        },
        message: {
          user: '#1164A3',
          other: '#EDEDED',
        },
        border: '#3C3F44',
        text: {
          primary: '#FFFFFF',
          secondary: '#B6B6B6',
        },
        chat: {
          background: '#2C2D30',
          input: '#3F0E40',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} 