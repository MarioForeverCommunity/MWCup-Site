import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'

export default [
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}']
  },

  {
    name: 'app/files-to-ignore',
    ignores: ['**/dist/**', '**/dist-ssr/**', '**/coverage/**', '**/node_modules/**']
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/essential'],

  {
    name: 'app/globals',
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2022,
        BUILD_TIME: 'readonly'
      }
    }
  },

  {
    name: 'app/node-scripts',
    files: ['scripts/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022
      }
    }
  },

  {
    name: 'app/vue-rules',
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'off',
      'vue/max-attributes-per-line': ['error', {
        singleline: { max: 3 },
        multiline: { max: 1 }
      }],
      'vue/first-attribute-linebreak': ['error', {
        singleline: 'ignore',
        multiline: 'below'
      }],
      'vue/html-indent': ['error', 2, {
        attribute: 1,
        baseIndent: 1,
        closeBracket: 0,
        alignAttributesVertically: true,
        ignores: []
      }],
      'vue/html-closing-bracket-newline': ['error', {
        singleline: 'never',
        multiline: 'always'
      }],
      'vue/html-closing-bracket-spacing': 'error',
      'vue/mustache-interpolation-spacing': ['error', 'always'],
      'vue/no-multi-spaces': 'error',
      'vue/prop-name-casing': 'off',
      'vue/require-default-prop': 'warn',
      'vue/require-prop-types': 'warn'
    }
  },

  {
    name: 'app/typescript-rules',
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ],
      '@typescript-eslint/preserve-caught-error': 'off',
      'preserve-caught-error': 'off',
      'indent': ['error', 2, {
        SwitchCase: 1,
        VariableDeclarator: 1,
        outerIIFEBody: 1,
        MemberExpression: 1,
        FunctionDeclaration: { parameters: 1, body: 1 },
        FunctionExpression: { parameters: 1, body: 1 },
        CallExpression: { arguments: 1 },
        ArrayExpression: 1,
        ObjectExpression: 1,
        ImportDeclaration: 1,
        flatTernaryExpressions: false,
        ignoredNodes: ['TemplateLiteral']
      }],
      'linebreak-style': 'off',
      'quotes': 'off',
      'semi': 'off',
      'comma-dangle': 'off',
      'object-curly-spacing': ['error', 'always'],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-console': 'off',
      'no-debugger': 'warn',
      'no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0 }],
      'no-trailing-spaces': 'error',
      'eol-last': ['error', 'always'],
      'prefer-const': 'error',
      'no-var': 'error',
      'eqeqeq': ['error', 'smart'],
      'curly': ['error', 'multi-line']
    }
  },

  {
    name: 'app/dts-files',
    files: ['**/*.d.ts'],
    rules: {
      '@typescript-eslint/triple-slash-reference': 'off'
    }
  }
]
