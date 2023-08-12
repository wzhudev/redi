export interface IDisposable {
    dispose(): void
}

export function isDisposable(thing: unknown): thing is IDisposable {
    return !!thing && typeof (thing as any).dispose === 'function'
}
