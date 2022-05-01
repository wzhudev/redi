import { join } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
    resolve: {
        alias: {
            '@wendellhu/redi': join(__dirname, 'src'),
            '@wendellhu/redi/react-bindings': join(__dirname, 'src/react-bindings'),
        },
    },
    test: {
        globals: true,
    },
})
