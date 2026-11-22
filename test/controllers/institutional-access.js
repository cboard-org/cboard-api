const assert = require('node:assert/strict');
const { hasPersonalAccess } = require('../../api/helpers/institutional-access');
const {
  active,
  isInstitutionalEvent,
} = require('../../api/helpers/institutional-bridge');
describe('institutional access does not replace ordinary ownership', () => {
  const now = Date.parse('2026-10-30T12:00:00Z');
  it('preserves an ordinary active subscription', () =>
    assert.equal(
      hasPersonalAccess(
        {
          status: 'active',
          transaction: { expiryDate: '2027-01-01T00:00:00Z' },
        },
        now,
      ),
      true,
    ));
  it('preserves lifetime access even with an obsolete expiry field', () =>
    assert.equal(
      hasPersonalAccess(
        {
          status: 'lifetime',
          transaction: { expiryDate: '2020-01-01T00:00:00Z' },
        },
        now,
      ),
      true,
    ));
  it('preserves cancelled access only through its entitlement date', () => {
    assert.equal(
      hasPersonalAccess(
        {
          status: 'cancelled',
          transaction: { expiryDate: '2027-01-01T00:00:00Z' },
        },
        now,
      ),
      true,
    );
    assert.equal(
      hasPersonalAccess(
        {
          status: 'cancelled',
          transaction: { expiryDate: '2025-01-01T00:00:00Z' },
        },
        now,
      ),
      false,
    );
  });
  it('never grants a future, expired or revoked institutional assignment', () => {
    for (const record of [
      { state: 'active', startsAt: '2027-01-01', endsAt: '2028-01-01' },
      { state: 'active', startsAt: '2025-01-01', endsAt: '2026-01-01' },
      { state: 'revoked', startsAt: '2026-01-01', endsAt: '2027-01-01' },
    ])
      assert.equal(active(record, now), false);
  });
  it('routes institutional billing without altering ordinary subscription routing', () => {
    assert.equal(
      isInstitutionalEvent({
        data: { object: { metadata: { source: 'cfluent' } } },
      }),
      false,
    );
    assert.equal(
      isInstitutionalEvent({
        data: {
          object: {
            metadata: {
              source: 'cfluent',
              purpose: 'institutional-subscription',
            },
          },
        },
      }),
      true,
    );
  });
});
