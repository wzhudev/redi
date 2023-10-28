export class RediError extends Error {
	constructor(message: string) {
		super(`[redi]: ${message}`)
	}
}
