import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers'
import tmp from 'tmp'

import { Config } from '../config/app'

const TIGERBEETLE_PORT = 3004
const TIGERBEETLE_DIR = '/var/lib/tigerbeetle'
const TIGERBEETLE_CONTAINER_LOG =
  process.env.TIGERBEETLE_CONTAINER_LOG === 'true'

export async function startTigerbeetleContainer(
  clusterId?: number
): Promise<{ container: StartedTestContainer; port: number }> {
  const tigerbeetleClusterId = clusterId || Config.tigerbeetleClusterId
  const { name: tigerbeetleDir } = tmp.dirSync({ unsafeCleanup: true })
  const tigerbeetleFile = `cluster_${tigerbeetleClusterId}_replica_0_test.tigerbeetle`

  const tbContFormat = await new GenericContainer(
    'ghcr.io/tigerbeetledb/tigerbeetle@sha256:834d82a83d60ace236d93a724b303029bf935219409fd57dfdd05b57d3a68252'
  )
    .withExposedPorts(TIGERBEETLE_PORT)
    .withBindMounts([
      {
        source: tigerbeetleDir,
        target: TIGERBEETLE_DIR
      }
    ])
    .withAddedCapabilities('IPC_LOCK')
    .withCommand([
      'format',
      '--cluster=' + tigerbeetleClusterId,
      '--replica=0',
      `${TIGERBEETLE_DIR}/${tigerbeetleFile}`
    ])
    .withWaitStrategy(
      Wait.forLogMessage(`info(io): creating "${tigerbeetleFile}"...`)
    )
    .start()

  const streamTbFormat = await tbContFormat.logs()
  if (TIGERBEETLE_CONTAINER_LOG) {
    streamTbFormat
      .on('data', (line) => console.log(line))
      .on('err', (line) => console.error(line))
      .on('end', () => console.log('Stream closed for [tb-format]'))
  }

  // Give TB a chance to startup (no message currently to notify allocation is complete):
  await new Promise((f) => setTimeout(f, 3000))

  const tbContStart = await new GenericContainer(
    'ghcr.io/tigerbeetledb/tigerbeetle@sha256:834d82a83d60ace236d93a724b303029bf935219409fd57dfdd05b57d3a68252'
  )
    .withExposedPorts(TIGERBEETLE_PORT)
    .withBindMounts([
      {
        source: tigerbeetleDir,
        target: TIGERBEETLE_DIR
      }
    ])
    .withAddedCapabilities('IPC_LOCK')
    .withCommand([
      'start',
      '--addresses=0.0.0.0:' + TIGERBEETLE_PORT,
      `${TIGERBEETLE_DIR}/${tigerbeetleFile}`
    ])
    .withWaitStrategy(
      Wait.forLogMessage(
        `info(main): 0: cluster=${tigerbeetleClusterId}: listening on 0.0.0.0:${TIGERBEETLE_PORT}`
      )
    )
    .start()

  const streamTbStart = await tbContStart.logs()
  if (TIGERBEETLE_CONTAINER_LOG) {
    streamTbStart
      .on('data', (line) => console.log(line))
      .on('err', (line) => console.error(line))
      .on('end', () => console.log('Stream closed for [tb-start]'))
  }
  return {
    container: tbContStart,
    port: tbContStart.getMappedPort(TIGERBEETLE_PORT)
  }
}
