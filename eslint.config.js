import eslint from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import stylistic from '@stylistic/eslint-plugin';

export default [
    eslint.configs.recommended,
    ...tsPlugin.configs['flat/strict'],
    {
        plugins: {
            '@stylistic': stylistic,
            '@typescript-eslint': tsPlugin,
        },
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                project: './tsconfig.json',
            },
        },
        rules: {
            // Style
            quotes: ['error', 'single', { avoidEscape: true }],
            'quote-props': ['off'],
            '@stylistic/array-bracket-newline': ['error', { minItems: 3}],
            '@stylistic/array-bracket-spacing': ['off', "always", { singleValue: false, objectsInArrays: false, arraysInArrays: false }],
            '@stylistic/array-element-newline': ['error', { minItems: 3, multiline: true, consistent: true }],
            '@stylistic/arrow-parens': ['error', 'always'],
            '@stylistic/arrow-spacing': ['error', { before: true, after: true }],
            '@stylistic/block-spacing': ['error', 'always'],
            '@stylistic/brace-style': ['error', 'stroustrup'],
            '@stylistic/comma-dangle': ['error', 'always-multiline'],
            '@stylistic/comma-spacing': ['error', { before: false, after: true }],
            '@stylistic/comma-style': ['error', 'last'],
            '@stylistic/computed-property-spacing': ['error', 'always'],
            '@stylistic/curly-newline': ['error', { multiline: true, consistent: true}],
            '@stylistic/dot-location': ['error', 'property'],
            '@stylistic/eol-last': ['error', 'always'],
            '@stylistic/function-call-argument-newline': ['error', 'consistent'],
            '@stylistic/function-call-spacing': ['error', 'never'],
            '@stylistic/function-paren-newline': ['off', {minItems: 2}],
            '@stylistic/indent': ['error', 4, { SwitchCase: 1 }],

            '@stylistic/semi': ['error', 'always'],


            'max-len': [
                'error',
                {
                    code: 100,
                    ignoreUrls: true,
                    ignoreStrings: true,
                    ignoreTemplateLiterals: true,
                    ignoreComments: true,
                    ignoreRegExpLiterals: true,
                },
            ],

            // Best practices
            'no-var': 'error',
            'prefer-const': ['error', { destructuring: 'all' }],
            eqeqeq: ['error', 'always'],
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            'no-debugger': 'error',
            complexity: ['warn', { max: 10, variant: 'modified' }],
            // TypeScript-specific (prefer plugin rules)
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
            ],
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/no-explicit-any': ['warn'],
            '@typescript-eslint/array-type': ['error', { default: 'array' }],
            // TODO; this rule can be enabled once the codebase has been cleaned up.
            '@typescript-eslint/no-non-null-assertion': ['off'],
            '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
        },
        files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
        ignores: ['node_modules', 'eslint.config.js'],
    },
    {
        files: ['**/*.spec.ts', '**/*.test.ts', 'tests/**/*.ts'],
        rules: {
            // Tests often trade off readability for coverage.
            'max-len': 'off',
            complexity: 'off',
        },
    },
];
