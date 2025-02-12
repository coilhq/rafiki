exports.up = function (knex) {
  return knex.schema.createTable('tenantSettings', function (table) {
    table.uuid('id').notNullable().primary()
    table.string('key').notNullable().index()
    table.string('value').notNullable()

    table
      .uuid('tenantId')
      .notNullable()
      .references('tenants.id')
      .index()
      .onDelete('CASCADE')

    table.timestamp('createdAt').index().defaultTo(knex.fn.now())
    table.timestamp('updatedAt').defaultTo(knex.fn.now())
    table.timestamp('deletedAt')

    // table.unique(['key', 'tenantId'])
  })
}

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('tenantSettings')
}
