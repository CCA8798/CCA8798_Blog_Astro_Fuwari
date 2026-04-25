/** @type {import('tailwindcss').Config} */
const defaultTheme = require("tailwindcss/defaultTheme")
module.exports = {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue,mjs}"],
  darkMode: "class", // allows toggling dark mode manually
  theme: {
    extend: {
      fontFamily: {
        sans: ["Roboto", "sans-serif", ...defaultTheme.fontFamily.sans],
        custom: ['"YangRenDongZhuShiTi Semibold"', 'sans-serif', ...defaultTheme.fontFamily.sans],
        custom2: ['"YouSheYuFeiTeJianKangTi-2"', 'sans-serif', ...defaultTheme.fontFamily.sans],
      },
      typography: (theme) => ({
        DEFAULT: {
          css: {
            fontFamily: theme('fontFamily.custom2').join(', '),
            // 下面这些有助于防止布局错乱
            '--tw-prose-body': theme('colors.gray.700'),
            '--tw-prose-headings': theme('colors.gray.900'),
            '--tw-prose-links': theme('colors.blue.600'),
            lineHeight: '1.75',               // 加大行高，适应中文字体
            p: { marginBottom: '1.2em' },
            'h1, h2, h3': { 
              fontWeight: '600',              // 半粗体，避免过粗
              lineHeight: '1.3',
            },
          },
        },
      }),
    },
  },
  plugins: [require("@tailwindcss/typography")],
}
