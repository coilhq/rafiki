import { Server } from 'http'
import { EventEmitter } from 'events'

import { IocContract } from '@adonisjs/fold'
import Knex from 'knex'
import Koa, { DefaultState } from 'koa'
import bodyParser from 'koa-bodyparser'
import { Logger } from 'pino'
import Router from '@koa/router'

import { Config as AppConfig } from './config/app'
import { MessageProducer } from './messaging/messageProducer'
import { createAccountService } from './account/service'
import { createUserService } from './user/service'
import { createSPSPHandler } from './spsp/endpoint'
import { WorkerUtils } from 'graphile-worker'

export interface AppContextData {
  logger: Logger
  closeEmitter: EventEmitter
  container: AppContainer
  // Set by @koa/router.
  params: { [key: string]: string }
}

export type AppContext = Koa.ParameterizedContext<DefaultState, AppContextData>

export interface AppServices {
  logger: Promise<Logger>
  messageProducer: Promise<MessageProducer>
  knex: Promise<Knex>
  closeEmitter: Promise<EventEmitter>
  config: Promise<typeof AppConfig>
  workerUtils: Promise<WorkerUtils>
}

export type AppContainer = IocContract<AppServices>

export class App {
  private koa!: Koa<DefaultState, AppContext>
  private publicRouter!: Router<DefaultState, AppContext>
  private server: Server | undefined
  public closeEmitter!: EventEmitter
  public isShuttingDown = false
  private logger!: Logger
  private messageProducer!: MessageProducer
  private config!: typeof AppConfig

  public constructor(private container: IocContract<AppServices>) {}

  /**
   * The boot function exists because the functions that we register on the container with the `bind` method are async.
   * We then need to await this function when we call use - which can't be done in the constructor. This is a first pass to
   * get the container working. We can refactor this in future. Perhaps don't use private members and just pass around the container?
   * Or provide start / shutdown methods on the services in the container?
   */
  public async boot(): Promise<void> {
    this.config = await this.container.use('config')
    this.koa = new Koa<DefaultState, AppContext>()
    this.closeEmitter = await this.container.use('closeEmitter')
    this.logger = await this.container.use('logger')
    this.koa.context.container = this.container
    this.koa.context.logger = await this.container.use('logger')
    this.koa.context.closeEmitter = await this.container.use('closeEmitter')
    this.messageProducer = await this.container.use('messageProducer')
    this.publicRouter = new Router()

    this.koa.use(
      async (
        ctx: {
          status: number
          set: (arg0: string, arg1: string) => void
          body: string
        },
        next: () => void | PromiseLike<void>
      ): Promise<void> => {
        if (this.isShuttingDown) {
          ctx.status = 503
          ctx.set('Connection', 'close')
          ctx.body = 'Server is in the process of restarting'
        } else {
          return next()
        }
      }
    )
    await this._setupRoutes()
  }

  public listen(port: number | string): void {
    this.server = this.koa.listen(port)
  }

  public async shutdown(): Promise<void> {
    return new Promise((resolve): void => {
      if (this.server) {
        this.isShuttingDown = true
        this.closeEmitter.emit('shutdown')
        this.server.close((): void => {
          resolve()
        })
      } else {
        resolve()
      }
    })
  }

  public getPort(): number {
    const address = this.server?.address()
    if (address && !(typeof address == 'string')) {
      return address.port
    }
    return 0
  }

  private async _setupRoutes(): Promise<void> {
    this.publicRouter.use(bodyParser())
    this.publicRouter.get('/healthz', (ctx: AppContext): void => {
      ctx.status = 200
    })

    const knex = await this.container.use('knex')
    this.publicRouter.get(
      '/pay/:id',
      await createSPSPHandler({
        config: this.config,
        accountService: await createAccountService({
          logger: this.logger,
          knex
        }),
        userService: await createUserService({ logger: this.logger, knex })
      })
    )

    this.koa.use(this.publicRouter.middleware())
  }
}
