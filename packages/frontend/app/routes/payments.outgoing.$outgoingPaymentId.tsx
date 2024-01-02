import type { LoaderArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { Link, Outlet, useLoaderData } from '@remix-run/react'
import { useState } from 'react'
import { z } from 'zod'
import { Badge, PageHeader } from '~/components'
import { Button } from '~/components/ui'
import { OutgoingPaymentState } from '~/generated/graphql'
import { getOutgoingPayment } from '~/lib/api/payments.server'
import {
  badgeColorByPaymentState,
  formatAmount,
  prettify
} from '~/shared/utils'

export async function loader({ params }: LoaderArgs) {
  const outgoingPaymentId = params.outgoingPaymentId

  const result = z.string().uuid().safeParse(outgoingPaymentId)
  if (!result.success) {
    throw json(null, {
      status: 400,
      statusText: 'Outgoing payment ID is not valid.'
    })
  }

  const outgoingPayment = await getOutgoingPayment({ id: result.data })

  if (!outgoingPayment) {
    throw json(null, { status: 400, statusText: 'Outgoing payment not found.' })
  }

  return json({
    outgoingPayment: {
      ...outgoingPayment,
      createdAt: new Date(outgoingPayment.createdAt).toLocaleString()
    }
  })
}

export default function ViewOutgoingPaymentPage() {
  const { outgoingPayment } = useLoaderData<typeof loader>()

  return (
    <div className='pt-4 flex flex-col space-y-4'>
      <div className='flex flex-col rounded-md bg-offwhite px-6'>
        {/* Outgoing Payment General Info */}
        <PageHeader className='!justify-end'>
          <Button aria-label='go back to payments page' to='/payments'>
            Go to payments page
          </Button>
        </PageHeader>
        <div className='grid grid-cols-1 py-3 gap-6 md:grid-cols-3 border-b border-pearl'>
          {/* Outgoing Payment General Info*/}
          <div className='col-span-1 pt-3'>
            <h3 className='text-lg font-medium'>General Information</h3>
            <p className='text-sm mb-2'>
              Created at {outgoingPayment.createdAt}{' '}
              <Badge color={badgeColorByPaymentState[outgoingPayment.state]}>
                {outgoingPayment.state}
              </Badge>
            </p>
          </div>
          <div className='md:col-span-2 bg-white rounded-md shadow-md'>
            <div className='w-full p-4 space-y-3'>
              <div>
                <p className='font-medium'>Outgoing Payment ID</p>
                <p className='mt-1'>{outgoingPayment.id}</p>
              </div>
              <div>
                <p className='font-medium'>
                  Wallet Address ID{' '}
                  <Button
                    className='mt-1 ml-1'
                    aria-label='go to wallet address page'
                    type='button'
                    size='xs'
                    to={`/wallet-addresses/${outgoingPayment.walletAddressId}`}
                  >
                    ↗️
                  </Button>
                </p>
                <p className='mt-1'>{outgoingPayment.walletAddressId}</p>
              </div>
              <div>
                <p className='font-medium'>Receiver</p>
                <Link
                  className='underline text-blue-600 hover:text-blue-800 visited:text-purple-600'
                  to={outgoingPayment.receiver}
                >
                  {outgoingPayment.receiver}
                </Link>
              </div>
              <div>
                <p className='font-medium'>Received Amount</p>
                <p className='mt-1'>
                  {formatAmount(
                    outgoingPayment.receiveAmount.value,
                    outgoingPayment.receiveAmount.assetScale
                  ) +
                    ' ' +
                    outgoingPayment.receiveAmount.assetCode}
                </p>
              </div>
              <div>
                <p className='font-medium'>Debit Amount</p>
                <p className='mt-1'>
                  {formatAmount(
                    outgoingPayment.debitAmount.value,
                    outgoingPayment.debitAmount.assetScale
                  ) +
                    ' ' +
                    outgoingPayment.debitAmount.assetCode}
                </p>
              </div>
              <div>
                <p className='font-medium'>Sent Amount</p>
                <p className='mt-1'>
                  {formatAmount(
                    outgoingPayment.sentAmount.value,
                    outgoingPayment.sentAmount.assetScale
                  ) +
                    ' ' +
                    outgoingPayment.sentAmount.assetCode}
                </p>
              </div>
              <div>
                <p className='font-medium'>Error</p>
                {outgoingPayment.error ? (
                  <p className='mt-1 text-red-500'>{outgoingPayment.error}</p>
                ) : (
                  <em>None</em>
                )}
              </div>
              <div>
                {outgoingPayment.metadata ? (
                  <details>
                    <summary>Metadata</summary>
                    <pre
                      className='mt-1 text-sm'
                      dangerouslySetInnerHTML={{
                        __html: prettify(outgoingPayment.metadata)
                      }}
                    />
                  </details>
                ) : (
                  <div>
                    <p className='font-medium'>Metadata</p>
                    <p className='mt-1'>
                      <em>None</em>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* Outgoing Payment General Info - END */}

        {/* Outgoing Payment Liquidity */}
        <div className='grid grid-cols-1 py-3 gap-6 md:grid-cols-3 border-b border-pearl'>
          <div className='col-span-1 pt-3'>
            <h3 className='text-lg font-medium'>Liquidity Information</h3>
          </div>
          <div className='md:col-span-2 bg-white rounded-md shadow-md'>
            <div className='w-full p-4 flex justify-between items-center'>
              <div>
                <p className='font-medium'>Amount</p>
                <p className='mt-1'>
                  {formatAmount(
                    outgoingPayment.liquidity ?? '0',
                    outgoingPayment.sentAmount.assetScale
                  )}{' '}
                  {outgoingPayment.sentAmount.assetCode}
                </p>
              </div>
              <div className='flex space-x-4'>
                {BigInt(outgoingPayment.liquidity ?? '0') ? (
                  <Button
                    aria-label='withdraw outgoing payment liquidity page'
                    preventScrollReset
                    to={`/payments/outgoing/${outgoingPayment.id}/withdraw-liquidity`}
                  >
                    Withdraw
                  </Button>
                ) : (
                  <Button
                    disabled={true}
                    aria-label='withdraw outgoing payment liquidity page'
                  >
                    Withdraw
                  </Button>
                )}
                {outgoingPayment.state === OutgoingPaymentState.Funding ? (
                  <Button
                    aria-label='deposit outgoing payment liquidity page'
                    preventScrollReset
                    to={`/payments/outgoing/${outgoingPayment.id}/deposit-liquidity`}
                  >
                    Deposit
                  </Button>
                ) : (
                  <Button
                    disabled={true}
                    aria-label='deposit outgoing payment liquidity page'
                  >
                    Deposit
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* Outgoing Payment Liquidity - END */}
      </div>
      <Outlet />
    </div>
  )
}
