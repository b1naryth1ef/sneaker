// eslint-disable-next-line no-undef
module.exports = {
  purge: {
    content: ["./src/**/*.{js,jsx,ts,tsx}", "./src/index.html"],
    options: {
      safelist: {
        standard: [],
      },
    },
  },
  darkMode: false, // or 'media' or 'class'
  theme: {},
  variants: {
    extend: {
      "border-b": ["hover"],
    },
  },
  plugins: [],
};

