import { LoaderArgs, json } from '@remix-run/node'
import { Form, useLoaderData } from '@remix-run/react'
import { useState } from 'react'
import { z } from 'zod'
import { PageHeader } from '~/components'
import { Button, ErrorPanel, Input } from '~/components/ui'
import { getIncomingPayment } from '~/lib/api/payments.server'
import { formatAmount } from '~/shared/utils'

export async function loader({ params }: LoaderArgs) {
  const incomingPaymentId = params.incomingPaymentId

  const result = z.string().uuid().safeParse(incomingPaymentId)
  if (!result.success) {
    throw json(null, {
      status: 400,
      statusText: 'Invalid incoming payment ID.'
    })
  }

  const incomingPayment = await getIncomingPayment({ id: result.data })

  if (!incomingPayment) {
    throw json(null, { status: 400, statusText: 'Incoming payment not found.' })
  }

  return json({
    incomingPayment: {
      ...incomingPayment,
      createdAt: new Date(incomingPayment.createdAt).toLocaleString(),
      expiresAt: new Date(incomingPayment.expiresAt).toLocaleString()
    }
  })
}

export default function ViewIncomingPaymentPage() {
  const { incomingPayment } = useLoaderData<typeof loader>()
  const [showMetadata, setShowMetadata] = useState(false)

  return (
    <div className='pt-4 flex flex-col space-y-4'>
      <div className='flex flex-col rounded-md bg-offwhite px-6'>
        {/* Incoming Payment General Info */}
        <PageHeader className='!justify-end'>
          <Button aria-label='go back to payments page' to='/payments'>
            Go to payments page
          </Button>
        </PageHeader>
        <div className='grid grid-cols-1 py-3 gap-6 md:grid-cols-3 border-b border-pearl'>
          {/* Incoming Payment General Info*/}
          <div className='col-span-1 pt-3'>
            <h3 className='text-lg font-medium'>General Information</h3>
            <p className='text-sm'>Created at {incomingPayment.createdAt}</p>
            {/* TODO: use or remove */}
            {/* <ErrorPanel errors={response?.errors.general.message} /> */}
          </div>
          <div className='md:col-span-2 bg-white rounded-md shadow-md'>
            <div className='w-full p-4 gap-4 grid grid-cols-1 lg:grid-cols-3'>
              <div>
                <p className='font-medium'>Incoming Payment ID</p>
                <p className='mt-1'>{incomingPayment.id}</p>
              </div>
              <div>
                <p className='font-medium'>Wallet Address ID</p>
                <p className='mt-1'>{incomingPayment.walletAddressId}</p>
              </div>
              <div>
                <p className='font-medium'>State</p>
                <p className='mt-1'>{incomingPayment.state}</p>
              </div>
              <div>
                <p className='font-medium'>Expires At</p>
                <p className='mt-1'>{incomingPayment.expiresAt}</p>
              </div>
              <div>
                {incomingPayment.metadata ? (
                  <>
                    <button
                      className='font-medium mb-1 cursor-pointer'
                      aria-label='toggle metadata visibility'
                      onClick={() => setShowMetadata(!showMetadata)} // Toggle metadata visibility
                    >
                      {showMetadata ? '▼' : '►'} Metadata
                    </button>
                    {showMetadata && incomingPayment.metadata && (
                      <pre className='mt-1'>
                        {JSON.stringify(incomingPayment.metadata, null, 2)}
                      </pre>
                    )}
                  </>
                ) : (
                  <>
                    <p className='font-medium'>Metadata</p>
                    <p className='mt-1'>
                      <em>None</em>
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* Incoming Payment General Info - END */}

        {/* Incoming Payment Incoming Amount */}
        <div className='grid grid-cols-1 py-3 gap-6 md:grid-cols-3 border-b border-pearl'>
          <div className='col-span-1 pt-3'>
            <h3 className='text-lg font-medium'>Incoming Amount</h3>
          </div>
          {incomingPayment.incomingAmount ? (
            <div className='md:col-span-2 bg-white rounded-md shadow-md'>
              <div className='w-full p-4 gap-4 grid grid-cols-1 lg:grid-cols-3'>
                <div>
                  <p className='font-medium'>Incoming Amount</p>
                  <p className='mt-1'>
                    {formatAmount(
                      incomingPayment.incomingAmount.value,
                      incomingPayment.incomingAmount.assetScale
                    )}
                  </p>
                </div>
                <div>
                  <p className='font-medium'>Asset Code</p>
                  <p className='mt-1'>
                    {incomingPayment.incomingAmount.assetCode}
                    USD
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className='md:col-span-2 bg-white rounded-md shadow-md'>
              <div className='w-full p-4 gap-4 grid grid-cols-1 lg:grid-cols-3'>
                <em>None</em>
              </div>
            </div>
          )}
        </div>
        {/* Incoming Payment Incoming Amount - END */}

        {/* Incoming Payment Received Amount */}
        <div className='grid grid-cols-1 py-3 gap-6 md:grid-cols-3 border-b border-pearl'>
          <div className='col-span-1 pt-3'>
            <h3 className='text-lg font-medium'>Received Amount</h3>
          </div>
          <div className='md:col-span-2 bg-white rounded-md shadow-md'>
            <div className='w-full p-4 gap-4 grid grid-cols-1 lg:grid-cols-3'>
              <div>
                <p className='font-medium'>Incoming Amount</p>
                <p className='mt-1'>
                  {formatAmount(
                    incomingPayment.receivedAmount.value,
                    incomingPayment.receivedAmount.assetScale
                  )}
                </p>
              </div>
              <div>
                <p className='font-medium'>Asset Code</p>
                <p className='mt-1'>
                  {incomingPayment.receivedAmount.assetCode}
                  USD
                </p>
              </div>
            </div>
          </div>
        </div>
        {/* Incoming Payment Received Amount - END */}

        {/* Peer Asset Info */}
        {/* TODO: refactor to incoming payment asset info */}
        {/* <div className='grid grid-cols-1 py-3 gap-6 md:grid-cols-3 border-b border-pearl'>
          <div className='col-span-1 pt-3'>
            <h3 className='text-lg font-medium'>Asset Information</h3>
          </div>
          <div className='md:col-span-2 bg-white rounded-md shadow-md'>
            <div className='w-full p-4 gap-4 grid grid-cols-1 lg:grid-cols-3'>
              <div>
                <p className='font-medium'>Code</p>
                <p className='mt-1'>{peer.asset.code}</p>
              </div>
              <div>
                <p className='font-medium'>Scale</p>
                <p className='mt-1'>{peer.asset.scale}</p>
              </div>
              <div>
                <p className='font-medium'>Withdrawal threshold</p>
                <p className='mt-1'>
                  {peer.asset.withdrawalThreshold ?? 'No withdrawal threshhold'}
                </p>
              </div>
            </div>
            <div className='flex justify-end p-4'>
              <Button
                aria-label='go to asset page'
                type='button'
                to={`/assets/${peer.asset.id}`}
              >
                View asset
              </Button>
            </div>
          </div>
        </div> */}
        {/* Peer Asset Info - END */}
        {/* TODO: refactor to incoming payment liquidity info */}
        {/* Peer Liquidity Info */}
        {/* <div className='grid grid-cols-1 py-3 gap-6 md:grid-cols-3 border-b border-pearl'>
          <div className='col-span-1 pt-3'>
            <h3 className='text-lg font-medium'>Liquidity Information</h3>
          </div>
          <div className='md:col-span-2 bg-white rounded-md shadow-md'>
            <div className='w-full p-4 flex justify-between items-center'>
              <div>
                <p className='font-medium'>Amount</p>
                <p className='mt-1'>
                  {formatAmount(peer.liquidity ?? '0', peer.asset.scale)}{' '}
                  {peer.asset.code}
                </p>
              </div>
              <div className='flex space-x-4'>
                <Button
                  aria-label='add peer liquidity page'
                  preventScrollReset
                  type='button'
                  to={`/peers/${peer.id}/add-liquidity`}
                >
                  Add liquidity
                </Button>
                <Button
                  aria-label='withdraw peer liquidity page'
                  preventScrollReset
                  type='button'
                  to={`/peers/${peer.id}/withdraw-liquidity`}
                >
                  Withdraw liquidity
                </Button>
              </div>
            </div>
          </div>
        </div> */}
        {/* Peer Liquidity Info - END */}
        {/* DELETE PEER - Danger zone */}
      </div>
    </div>
  )
}
