import antfu from '@antfu/eslint-config';

export default antfu({
  ignores: [
    'AGENTS.md',
    'CLAUDE.md',
  ],
  rules: {
    'ts/no-misused-new': 0,
    'jsonc/sort-keys': 0,
    'style/semi': 'off',
    'style/member-delimiter-style': 'off',
    'style/arrow-parens': 'off',
    'style/object-curly-spacing': 'off',
    'style/brace-style': 'off',
    'style/indent': 'off',
    'style/operator-linebreak': 'off',
    'style/quote-props': 'off',
    'svelte/indent': 'off',
    'antfu/if-newline': 'off',
    // Temporarily disabled: incompatible with ESLint 9 (context.sourceCode.isGlobalReference missing)
    'unicorn/error-message': 'off',
  },
});
