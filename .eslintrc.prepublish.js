/**
 * Stricter ruleset applied only by `npm publish` via prepublishOnly. This is
 * the exact ruleset n8n's verification team runs when reviewing community
 * packages — if this passes locally, verification won't bounce you back on
 * naming / structure issues.
 */
module.exports = {
    extends: './.eslintrc.js',
    overrides: [
        {
            files: ['package.json'],
            plugins: ['eslint-plugin-n8n-nodes-base'],
            rules: {
                'n8n-nodes-base/community-package-json-name-still-default': 'error',
            },
        },
        {
            files: ['./credentials/**/*.ts'],
            plugins: ['eslint-plugin-n8n-nodes-base'],
            rules: {
                'n8n-nodes-base/cred-class-field-documentation-url-missing': 'error',
                // "miscased" is intended for nodes inside n8n's own repo
                // where documentationUrl is a slug (`wapiFlowApi`), not a URL.
                // Community packages are expected to use a real https:// URL,
                // which this rule flags. Keep it off for the public release.
                'n8n-nodes-base/cred-class-field-documentation-url-miscased': 'off',
                'n8n-nodes-base/cred-class-field-documentation-url-not-http-url': 'error',
            },
        },
        {
            files: ['./nodes/**/*.ts'],
            plugins: ['eslint-plugin-n8n-nodes-base'],
            rules: {
                'n8n-nodes-base/node-param-description-missing-final-period': 'error',
                'n8n-nodes-base/node-param-description-missing-from-dynamic-options': 'error',
            },
        },
    ],
};
