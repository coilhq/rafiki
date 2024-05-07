import { redirect } from '@remix-run/node'
import axios from 'axios'
import variables from './envConfig.server'

export async function isLoggedIn(
  cookieHeader?: string | null
): Promise<boolean> {
  try {
    const session = await axios.get(
      `${variables.kratosContainerPublicUrl}/sessions/whoami`,
      {
        headers: {
          cookie: cookieHeader
        },
        withCredentials: true
      }
    )

    const isLoggedIn = session.status === 200 && session.data?.active

    return isLoggedIn
  } catch {
    return false
  }
}

export async function redirectIfUnauthorizedAccess(
  url: string,
  cookieHeader?: string | null
) {
  const isAuthPath = new URL(url).pathname.startsWith('/auth')

  if (!isAuthPath) {
    const loggedIn = await isLoggedIn(cookieHeader)
    if (!loggedIn) {
      throw redirect('/auth')
    }
  }
  return
}

export async function redirectIfAlreadyAuthorized(
  url: string,
  cookieHeader: string | null,
  redirectPath: string = '/'
) {
  const isAuthPath = new URL(url).pathname.startsWith('/auth')

  if (isAuthPath) {
    const loggedIn = await isLoggedIn(cookieHeader)
    if (loggedIn) {
      throw redirect(redirectPath)
    }
  }
  return
}
