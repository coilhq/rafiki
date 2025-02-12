/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema
    .alterTable('incomingPayments', function (table) {
      table.uuid('tenantId')
      table.foreign('tenantId').references('id').inTable('tenants')
    })
    .then(() => {
      knex.raw(
        `UPDATE "incomingPayments" SET "tenantId" = (SELECT id from "tenants" LIMIT 1)`
      )
    })
    .then(() => {
      knex.schema.alterTable('incomingPayments', function (table) {
        table.uuid('tenantId').notNullable()
      })
    })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.alterTable('incomingPayments', function (table) {
    table.dropForeign('tenantId')
    table.dropColumn('tenantId')
  })
}
