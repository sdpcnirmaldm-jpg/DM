import fs from 'node:fs';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';
import { isSqlUnavailableError, SqlUnavailableError } from './connectionStatus.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

export function isCloudSqlSocketAvailable(env: NodeJS.ProcessEnv = process.env): boolean {
  const host = env.SQL_HOST;
  if (!host || !env.SQL_USER || !env.SQL_DB_NAME) {
    return false;
  }
  if (host.startsWith('/')) {
    return fs.existsSync(path.join(host, '.s.PGSQL.5432'));
  }
  return true;
}

export function assertSqlSocketAvailable(): void {
  if (!isCloudSqlSocketAvailable()) {
    throw new SqlUnavailableError('SQL socket is not present in runtime environment');
  }
}

export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      connectionTimeoutMillis: 15000,
    });

    global._postgresPool.on('error', (err) => {
      if (isSqlUnavailableError(err)) return;
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();
export const db = drizzle(pool, { schema });
