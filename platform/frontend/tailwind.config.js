/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f9f7",
          100: "#c9ece4",
          500: "#1f8f79",
          700: "#17695a",
          900: "#0f3d36"
        },
        accent: {
          400: "#f9a03f",
          500: "#f0862f"
        }
      },
      boxShadow: {
        panel: "0 10px 35px rgba(18, 57, 50, 0.12)"
      }
    }
  },
  plugins: []
};
