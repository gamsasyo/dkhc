import { describe, it, expect } from 'vitest';
import { filterMakers, initialOf } from '../src/lib/catalog';

const makers = [
  { id: 'denka', name: 'Denka', categories: ['special', 'medical'] },
  { id: 'upm', name: 'UPM', categories: ['eco'] },
  { id: 'kuraray', name: 'KURARAY', categories: ['special'] },
  { id: 'x', name: '(주)기타', categories: ['special'] },
];
describe('makers', () => {
  it('initialOf', () => { expect(initialOf('Denka')).toBe('D'); expect(initialOf('(주)기타')).toBe('#'); });
  it('filters by category and letter', () => {
    expect(filterMakers(makers, { cat: 'special' }).map((m) => m.id)).toEqual(['denka', 'kuraray', 'x']);
    expect(filterMakers(makers, { letter: 'K' }).map((m) => m.id)).toEqual(['kuraray']);
    expect(filterMakers(makers, { cat: 'eco', letter: 'U' }).map((m) => m.id)).toEqual(['upm']);
  });
});
