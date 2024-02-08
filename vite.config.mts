import { join, dirname } from 'path'
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config'

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			'@wendellhu/redi': join(__dirname, 'src'),
			'@wendellhu/redi/react-bindings': join(__dirname, 'src/react-bindings'),
		},
	},
	test: {
		globals: true,
		coverage: {
			provider: 'custom',
			customProviderModule: '@vitest/coverage-istanbul',
		}
	},
})
