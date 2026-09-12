declare module '*.css';

declare module 'elkjs/lib/elk-worker.min.js' {
  export class Worker {
    constructor(url?: string);
  }
}
