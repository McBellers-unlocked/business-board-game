/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Redefine the ink/brand scales so existing utility classes in components
        // map to the DCL palette without a mass search-replace across every file.
        //
        // ink: neutral scale (dark backgrounds + text on dark)
        ink: {
          50:  "#E8DEC8",  // cream (lightest — used for primary text on dark bg)
          100: "#2A3D32",  // card/surface bg (mid-dark)
          200: "#334A3C",  // hover on cards
          300: "#3F5548",  // borders, separators
          500: "#A8B3A2",  // secondary/meta text
          700: "#E8DEC8",  // body text (synonymous with ink-50 so text-ink-700 stays readable)
          900: "#1F2F26"   // deepest — page bg, header, tables
        },
        // brand: primary action (forest green)
        brand: {
          50:  "#2F4A38",
          100: "#2F4A38",
          500: "#4D8260",
          600: "#3F6B4F",  // primary button bg
          700: "#2F4A38"   // primary button hover
        },
        // accent: secondary action (aubergine purple)
        accent: {
          500: "#7A4C7F",
          600: "#7A4C7F",
          700: "#6A3D6E"
        }
      }
    }
  },
  plugins: []
};
