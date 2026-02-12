import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: "class", // Enabled manual dark mode toggle
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: "#FF5F05", // Refined orange
                "background-light": "#E0E0E0",
                "background-dark": "#0F172A",
                "card-light": "#FFFFFF",
                "card-dark": "#1E293B",
            },
            fontFamily: {
                display: ["Inter", "Noto Sans TC", "sans-serif"],
                mono: ["JetBrains Mono", "monospace"],
            },
            borderRadius: {
                DEFAULT: "12px",
                'xl': '24px',
            },
        },
    },
    plugins: [
        require('@tailwindcss/typography'),
        require('@tailwindcss/forms'),
    ],
};
export default config;
