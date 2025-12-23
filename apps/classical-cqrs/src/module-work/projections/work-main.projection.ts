import knex from 'knex'
import { Injectable } from '@nestjs/common'
import { InjectConnection } from 'nest-knexjs'
import { InjectLogger, Logger } from '@DSAV-CQRSES-RPM/logger'
import { WorkMain, WorkMainDBUpdatePayload, WorkMainDBRecord } from '../../types/work.js'
import { Paginated, VersionMismatchError } from '../../types/common.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { BaseProjection } from '../../infra/base.projection.js'

const mapPayloadToDbFormat = (payload: WorkMainDBUpdatePayload): WorkMainDBRecord => ({
  id: payload.id,
  title: payload.title,
  description: payload.description,
  estimate: payload.estimate,
  status: payload.status,
  assigned_to: payload.assignedTo,
  order_id: payload.orderID,
  version: payload.version
})

const mapPayloadFromDbFormat = (dbRecord: any): WorkMain => ({
  id: dbRecord.id,
  title: dbRecord.title,
  description: dbRecord.description,
  estimate: dbRecord.estimate ? dbRecord.estimate : undefined,
  status: dbRecord.status,
  assignedTo: dbRecord.assigned_to ? dbRecord.assigned_to : undefined,
  orderID: dbRecord.order_id ? dbRecord.order_id : undefined
})

@Injectable()
export class WorkMainProjection extends BaseProjection {
  constructor(
    private readonly eventStore: EventStoreRepository,
    @InjectConnection() readonly knexConnection: knex.Knex,
    @InjectLogger(WorkMainProjection.name) readonly logger: Logger
  ) {
    super(knexConnection, logger, 'works')
  }

  async onModuleInit() {
    if (!(await this.knexConnection.schema.hasTable(this.tableName))) {
      await this.knexConnection.schema.createTable(this.tableName, (table) => {
        table.string('id').primary()
        table.string('title')
        table.string('description')
        table.string('estimate')
        table.string('status')
        table.string('assigned_to')
        table.string('order_id')
        table.integer('version')
      })
      await this.knexConnection.schema.createTable(this.snapshotTableName, (table) => {
        table.string('id').primary()
        table.string('title')
        table.string('description')
        table.string('estimate')
        table.string('status')
        table.string('assigned_to')
        table.string('order_id')
        table.integer('last_event_id')
      })
    }
  }

  async save(record: WorkMainDBUpdatePayload): Promise<boolean> {
    await this.knexConnection.table(this.tableName).insert([mapPayloadToDbFormat(record)])

    return true
  }

  async update(id: string, payload: WorkMainDBUpdatePayload, tryCounter = 0): Promise<boolean> {
    const trx = await this.knexConnection.transaction()
    try {
      const record = await this.knexConnection.table(this.tableName).transacting(trx).forUpdate().where({ id }).first()
      if (!record || record.version + 1 !== payload.version) {
        throw new VersionMismatchError(
          `Version mismatch for Work with id: ${id}, current version: ${record?.version}, new version: ${payload.version}`
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

  async getAll(page: number, pageSize: number): Promise<Paginated<WorkMain>> {
    const records = await this.knexConnection
      .table(this.tableName)
      .select('id', 'title', 'description', 'estimate', 'status', 'assigned_to', 'order_id')
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total = await this.knexConnection.table(this.tableName).count<{ count: number }[]>('* as count').first()
    return { items: records.map(mapPayloadFromDbFormat), page, pageSize, total: total?.count || 0 }
  }

  async getById(id: string): Promise<WorkMain> {
    const record = await this.knexConnection
      .table(this.tableName)
      .select('id', 'title', 'description', 'estimate', 'status', 'assigned_to', 'order_id')
      .where({ id })
      .first()

    if (!record) {
      throw new Error(`Work with id: ${id} not found`)
    }

    return mapPayloadFromDbFormat(record)
  }

  async rebuild() {
    const eventNames = [
      'WorkCreated',
      'WorkTitleChanged',
      'WorkDescriptionChanged',
      'WorkEstimateSet',
      'WorkStatusChanged',
      'WorkAssignedToWorker',
      'WorkUnassignedFromWorker',
      'WorkAddedToOrder',
      'WorkRemovedFromOrder'
    ]

    let lastEventID = await this.applySnapshot()
    let events = await this.eventStore.getEventsByName(eventNames, lastEventID)
    while (events.length > 0) {
      for (let i = 0; i < events.length; i += 1) {
        switch (events[i].name) {
          case 'WorkCreated': {
            const { id, title, description, status } = events[i].body as {
              id: string
              title: string
              description: string
              status: string
            }
            if (!id || !title || !description || !status) {
              this.logger.warn(`event with id: ${events[i].id} is missing id, title, description, or status`)
              break
            }

            await this.save({ id, title, description, status, version: 1 })
            break
          }
          case 'WorkTitleChanged': {
            const { title } = events[i].body as { title: string }
            if (!title) {
              this.logger.warn(`event with id: ${events[i].id} is missing title`)
              break
            }

            await this.update(events[i].aggregateId, {
              title,
              version: events[i].aggregateVersion
            })
            break
          }
          case 'WorkDescriptionChanged': {
            const { description } = events[i].body as { description: string }
            if (!description) {
              this.logger.warn(`event with id: ${events[i].id} is missing description`)
              break
            }

            await this.update(events[i].aggregateId, {
              description,
              version: events[i].aggregateVersion
            })
            break
          }
          case 'WorkEstimateSet': {
            const { estimate } = events[i].body as { estimate: string }
            if (!estimate) {
              this.logger.warn(`event with id: ${events[i].id} is missing estimate`)
              break
            }

            await this.update(events[i].aggregateId, {
              estimate,
              version: events[i].aggregateVersion
            })
            break
          }
          case 'WorkStatusChanged': {
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
          case 'WorkAssignedToWorker': {
            const { workerID } = events[i].body as { workerID: string }
            if (!workerID) {
              this.logger.warn(`event with id: ${events[i].id} is missing workerID`)
              break
            }

            await this.update(events[i].aggregateId, {
              assignedTo: workerID,
              version: events[i].aggregateVersion
            })
            break
          }
          case 'WorkUnassignedFromWorker': {
            await this.update(events[i].aggregateId, {
              assignedTo: undefined,
              version: events[i].aggregateVersion
            })
            break
          }
          case 'WorkAddedToOrder': {
            const { orderID } = events[i].body as { orderID: string }
            if (!orderID) {
              this.logger.warn(`event with id: ${events[i].id} is missing orderID`)
              break
            }

            await this.update(events[i].aggregateId, {
              orderID,
              version: events[i].aggregateVersion
            })
            break
          }
          case 'WorkRemovedFromOrder': {
            await this.update(events[i].aggregateId, {
              orderID: undefined,
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
