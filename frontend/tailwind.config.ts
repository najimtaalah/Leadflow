import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Space Grotesk", "system-ui", "sans-serif"],
      },
      colors: {
        // Density Pro design system tokens
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        // Sidebar
        "sidebar-bg": "hsl(var(--sidebar-bg))",
        "sidebar-border": "hsl(var(--sidebar-border))",
        "sidebar-item-hover": "hsl(var(--sidebar-item-hover))",
        "sidebar-item-active": "hsl(var(--sidebar-item-active))",
        "sidebar-icon": "hsl(var(--sidebar-icon))",
        // Statuts
        "status-gray": "hsl(var(--status-gray))",
        "status-gray-bg": "hsl(var(--status-gray-bg))",
        "status-blue": "hsl(var(--status-blue))",
        "status-blue-bg": "hsl(var(--status-blue-bg))",
        "status-orange": "hsl(var(--status-orange))",
        "status-orange-bg": "hsl(var(--status-orange-bg))",
        "status-green": "hsl(var(--status-green))",
        "status-green-bg": "hsl(var(--status-green-bg))",
        "status-red": "hsl(var(--status-red))",
        "status-red-bg": "hsl(var(--status-red-bg))",
        // Foreground variants
        "foreground-muted": "hsl(var(--foreground-muted))",
        "foreground-subtle": "hsl(var(--foreground-subtle))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};

export default config;
