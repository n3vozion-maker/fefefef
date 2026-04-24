export type NodeStatus = 'success' | 'failure' | 'running'
export type BTNode = { tick: (ctx: unknown) => NodeStatus }

export function sequence(children: BTNode[]): BTNode {
  return {
    tick(ctx) {
      for (const child of children) {
        const s = child.tick(ctx)
        if (s !== 'success') return s
      }
      return 'success'
    },
  }
}

export function selector(children: BTNode[]): BTNode {
  return {
    tick(ctx) {
      for (const child of children) {
        const s = child.tick(ctx)
        if (s !== 'failure') return s
      }
      return 'failure'
    },
  }
}

export function condition(test: (ctx: unknown) => boolean): BTNode {
  return { tick: (ctx) => (test(ctx) ? 'success' : 'failure') }
}

export function action(fn: (ctx: unknown) => NodeStatus): BTNode {
  return { tick: fn }
}
