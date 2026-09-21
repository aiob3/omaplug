const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../panel/Presentation.js'), 'utf8')
  .replace(/^\.pragma library\s*/, ''), context);

const rows = ['alpha', 'beta', 'gamma', 'current', 'local'].map(id => ({ id, sourceKey: id }));
const states = { alpha: 'UPDATE', beta: 'UPDATE', gamma: 'UPDATE', current: 'CURRENT', local: 'LOCAL_CHANGES' };
const keys = (selection, sourceRows = rows, sourceStates = states) =>
  Array.from(context.selectedUpdateKeys(sourceRows, sourceStates, selection));
const updatable = (sourceRows = rows, sourceStates = states) =>
  Array.from(context.updatableKeys(sourceRows, sourceStates));

// Nothing selected launches nothing.
assert.deepEqual(keys({}), []);

// Keys follow the row order, not the order the user clicked in.
assert.deepEqual(keys({ gamma: true, alpha: true }), ['alpha', 'gamma']);

// Only rows the last check proved updateable are launched, even if selected.
assert.deepEqual(keys({ alpha: true, current: true, local: true }), ['alpha']);

// A selection left over from an earlier check is ignored once the plugin is current.
assert.deepEqual(keys({ alpha: true, beta: true }, rows, { ...states, alpha: 'CURRENT' }), ['beta']);

// Keys that no longer exist in the rows are ignored.
assert.deepEqual(keys({ removed: true, beta: true }), ['beta']);

// Only an explicit `true` counts as selected.
assert.deepEqual(keys({ alpha: 1, beta: 'yes', gamma: true }), ['gamma']);

// A repository shared by several plugins updates as a unit, so it is launched once.
const shared = [...rows, { id: 'alpha-extra', sourceKey: 'alpha' }];
assert.deepEqual(keys({ alpha: true }, shared), ['alpha']);

// Explicit picks behave like the per-row UPDATE button: marketplace scope does not apply.
// (selectedUpdateKeys takes no marketplace/scope input on purpose.)
assert.equal(context.selectedUpdateKeys.length, 3);

// "Select all" covers every updateable repository once, in row order.
assert.deepEqual(updatable(), ['alpha', 'beta', 'gamma']);
assert.deepEqual(updatable(shared), ['alpha', 'beta', 'gamma']);
assert.deepEqual(updatable(rows, { current: 'CURRENT' }), []);

console.log('update-selection-test: ok');
