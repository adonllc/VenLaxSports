/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
        "./src/**/*.{js,jsx,ts,tsx}",
        "./public/index.html"
    ],
    theme: {
        extend: {
            fontFamily: {
                heading: ["Barlow Condensed", "sans-serif"],
                body: ["Barlow", "sans-serif"],
            },
            colors: {
                rust: {
                    DEFAULT: "#C24A1D",
                    hover: "#A83A12",
                    light: "#E8795A",
                    pale: "#F9EDE7",
                    bg: "#FDF5F1",
                },
                forest: {
                    DEFAULT: "#1A2C24",
                    mid: "#2E4A3A",
                    body: "#4A6158",
                    muted: "#7A9488",
                    pale: "#EDF2EE",
                    border: "#D4E8DF",
                },
                tennis: {
                    DEFAULT: "#C24A1D",
                    light: "#F9EDE7",
                    dark: "#A83A12",
                    bg: "#FDF5F1",
                },
                cricket: {
                    DEFAULT: "#1A5C45",
                    light: "#D4E8DF",
                    dark: "#0F3527",
                    bg: "#EDF2EE",
                },
                pickleball: {
                    DEFAULT: "#D4831A",
                    light: "#FDECD3",
                    dark: "#A86010",
                    bg: "#FEF6EC",
                },
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
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
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
            },
            keyframes: {
                "accordion-down": {
                    from: { height: "0" },
                    to: { height: "var(--radix-accordion-content-height)" },
                },
                "accordion-up": {
                    from: { height: "var(--radix-accordion-content-height)" },
                    to: { height: "0" },
                },
                "fade-in": {
                    from: { opacity: "0", transform: "translateY(16px)" },
                    to: { opacity: "1", transform: "translateY(0)" },
                },
                "slide-in": {
                    from: { opacity: "0", transform: "translateX(-20px)" },
                    to: { opacity: "1", transform: "translateX(0)" },
                },
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
                "fade-in": "fade-in 0.5s ease-out forwards",
                "slide-in": "slide-in 0.4s ease-out forwards",
            },
        },
    },
    plugins: [require("tailwindcss-animate")],
};
