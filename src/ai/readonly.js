// A recursively read-only view of an object graph, used to prove the AI never
// mutates game state directly (SPEC.md Phase 2 "AI architecture"). Any write,
// delete or call of a mutating World method through the view throws.
const MUTATORS = new Set(['issue', 'step', 'run', 'add', 'addNode', 'addBuilding', 'addUnit', 'removeEntity', 'emit', 'drainEvents',
  'setRock', 'setOccupant', 'set', 'delete', 'clear', 'push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill', 'copyWithin', 'rebuild']);

export class MutationError extends Error {}

export function readonly(root) {
  const cache = new WeakMap();
  const wrap = (v) => {
    if (v === null || (typeof v !== 'object' && typeof v !== 'function')) return v;
    if (cache.has(v)) return cache.get(v);
    const p = new Proxy(v, {
      get(target, prop) {
        const value = Reflect.get(target, prop, target);
        if (typeof value !== 'function') return wrap(value);
        if (MUTATORS.has(prop)) return () => { throw new MutationError(`AI called mutating method ${String(prop)}()`); };
        return (...args) => {
          const out = value.apply(target, args);
          // Iterators and generators: wrap each yielded value.
          if (out && typeof out.next === 'function' && typeof out[Symbol.iterator] === 'function') {
            return (function* () { for (const x of out) yield wrap(x); }());
          }
          return wrap(out);
        };
      },
      set(_t, prop) { throw new MutationError(`AI wrote game state: .${String(prop)}`); },
      deleteProperty(_t, prop) { throw new MutationError(`AI deleted game state: .${String(prop)}`); },
      defineProperty(_t, prop) { throw new MutationError(`AI defined game state: .${String(prop)}`); },
    });
    cache.set(v, p);
    return p;
  };
  return wrap(root);
}
