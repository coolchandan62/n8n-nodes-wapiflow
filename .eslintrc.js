/**
 * n8n community node ESLint config.
 * Uses the official `eslint-plugin-n8n-nodes-base` ruleset which encodes the
 * conventions n8n's verification team checks for.
 */
module.exports = {
    root: true,
    env: {
        browser: true,
        es6: true,
        node: true,
    },
    parser: '@typescript-eslint/parser',
    parserOptions: {
        project: ['./tsconfig.json'],
        sourceType: 'module',
        extraFileExtensions: ['.json'],
    },
    ignorePatterns: ['.eslintrc.js', '**/*.js', 'dist/**', 'node_modules/**'],
    overrides: [
        {
            files: ['package.json'],
            // package.json isn't in our tsconfig include list, so the
            // typescript parser can't read it. Use the JSON parser instead.
            parser: 'jsonc-eslint-parser',
            plugins: ['eslint-plugin-n8n-nodes-base'],
            extends: ['plugin:n8n-nodes-base/community'],
            rules: {
                'n8n-nodes-base/community-package-json-name-still-default': 'off',
            },
        },
        {
            files: ['./credentials/**/*.ts'],
            plugins: ['eslint-plugin-n8n-nodes-base'],
            extends: ['plugin:n8n-nodes-base/credentials'],
            rules: {
                'n8n-nodes-base/cred-class-field-documentation-url-missing': 'off',
                'n8n-nodes-base/cred-class-field-documentation-url-miscased': 'off',
            },
        },
        {
            files: ['./nodes/**/*.ts'],
            plugins: ['eslint-plugin-n8n-nodes-base'],
            extends: ['plugin:n8n-nodes-base/nodes'],
            rules: {
                'n8n-nodes-base/node-execute-block-missing-continue-on-fail': 'off',
                'n8n-nodes-base/node-resource-description-filename-against-convention': 'off',
                'n8n-nodes-base/node-param-fixed-collection-type-unsorted-items': 'off',
                'n8n-nodes-base/node-class-description-inputs-wrong-regular-node': 'off',
                'n8n-nodes-base/node-class-description-outputs-wrong': 'off',
            },
        },
    ],
};
