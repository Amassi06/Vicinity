import { computeStatusAfterSigning } from '../src/documents/service';

describe('computeStatusAfterSigning', () => {
  it('returns pending_signatures when a required zone is still unsigned', () => {
    const status = computeStatusAfterSigning([
      { required: true, signedBy: 'user-1' },
      { required: true, signedBy: null },
    ]);
    expect(status).toBe('pending_signatures');
  });

  it('returns signed when every required zone is signed', () => {
    const status = computeStatusAfterSigning([
      { required: true, signedBy: 'user-1' },
      { required: true, signedBy: 'user-2' },
    ]);
    expect(status).toBe('signed');
  });

  it('ignores non-required zones left unsigned', () => {
    const status = computeStatusAfterSigning([
      { required: true, signedBy: 'user-1' },
      { required: false, signedBy: null },
    ]);
    expect(status).toBe('signed');
  });

  it('treats an all-optional zone list as signed once every optional zone is present but unsigned', () => {
    const status = computeStatusAfterSigning([{ required: false, signedBy: null }]);
    expect(status).toBe('signed');
  });

  it('treats an empty zone list as signed (vacuous truth, defensive edge case)', () => {
    const status = computeStatusAfterSigning([]);
    expect(status).toBe('signed');
  });
});
