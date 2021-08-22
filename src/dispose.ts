export interface Disposable {
    dispose(): void
}

export function isDisposable(thing: any): thing is Disposable {
    return !!thing && typeof (thing as any).dispose === 'function'
}
