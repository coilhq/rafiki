exports.up = function (knex) {
  return knex.schema
    .table('webhookEvents', function (table) {
      table
        .uuid('outgoingPaymentId')
        .nullable()
        .references('outgoingPayments.id')
        .index()
        .onDelete('CASCADE')
      table
        .uuid('incomingPaymentId')
        .nullable()
        .references('incomingPayments.id')
        .index()
        .onDelete('CASCADE')
      table
        .uuid('walletAddressId')
        .nullable()
        .references('walletAddresses.id')
        .index()
        .onDelete('CASCADE')
      table
        .uuid('peerId')
        .nullable()
        .references('peers.id')
        .index()
        .onDelete('CASCADE')
      table
        .uuid('assetId')
        .nullable()
        .references('assets.id')
        .index()
        .onDelete('CASCADE')
    })
    .then(() => {
      return knex('webhookEvents').update({
        incomingPaymentId: knex.raw(
          "CASE WHEN type LIKE 'incoming_payment.%' THEN (data->>'id')::uuid END"
        ),
        outgoingPaymentId: knex.raw(
          "CASE WHEN type LIKE 'outgoing_payment.%' THEN (data->>'id')::uuid END"
        ),
        walletAddressId: knex.raw(
          "CASE WHEN type = 'wallet_address.web_monetization' THEN (data->'walletAddress'->>'id')::uuid END"
        ),
        peerId: knex.raw(
          "CASE WHEN type LIKE 'peer.%' THEN (data->>'id')::uuid END"
        ),
        assetId: knex.raw(
          "CASE WHEN type LIKE 'asset.%' THEN (data->>'id')::uuid END"
        )
      })
    })
    .then(() => {
      return knex.schema.table('webhookEvents', function (table) {
        table.check(
          ` (CASE WHEN type != 'wallet_address.not_found' THEN
            (
              ("outgoingPaymentId" IS NOT NULL)::int +
              ("incomingPaymentId" IS NOT NULL)::int +
              ("walletAddressId" IS NOT NULL)::int +
              ("peerId" IS NOT NULL)::int +
              ("assetId" IS NOT NULL)::int
            ) = 1
            ELSE
            (
              ("outgoingPaymentId" IS NOT NULL)::int +
              ("incomingPaymentId" IS NOT NULL)::int +
              ("walletAddressId" IS NOT NULL)::int +
              ("peerId" IS NOT NULL)::int +
              ("assetId" IS NOT NULL)::int
            ) = 0
            END)
          `,
          null,
          'webhookevents_related_resource_constraint'
        )
      })
    })
}

exports.down = function (knex) {
  return knex.schema
    .raw(
      'ALTER TABLE "webhookEvents" DROP CONSTRAINT IF EXISTS webhookevents_related_resource_constraint'
    )
    .then(() => {
      return knex.schema.table('webhookEvents', function (table) {
        table.dropColumn('incomingPaymentId')
        table.dropColumn('outgoingPaymentId')
        table.dropColumn('walletAddressId')
        table.dropColumn('peerId')
        table.dropColumn('assetId')
      })
    })
}
