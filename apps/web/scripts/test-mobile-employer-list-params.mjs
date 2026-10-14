import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseEmployerListParams } from '../src/lib/mobile-employer-list-params.ts';

const statuses = ['new', 'viewed'];

test('defaults and a valid filtered page calculate the inclusive Supabase range offset', () => {
  assert.deepEqual(parseEmployerListParams(new URLSearchParams(), statuses), { page: 1, pageSize: 20, offset: 0, status: undefined });
  assert.deepEqual(parseEmployerListParams(new URLSearchParams('page=3&pageSize=50&status=new'), statuses), { page: 3, pageSize: 50, offset: 100, status: 'new' });
});

test('rejects invalid pagination and status before querying service-role database', () => {
  for (const query of ['page=0', 'page=-1', 'page=1.5', 'page=9007199254740992', 'pageSize=51', 'pageSize=0', 'status=private', 'status=', 'page=9007199254740991&pageSize=50']) {
    assert.throws(() => parseEmployerListParams(new URLSearchParams(query), statuses), RangeError, query);
  }
});
