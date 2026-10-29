/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        stellar: {
          blue: '#14B6F7',
          dark: '#0B0F19',
          card: '#161F30',
          border: '#22304A',
          accent: '#7D52F4',
        },
      },
    },
  },
  plugins: [],
};
