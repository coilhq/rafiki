/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable('fees', function (table) {
    table.uuid('id').primary()
    table.uuid('assetId').references('assets.id').notNullable()
    table.enum('type', ['SENDING', 'RECEIVING']).notNullable()
    table.timestamp('createdAt').defaultTo(knex.fn.now())
    table.timestamp('activatedAt')
    table.bigInteger('fixedFee')
    table
      .decimal('percentageFee', 5, 4)
      .checkBetween([0, 1], 'fees_percentagefee_check')
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('fees')
}
