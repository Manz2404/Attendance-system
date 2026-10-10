import test from 'node:test';
import assert from 'node:assert/strict';
import { requireCompatibleVersion } from '../lib/database-version.mjs';

test('the user’s MySQL 5.5.42 and its vendor suffixes are accepted', () => {
  for (const version of ['5.5.42', '5.5.42-log', '5.5.42-1~wheezy']) {
    assert.deepEqual(requireCompatibleVersion(version), { family: 'MySQL', version: '5.5.42' });
  }
});
test('version comparison accepts newer servers without confusing minor versions', () => {
  for (const version of ['5.5.62', '5.6.10', '5.7.44', '8.0.40', '8.4.6', '9.0.1']) assert.equal(requireCompatibleVersion(version).family, 'MySQL');
  for (const version of ['4.1.22', '5.4.99', '5.5.3', '5.5.41']) assert.throws(() => requireCompatibleVersion(version), /supports MySQL 5.5.42/);
});
test('MariaDB’s compatibility prefix does not get mistaken for MySQL 5.5', () => {
  assert.deepEqual(requireCompatibleVersion('5.5.5-10.6.18-MariaDB'), { family: 'MariaDB', version: '10.6.18' });
  assert.equal(requireCompatibleVersion('10.11.8-MariaDB').family, 'MariaDB');
  assert.throws(() => requireCompatibleVersion('10.5.25-MariaDB'), /supports MySQL/);
});
test('unrecognized versions fail instead of silently passing a NaN comparison', () => {
  for (const version of [null, undefined, '', 'unknown', '8.x.1', '8.4', 'prefix-8.4.6']) assert.throws(() => requireCompatibleVersion(version), /identify/);
});
