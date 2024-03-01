import { createIdentifier } from '@wendellhu/redi'

export class AA {
  key = 'aa'
}

export interface BB {
  key: string
  getConstructedTime?(): number
}

export const bbI = createIdentifier<BB>('bb')
