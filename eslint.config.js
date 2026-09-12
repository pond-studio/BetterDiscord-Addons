import jsdocPlugin from 'eslint-plugin-jsdoc';
import globals from 'globals';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
    {
        ignores: ['node_modules/**'],
    },

    {
        files: ['*.config.js'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'module',
            globals: {
                ...globals.node,
            },
        },
    },

    {
        files: ['Plugins/**/*.js'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'commonjs',
            globals: {
                ...globals.browser,
                ...globals.commonjs,
                BdApi: 'readonly',
                DiscordNative: 'readonly',
            },
        },
        plugins: {
            jsdoc: jsdocPlugin,
        },
        rules: {
            'no-compare-neg-zero': 'error',
            'no-template-curly-in-string': 'error',
            'no-unsafe-negation': 'error',
            'array-callback-return': 'error',
            'dot-location': ['error', 'property'],
            'dot-notation': 'error',
            eqeqeq: ['error', 'smart'],
            'no-empty-function': ['error', { allow: ['arrowFunctions'] }],
            'no-floating-decimal': 'error',
            'no-implied-eval': 'error',
            'no-invalid-this': 'error',
            'no-lone-blocks': 'error',
            'no-new-func': 'error',
            'no-new-wrappers': 'error',
            'no-new': 'error',
            'no-octal-escape': 'error',
            'no-return-assign': 'error',
            'no-self-compare': 'error',
            'no-sequences': 'error',
            'no-throw-literal': 'error',
            'no-unmodified-loop-condition': 'error',
            'no-void': 'error',
            'prefer-promise-reject-errors': 'error',
            'wrap-iife': 'error',
            yoda: 'error',
            'no-label-var': 'error',
            'no-shadow': 'error',
            'no-undef-init': 'error',
            'no-array-constructor': 'error',
            'no-lonely-if': 'error',
            'no-new-object': 'error',
            'no-unneeded-ternary': 'error',
            'nonblock-statement-body-position': 'error',

            'accessor-pairs': 'warn',
            'no-console': 'warn',
            'no-return-await': 'warn',
            'no-unused-expressions': 'warn',
            'no-useless-call': 'warn',
            'no-useless-concat': 'warn',
            'no-useless-escape': 'warn',
            'no-useless-return': 'warn',
            'no-warning-comments': 'warn',
            'require-await': 'warn',
            'no-unused-vars': ['warn', { caughtErrors: 'none' }],

            'consistent-return': 'off',
            'func-name-matching': 'error',
            'func-style': [
                'error',
                'declaration',
                { allowArrowFunctions: true },
            ],

            'jsdoc/check-access': 'warn',
            'jsdoc/check-alignment': 'warn',
            'jsdoc/check-param-names': 'warn',
            'jsdoc/check-property-names': 'warn',
            'jsdoc/check-tag-names': [
                'warn',
                {
                    definedTags: [
                        'authorId',
                        'website',
                        'source',
                        'updateUrl',
                        'invite',
                        'donate',
                        'patreon',
                        'isTheme',
                        'important',
                        'needsBrowserExtension',
                    ],
                },
            ],
            'jsdoc/check-types': 'warn',
            'jsdoc/check-values': 'warn',
            'jsdoc/empty-tags': 'warn',
            'jsdoc/implements-on-classes': 'warn',
            'jsdoc/require-param': 'warn',
            'jsdoc/require-param-description': 'warn',
            'jsdoc/require-param-name': 'warn',
            'jsdoc/require-param-type': 'warn',
            'jsdoc/require-returns': 'warn',
            'jsdoc/require-returns-check': 'warn',
            'jsdoc/require-returns-description': 'warn',
            'jsdoc/require-returns-type': 'warn',
            'jsdoc/valid-types': 'warn',
        },
    },

    eslintConfigPrettier,
];
