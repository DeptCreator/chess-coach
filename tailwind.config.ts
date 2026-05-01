import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}", "./tests/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        graphite: {
          950: "#0a0d0f",
          900: "#101417",
          800: "#161d21",
          700: "#20292e",
          500: "#5d6b73",
        },
        arena: {
          teal: "#27c7a3",
          gold: "#d6b35a",
          amber: "#f2b84b",
          coral: "#ef6461",
        },
      },
      boxShadow: {
        board: "0 28px 90px rgba(0, 0, 0, 0.34)",
      },
    },
  },
  plugins: [],
};

export default config;
