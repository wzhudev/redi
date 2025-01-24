import antfu from '@antfu/eslint-config'

export default antfu({
  rules: {
    'ts/no-misused-new': 0,
    'jsonc/sort-keys': 0,
    'style/indent-binary-ops': 0, // bug with antfu
  },
})
