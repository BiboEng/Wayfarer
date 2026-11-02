import { phaseAfterPrompt, phaseForPermission } from '../permission-phase';

describe('phaseForPermission', () => {
  it('precise grant -> the tour may start', () => expect(phaseForPermission('granted')).toBeNull());
  it('approximate grant -> location-approximate', () => expect(phaseForPermission('approximate')).toBe('location-approximate'));
  it('not asked yet -> needs-permission', () => expect(phaseForPermission('undetermined')).toBe('needs-permission'));
  it('refused for good -> permission-denied', () => expect(phaseForPermission('denied')).toBe('permission-denied'));
});

describe('phaseAfterPrompt', () => {
  it('a grant starts the tour', () => expect(phaseAfterPrompt('granted')).toBeNull());
  it('a refusal shows permission-denied, never the explanation (and prompt) again', () => {
    expect(phaseAfterPrompt('denied')).toBe('permission-denied');
    expect(phaseAfterPrompt('undetermined')).toBe('permission-denied');
  });
  it('an approximate grant shows location-approximate', () => expect(phaseAfterPrompt('approximate')).toBe('location-approximate'));
});
