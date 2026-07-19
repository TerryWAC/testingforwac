import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        night: {
          950: "#0d1117",
          900: "#141a22",
          800: "#1c2530",
          700: "#2a3644",
          400: "#8899aa",
        },
        accent: {
          DEFAULT: "#00c030",
          orange: "#ff8000",
          blue: "#40bcf4",
        },
      },
    },
  },
  plugins: [],
};

export default config;
