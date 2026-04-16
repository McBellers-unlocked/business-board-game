/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ink: neutral scale — light page, dark text
        ink: {
          50:  "#F7F7F5",  // page bg (lightest)
          100: "#FFFFFF",  // card bg (white)
          200: "#F0F0EE",  // hover on cards
          300: "#D1D5DB",  // borders
          500: "#6B7280",  // secondary/meta text
          700: "#374151",  // body text
          900: "#110B0F"   // heading text (darkest)
        },
        // brand: primary action (cricket-ball red)
        brand: {
          50:  "#FEF0F0",
          100: "#FCDADA",
          500: "#E03030",
          600: "#D5161D",  // key buttons
          700: "#B01218"   // hover
        },
        // navy: header + structural blue
        navy: {
          50:  "#EBF0F7",
          100: "#D0DCEE",
          500: "#1E4F9A",
          600: "#123A78",  // header bg, crest outlines
          700: "#0E2D5E",  // hover
          800: "#091D3E"
        },
        // accent: gold trim / banners
        accent: {
          400: "#F0B03D",
          500: "#ED9F1E",  // gold
          600: "#D88E14",
          700: "#C07E10"
        }
      }
    }
  },
  plugins: []
};
