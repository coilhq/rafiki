import { json, type ActionArgs, type LoaderArgs } from '@remix-run/node'
import {
  Form,
  Outlet,
  useActionData,
  useFormAction,
  useLoaderData,
  useNavigation
} from '@remix-run/react'
import { useState } from 'react'
import { z } from 'zod'
import { PageHeader } from '~/components'
import { Button, ErrorPanel, Input } from '~/components/ui'
import { FeeType } from '~/generated/graphql'
import { getAssetInfo, updateAsset, setFee } from '~/lib/api/asset.server'
import { messageStorage, setMessageAndRedirect } from '~/lib/message.server'
import { updateAssetSchema, setAssetFeeSchema } from '~/lib/validate.server'
import type { ZodFieldErrors } from '~/shared/types'
import { formatAmount } from '~/shared/utils'

export async function loader({ params }: LoaderArgs) {
  const assetId = params.assetId

  const result = z.string().uuid().safeParse(assetId)
  if (!result.success) {
    throw json(null, { status: 400, statusText: 'Invalid asset ID.' })
  }

  const asset = await getAssetInfo({ id: result.data })

  if (!asset) {
    throw json(null, { status: 404, statusText: 'Asset not found.' })
  }

  return json({
    asset: {
      ...asset,
      createdAt: new Date(asset.createdAt).toLocaleString(),
      ...(asset.sendingFee
        ? {
            sendingFee: {
              ...asset.sendingFee,
              createdAt: new Date(asset.sendingFee.createdAt).toLocaleString()
            }
          }
        : {})
    }
  })
}

export default function ViewAssetPage() {
  const { asset } = useLoaderData<typeof loader>()
  const response = useActionData<typeof action>()
  const navigation = useNavigation()
  const formAction = useFormAction()

  const isSubmitting = navigation.state === 'submitting'
  const currentPageAction = isSubmitting && navigation.formAction === formAction

  const [basisPointsInput, setBasisPointsInput] = useState(
    asset.sendingFee?.basisPoints ?? undefined
  )

  return (
    <div className='pt-4 flex flex-col space-y-4'>
      <div className='flex flex-col rounded-md bg-offwhite px-6'>
        <PageHeader className='!justify-end'>
          <Button aria-label='go back to assets page' to='/assets'>
            Go to assets page
          </Button>
        </PageHeader>
        <div className='grid grid-cols-1 py-3 gap-6 md:grid-cols-3 border-b border-pearl'>
          <div className='col-span-1 pt-3'>
            <h3 className='text-lg font-medium'>General Information</h3>
            <p className='text-sm'>Created at {asset.createdAt}</p>
            <ErrorPanel errors={response?.errors.general.message} />
          </div>
          <div className='md:col-span-2 bg-white rounded-md shadow-md'>
            <Form method='post' replace preventScrollReset>
              <fieldset disabled={currentPageAction}>
                <div className='w-full p-4 space-y-3'>
                  <Input type='hidden' name='id' value={asset.id} />
                  <Input label='Asset ID' value={asset.id} disabled readOnly />
                  <Input label='Code' value={asset.code} disabled readOnly />
                  <Input label='Scale' value={asset.scale} disabled readOnly />
                  <Input
                    type='number'
                    name='withdrawalThreshold'
                    label='Withdrawal Threshold'
                    defaultValue={asset.withdrawalThreshold ?? undefined}
                    error={
                      response?.errors.general.fieldErrors.withdrawalThreshold
                    }
                  />
                </div>
                <div className='flex justify-end p-4'>
                  <Button
                    aria-label='save general information'
                    type='submit'
                    name='intent'
                    value='general'
                  >
                    {currentPageAction ? 'Saving ...' : 'Save'}
                  </Button>
                </div>
              </fieldset>
            </Form>
          </div>
        </div>
        {/* Asset Liquidity Info */}
        <div className='grid grid-cols-1 py-3 gap-6 md:grid-cols-3 border-b border-pearl'>
          <div className='col-span-1 pt-3'>
            <h3 className='text-lg font-medium'>Liquidity Information</h3>
          </div>
          <div className='md:col-span-2 bg-white rounded-md shadow-md'>
            <div className='w-full p-4 flex justify-between items-center'>
              <div>
                <p className='font-medium'>Amount</p>
                <p className='mt-1'>
                  {formatAmount(asset.liquidity ?? '0', asset.scale)}{' '}
                  {asset.code}
                </p>
              </div>
              <div className='flex space-x-4'>
                <Button
                  aria-label='add asset liquidity page'
                  type='button'
                  to={`/assets/${asset.id}/add-liquidity`}
                >
                  Add liquidity
                </Button>
                <Button
                  aria-label='withdraw asset liquidity page'
                  type='button'
                  to={`/assets/${asset.id}/withdraw-liquidity`}
                >
                  Withdraw liquidity
                </Button>
              </div>
            </div>
          </div>
        </div>
        {/* Asset Liquidity Info - END */}
        {/* Asset Fee Info */}
        <div className='grid grid-cols-1 py-3 gap-6 md:grid-cols-3 border-b border-pearl'>
          <div className='col-span-1 pt-3'>
            <h3 className='text-lg font-medium'>Sending Fee</h3>
            {asset.sendingFee ? (
              <p className='text-sm'>Created at {asset.sendingFee.createdAt}</p>
            ) : null}
            <ErrorPanel errors={response?.errors.sendingFee.message} />
          </div>
          <div className='md:col-span-2 bg-white rounded-md shadow-md'>
            <div className='flex justify-end p-4'>
              <Button
                aria-label='view asset fees page'
                type='button'
                to={`/assets/${asset.id}/fee-history`}
              >
                Fee history
              </Button>
            </div>
            <Form method='post' replace preventScrollReset>
              <fieldset disabled={currentPageAction}>
                <div className='w-full p-4 space-y-3'>
                  <Input type='hidden' name='assetId' value={asset.id} />
                  <Input
                    type='number'
                    name='fixed'
                    label='Fixed Fee'
                    defaultValue={asset.sendingFee?.fixed ?? undefined}
                    error={response?.errors.sendingFee.fieldErrors.fixed}
                  />
                  <Input
                    type='number'
                    name='basisPoints'
                    label='Basis Points'
                    error={response?.errors.sendingFee.fieldErrors.basisPoints}
                    value={basisPointsInput}
                    onChange={(e) =>
                      setBasisPointsInput(parseFloat(e?.target?.value))
                    }
                  />
                  <p className='text-gray-500 text-sm mt-2'>
                    A single basis point is a fee equal to 0.01% of the total
                    amount. A fee of {basisPointsInput || 1} basis point on $100
                    is ${((basisPointsInput || 1) * 0.01).toFixed(4)}.
                  </p>
                  <div className='flex justify-end p-4'>
                    <Button
                      aria-label='save sending fee information'
                      type='submit'
                      name='intent'
                      value='sending-fees'
                    >
                      {currentPageAction ? 'Saving ...' : 'Save'}
                    </Button>
                  </div>
                </div>
              </fieldset>
            </Form>
          </div>
        </div>
        {/* Asset Fee Info - END */}
      </div>
      <Outlet />
    </div>
  )
}

