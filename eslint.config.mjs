import antfu from '@antfu/eslint-config'

export default antfu({
  rules: {
    'ts/no-misused-new': 0,
    'jsonc/sort-keys': 0,
  },
})
