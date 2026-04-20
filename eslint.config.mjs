import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import importPlugin from 'eslint-plugin-import';
import n from 'eslint-plugin-n';
import prettier from 'eslint-plugin-prettier';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

const config = [
  {
    ignores: [
      '.idea',
      '**/*.iml',
      'tools/release.sh',
      '**/yarn-debug.log*',
      '**/yarn-error.log*',
      '**/newrelic_agent.log*',
      '**/.vscode/',
      '**/yarn.lock',
      '**/jobcase-project.yaml',
      '**/*.json',
      '**/prettier.config.js',
      '**/.eslintrc.js',
      '**/stylelint.config.js',
      '**/node_modules/',
      '**/.next/',
      '**/.next/**/*',
      '**/dist/',
      '**/build/',
      'next-env.d.ts',
    ],
  },
  ...compat.extends('./node_modules/gts/'),
  ...compat.extends('next/core-web-vitals', 'prettier'),
  {
    plugins: {
      n,
      prettier,
      import: importPlugin,
    },

    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      ecmaVersion: 'latest',
      sourceType: 'module',
    },

    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx'],
        },
      },
    },

    rules: {
      'import/extensions': [
        'error',
        'ignorePackages',
        {
          js: 'never',
          jsx: 'never',
          ts: 'never',
          tsx: 'never',
        },
      ],

      'prettier/prettier': 'error',
      'block-scoped-var': 'error',
      eqeqeq: 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'eol-last': 'error',
      'prefer-arrow-callback': 'error',
      'no-trailing-spaces': 'error',
      'n/no-unsupported-features/node-builtins': 'off',

      quotes: [
        'warn',
        'single',
        {
          avoidEscape: true,
        },
      ],

      'no-restricted-properties': [
        'error',
        {
          object: 'describe',
          property: 'only',
        },
        {
          object: 'it',
          property: 'only',
        },
      ],

      'react/require-default-props': 'off',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },

    rules: {
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-use-before-define': 'off',
      '@typescript-eslint/no-warning-comments': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/ban-types': 'off',
      '@typescript-eslint/naming-convention': 'off',
      'import/prefer-default-export': 'off',
      'n/no-missing-import': 'off',
      'n/no-empty-function': 'off',
      'n/no-unsupported-features/es-syntax': 'off',
      'n/no-missing-require': 'off',
      'n/shebang': 'off',
      'no-dupe-class-members': 'off',
      'no-unused-vars': 'off',
      'react/function-component-definition': 'off',
      'require-atomic-updates': 'off',
    },
  },
];

export default config;
