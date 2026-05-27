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
                navy: {
                    DEFAULT: "#1B2A4A",
                    mid: "#2A3D66",
                    pale: "#EEF1F8",
                    border: "#C8D0E4",
                },
                lime: {
                    DEFAULT: "#C5D600",
                    hover: "#AEBE00",
                    pale: "#F3F7D0",
                    text: "#5A6600",
                },
                teal: {
                    DEFAULT: "#00B4A4",
                    hover: "#009E90",
                    pale: "#E0F5F3",
                    text: "#007B70",
                },
                tennis: {
                    DEFAULT: "#C5D600",
                    light: "#F3F7D0",
                    dark: "#5A6600",
                    bg: "#F8FAE5",
                },
                cricket: {
                    DEFAULT: "#E86010",
                    light: "#FEE8D5",
                    dark: "#C04A00",
                    bg: "#FEF3EC",
                },
                pickleball: {
                    DEFAULT: "#00B4A4",
                    light: "#E0F5F3",
                    dark: "#007B70",
                    bg: "#E8FAF8",
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
