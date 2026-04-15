// Deterministic, seedable PRNG based on mulberry32.
// Chosen for simplicity + well-distributed [0,1) output, sufficient for
// match outcome rolls (only need ~60 rolls per session).

export class Rng {
  private state: number;

  constructor(seed: number) {
    // Normalise seed to a 32-bit unsigned integer
    this.state = seed >>> 0;
    if (this.state === 0) this.state = 0x9e3779b1;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // [0, max) integer
  int(max: number): number {
    return Math.floor(this.next() * max);
  }

  // Pick one element from an array
  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error("Rng.pick: empty array");
    return arr[this.int(arr.length)]!;
  }

  // Durstenfeld shuffle (in place, returns the array for chaining)
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [arr[i], arr[j]] = [arr[j]!, arr[i]!];
    }
    return arr;
  }
}

export function randomSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}
