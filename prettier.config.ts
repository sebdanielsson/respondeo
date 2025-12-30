import { type Config } from 'prettier';

const config: Config = {
  plugins: ['prettier-plugin-tailwindcss'],
  useTabs: false,
  tabWidth: 2,
  singleQuote: false,
  trailingComma: 'all',
  semi: true,
  printWidth: 100,
};

export default config;
