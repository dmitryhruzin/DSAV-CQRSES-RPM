import knex from 'knex'
import { Injectable } from '@nestjs/common'
import { InjectConnection } from 'nest-knexjs'
import { InjectLogger, Logger } from '@DSAV-CQRSES-RPM/logger'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { BaseProjection } from '../../infra/base.projection.js'
import { Paginated, VersionMismatchError } from '../../types/common.js'
import { OrderMainDBUpdatePayload, OrderMainDBRecord, OrderMain } from '../../types/order.js'

const mapPayloadToDbFormat = (payload: OrderMainDBUpdatePayload): OrderMainDBRecord => ({
  id: payload.id,
  title: payload.title,
  price: payload.price,
  discount: payload.discount,
  priority: payload.priority,
  status: payload.status,
  approved: payload.approved,
  version: payload.version
})

const mapPayloadFromDbFormat = (dbRecord: any): OrderMain => ({
  id: dbRecord.id,
  title: dbRecord.title,
  price: dbRecord.price,
  discount: dbRecord.discount,
  priority: dbRecord.priority,
  status: dbRecord.status,
  approved: dbRecord.approved
})

@Injectable()
export class OrderMainProjection extends BaseProjection {
  constructor(
    private readonly eventStore: EventStoreRepository,
    @InjectConnection() readonly knexConnection: knex.Knex,
    @InjectLogger(OrderMainProjection.name) readonly logger: Logger
  ) {
    super(knexConnection, logger, 'orders')
  }

  async onModuleInit() {
    if (!(await this.knexConnection.schema.hasTable(this.tableName))) {
      await this.knexConnection.schema.createTable(this.tableName, (table) => {
        table.string('id').primary()
        table.string('title')
        table.string('price')
        table.string('discount')
        table.integer('priority')
        table.string('status')
        table.boolean('approved')
        table.integer('version')
      })
      await this.knexConnection.schema.createTable(this.snapshotTableName, (table) => {
        table.string('id').primary()
        table.string('title')
        table.string('price')
        table.string('discount')
        table.integer('priority')
        table.string('status')
        table.boolean('approved')
        table.integer('version')
        table.integer('last_event_id')
      })
    }
  }

  async save(record: OrderMainDBUpdatePayload): Promise<boolean> {
    await this.knexConnection.table(this.tableName).insert([mapPayloadToDbFormat(record)])

    return true
  }

  async update(id: string, payload: OrderMainDBUpdatePayload, tryCounter = 0): Promise<boolean> {
    const trx = await this.knexConnection.transaction()
    try {
      const record = await this.knexConnection.table(this.tableName).transacting(trx).forUpdate().where({ id }).first()
      if (!record || record.version + 1 !== payload.version) {
        throw new VersionMismatchError(
          `Version mismatch for Order with id: ${id}, current version: ${record?.version}, new version: ${payload.version}`
        )
      }
      await this.knexConnection
        .table(this.tableName)
        .transacting(trx)
        .update(mapPayloadToDbFormat(payload))
        .where({ id })
      await trx.commit()

      return true
    } catch (e) {
      await trx.rollback()

      if (e instanceof VersionMismatchError) {
        if (tryCounter < 3) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
          return this.update(id, payload, tryCounter + 1)
        } else {
          this.logger.warn(e)
          return true
        }
      }
      throw e
    }
  }

  async getAll(page: number, pageSize: number): Promise<Paginated<OrderMain>> {
    const records = await this.knexConnection
      .table(this.tableName)
      .select('id', 'title', 'price', 'discount', 'priority', 'status', 'approved')
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total = await this.knexConnection.table(this.tableName).count<{ count: number }[]>('* as count').first()
    return { items: records.map(mapPayloadFromDbFormat), page, pageSize, total: total?.count || 0 }
  }

  async getById(id: string): Promise<OrderMain> {
    const record = await this.knexConnection
      .table(this.tableName)
      .select('id', 'title', 'price', 'discount', 'priority', 'status', 'approved')
      .where({ id })
      .first()

    if (!record) {
      throw new Error(`Order with id: ${id} not found`)
    }

    return mapPayloadFromDbFormat(record)
  }

  async rebuild() {
    const eventNames = [
      'OrderCreated',
      'OrderPriceChanged',
      'OrderDiscountApplied',
      'OrderPrioritySet',
      'OrderStatusChanged',
      'OrderApproved'
    ]

    let lastEventID = await this.applySnapshot()
    let events = await this.eventStore.getEventsByName(eventNames, lastEventID)
    while (events.length > 0) {
      for (let i = 0; i < events.length; i += 1) {
        switch (events[i].name) {
          case 'OrderCreated': {
            const { id, title, price, discount, priority, status, approved } = events[i].body as {
              id: string
              title: string
              price: string
              discount: string
              priority: number
              status: string
              approved: boolean
            }
            if (!id || !title || !price || !discount || priority === undefined || !status || approved === undefined) {
              this.logger.warn(`event with id: ${events[i].id} is missing required fields`)
              break
            }

            await this.save({ id, title, price, discount, priority, status, approved, version: 1 })
            break
          }
          case 'OrderPriceChanged': {
            const { price } = events[i].body as { price: string }
            if (!price) {
              this.logger.warn(`event with id: ${events[i].id} is missing price`)
              break
            }

            await this.update(events[i].aggregateId, {
              price,
              version: events[i].aggregateVersion
            })
            break
          }
          case 'OrderDiscountApplied': {
            const { discount } = events[i].body as { discount: string }
            if (!discount) {
              this.logger.warn(`event with id: ${events[i].id} is missing discount`)
              break
            }

            await this.update(events[i].aggregateId, {
              discount,
              version: events[i].aggregateVersion
            })
            break
          }
          case 'OrderPrioritySet': {
            const { priority } = events[i].body as { priority: number }
            if (priority === undefined) {
              this.logger.warn(`event with id: ${events[i].id} is missing priority`)
              break
            }

            await this.update(events[i].aggregateId, {
              priority,
              version: events[i].aggregateVersion
            })
            break
          }
          case 'OrderStatusChanged': {
            const { status } = events[i].body as { status: string }
            if (!status) {
              this.logger.warn(`event with id: ${events[i].id} is missing status`)
              break
            }

            await this.update(events[i].aggregateId, {
              status,
              version: events[i].aggregateVersion
            })
            break
          }
          case 'OrderApproved': {
            const { approved } = events[i].body as { approved: boolean }
            if (approved === undefined) {
              this.logger.warn(`event with id: ${events[i].id} is missing approved`)
              break
            }

            await this.update(events[i].aggregateId, {
              approved,
              version: events[i].aggregateVersion
            })
            break
          }
          default: {
            break
          }
        }
      }
      lastEventID = events[events.length - 1].id
      this.logger.info(`Applied events from ${events[0].id} to ${lastEventID}`)

      events = await this.eventStore.getEventsByName(eventNames, lastEventID)
    }

    await this.createSnapshot(lastEventID)

    this.logger.info('Rebuild projection finished!')
    return 0
  }
}
