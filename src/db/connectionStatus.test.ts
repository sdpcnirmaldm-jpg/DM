import test from 'node:test';
import assert from 'node:assert/strict';
import { isSqlUnavailableError, SqlUnavailableError, warnSqlProxyOnce } from './connectionStatus.ts';
import { isCloudSqlSocketAvailable } from './index.ts';

test('isSqlUnavailableError detects ENOENT Unix socket errors nested in Drizzle cause chains', () => {
  const socketErr = Object.assign(
    new Error('connect ENOENT /app/cloudsql/modern-sphere-9bcxw:asia-southeast1:ai-studio/.s.PGSQL.5432'),
    { code: 'ENOENT' }
  );
  const drizzleErr = new Error('Failed query: select * from users', { cause: socketErr });
  assert.equal(isSqlUnavailableError(drizzleErr), true);
  assert.equal(isSqlUnavailableError(new SqlUnavailableError()), true);
});

test('isSqlUnavailableError detects Connection terminated unexpectedly and ignores ordinary query errors', () => {
  assert.equal(
    isSqlUnavailableError(new Error('Connection terminated unexpectedly')),
    true
  );
  assert.equal(
    isSqlUnavailableError(new Error('Connection closed')),
    true
  );
  assert.equal(
    isSqlUnavailableError(new Error('duplicate key value violates unique constraint')),
    false
  );
});

test('isCloudSqlSocketAvailable returns false when Unix socket does not exist and warnSqlProxyOnce stays silent', () => {
  assert.equal(
    isCloudSqlSocketAvailable({
      SQL_HOST: '/app/cloudsql/non-existent-instance-socket-dir',
      SQL_USER: 'app_user',
      SQL_DB_NAME: 'db',
    }),
    false
  );
  assert.equal(
    isCloudSqlSocketAvailable({
      SQL_HOST: '127.0.0.1',
      SQL_USER: 'app_user',
      SQL_DB_NAME: 'db',
    }),
    true
  );
  assert.doesNotThrow(() => warnSqlProxyOnce('getOrCreateUser', 'test'));
});