export async function action({ request }: ActionArgs) {
  const actionResponse: {
    errors: {
      general: {
        fieldErrors: ZodFieldErrors<typeof updateAssetSchema>
        message: string[]
      }
      sendingFee: {
        fieldErrors: ZodFieldErrors<typeof setAssetFeeSchema>
        message: string[]
      }
    }
  } = {
    errors: {
      general: {
        fieldErrors: {},
        message: []
      },
      sendingFee: {
        fieldErrors: {},
        message: []
      }
    }
  }

  const formData = await request.formData()
  const intent = formData.get('intent')
  formData.delete('intent')

  switch (intent) {
    case 'general': {
      const result = updateAssetSchema.safeParse(Object.fromEntries(formData))
      if (!result.success) {
        actionResponse.errors.general.fieldErrors =
          result.error.flatten().fieldErrors
        return json({ ...actionResponse }, { status: 400 })
      }

      const response = await updateAsset({
        ...result.data,
        ...(result.data.withdrawalThreshold
          ? { withdrawalThreshold: result.data.withdrawalThreshold }
          : { withdrawalThreshold: undefined })
      })

      if (!response?.success) {
        actionResponse.errors.general.message = [
          response?.message ?? 'Could not update asset. Please try again!'
        ]
        return json({ ...actionResponse }, { status: 400 })
      }

      break
    }
    case 'sending-fees': {
      const result = setAssetFeeSchema.safeParse(Object.fromEntries(formData))
      if (!result.success) {
        actionResponse.errors.sendingFee.fieldErrors =
          result.error.flatten().fieldErrors
        return json({ ...actionResponse }, { status: 400 })
      }

      const response = await setFee({
        assetId: result.data.assetId,
        type: FeeType.Sending,
        fee: {
          fixed: result.data.fixed,
          basisPoints: result.data.basisPoints
        }
      })

      if (!response?.success) {
        actionResponse.errors.sendingFee.message = [
          response?.message ??
            'Could not update asset sending fee. Please try again!'
        ]
        return json({ ...actionResponse }, { status: 400 })
      }

      break
    }
    default:
      throw json(null, { status: 400, statusText: 'Invalid intent.' })
  }

  const session = await messageStorage.getSession(request.headers.get('cookie'))

  return setMessageAndRedirect({
    session,
    message: {
      content: 'Asset information was updated',
      type: 'success'
    },
    location: '.'
  })
}
