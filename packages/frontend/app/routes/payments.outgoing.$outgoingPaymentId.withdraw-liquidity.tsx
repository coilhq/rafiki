import { type ActionArgs } from '@remix-run/node'
import { useNavigate, useOutletContext } from '@remix-run/react'
import { v4 } from 'uuid'
import { LiquidityConfirmDialog } from '~/components/LiquidityConfirmDialog'
import { withdrawOutgoingPaymentLiquidity } from '~/lib/api/payments.server'
import { messageStorage, setMessageAndRedirect } from '~/lib/message.server'

export default function OutgoingPaymentWithdrawLiquidity() {
  const displayLiquidityAmount = useOutletContext<string>()
  const navigate = useNavigate()
  const dismissDialog = () => navigate('..', { preventScrollReset: true })

  return (
    <LiquidityConfirmDialog
      onClose={dismissDialog}
      title='Withdraw liquidity'
      type='Withdraw'
      displayAmount={displayLiquidityAmount}
    />
  )
}

export async function action({ request, params }: ActionArgs) {
  const session = await messageStorage.getSession(request.headers.get('cookie'))
  const outgoingPaymentId = params.outgoingPaymentId

  if (!outgoingPaymentId) {
    return setMessageAndRedirect({
      session,
      message: {
        content: 'Missing outgoing payment ID',
        type: 'error'
      },
      location: '.'
    })
  }

  const response = await withdrawOutgoingPaymentLiquidity({
    outgoingPaymentId,
    idempotencyKey: v4()
  })

  if (!response?.success) {
    return setMessageAndRedirect({
      session,
      message: {
        content:
          response?.message ??
          'Could not withdraw outgoing payment liquidity. Please try again!',
        type: 'error'
      },
      location: '.'
    })
  }

  return setMessageAndRedirect({
    session,
    message: {
      content: response.message,
      type: 'success'
    },
    location: '..'
  })
}
