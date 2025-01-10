import { Knex } from 'knex'

export async function truncateTable(
  knex: Knex,
  tableName: string
): Promise<void> {
  const RAW = `TRUNCATE TABLE "${tableName}" RESTART IDENTITY`
  await knex.raw(RAW)
}

export async function truncateTables(
  knex: Knex,
  truncateTenants = false,
  dbSchema?: string
): Promise<void> {
  const ignoreTables = [
    'knex_migrations',
    'knex_migrations_lock',
    'knex_migrations_backend',
    'knex_migrations_backend_lock',
    ...(truncateTenants ? [] : ['tenants']) // So we don't delete operator tenant
  ]
  const tables = await getTables(knex, dbSchema, ignoreTables)
  const RAW = `TRUNCATE TABLE "${tables}" RESTART IDENTITY`
  await knex.raw(RAW)
}

async function getTables(
  knex: Knex,
  dbSchema: string = 'public',
  ignoredTables: string[]
): Promise<string> {
  const result = await knex.raw(
    `SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='${dbSchema}'`
  )
  return result.rows
    .map((val: { tablename: string }) => {
      if (!ignoredTables.includes(val.tablename)) return val.tablename
    })
    .filter(Boolean)
    .join('","')
}
