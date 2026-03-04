/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "#0A0B0D",
                panel: "rgba(16, 18, 22, 0.8)",
                primary: "#10B981", // Emerald
                secondary: "#EF4444", // Coral
                accent: "#3B82F6", // Blue
                muted: "#6B7280",
            },
            fontFamily: {
                mono: ['JetBrains Mono', 'Space Mono', 'monospace'],
                sans: ['Inter', 'sans-serif'],
            },
        },
    },
    plugins: [],
}
