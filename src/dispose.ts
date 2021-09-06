export interface Disposable {
    dispose(): void
}

export function isDisposable(thing: unknown): thing is Disposable {
    return !!thing && typeof (thing as any).dispose === 'function'
}
