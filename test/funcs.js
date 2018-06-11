const _get = require('lodash.get');
const assert = require('assert');

describe('functions', () => {
  it('req accessor', () => {
    const req = {params: {id: 123}};
    const accs = 'params.id';
    assert.equal(123, _get(req, accs));
  })
});