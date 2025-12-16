import knex from 'knex'
import { Injectable } from '@nestjs/common'
import { InjectConnection } from 'nest-knexjs'
import { InjectLogger, Logger } from '@DSAV-CQRSES-RPM/logger'
import { WorkerMain, WorkerMainDBUpdatePayload, WorkerMainDBRecord } from '../../types/worker.js'
import { Paginated, VersionMismatchError } from '../../types/common.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { BaseProjection } from '../../infra/base.projection.js'

const mapPayloadToDbFormat = (payload: WorkerMainDBUpdatePayload): WorkerMainDBRecord => ({
  id: payload.id,
  hourly_rate: payload.hourlyRate,
  role: payload.role,
  deleted_at: payload.deletedAt,
  version: payload.version
})

const mapPayloadFromDbFormat = (dbRecord: any): WorkerMain => ({
  id: dbRecord.id,
  hourlyRate: dbRecord.hourly_rate,
  role: dbRecord.role
})

@Injectable()
export class WorkerMainProjection extends BaseProjection {
  constructor(
    private readonly eventStore: EventStoreRepository,
    @InjectConnection() readonly knexConnection: knex.Knex,
    @InjectLogger(WorkerMainProjection.name) readonly logger: Logger
  ) {
    super(knexConnection, logger, 'workers')
  }

  async onModuleInit() {
    if (!(await this.knexConnection.schema.hasTable(this.tableName))) {
      await this.knexConnection.schema.createTable(this.tableName, (table) => {
        table.string('id').primary()
        table.string('hourly_rate')
        table.string('role')
        table.timestamp('deleted_at')
        table.integer('version')
      })
      await this.knexConnection.schema.createTable(this.snapshotTableName, (table) => {
        table.string('id').primary()
        table.string('hourly_rate')
        table.string('role')
        table.timestamp('deleted_at')
        table.integer('version')
        table.integer('last_event_id')
      })
    }
  }

  async save(record: WorkerMainDBUpdatePayload): Promise<boolean> {
    await this.knexConnection.table(this.tableName).insert([mapPayloadToDbFormat(record)])

    return true
  }

  async update(id: string, payload: WorkerMainDBUpdatePayload, tryCounter = 0): Promise<boolean> {
    const trx = await this.knexConnection.transaction()
    try {
      const record = await this.knexConnection.table(this.tableName).transacting(trx).forUpdate().where({ id }).first()
      if (!record || record.version + 1 !== payload.version) {
        throw new VersionMismatchError(
          `Version mismatch for Worker with id: ${id}, current version: ${record?.version}, new version: ${payload.version}`
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

  async getAll(page: number, pageSize: number): Promise<Paginated<WorkerMain>> {
    const records = await this.knexConnection
      .table(this.tableName)
      .select('id', 'hourly_rate', 'role')
      .whereNull('deleted_at')
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total = await this.knexConnection.table(this.tableName).count<{ count: number }[]>('* as count').first()
    return { items: records.map(mapPayloadFromDbFormat), page, pageSize, total: total?.count || 0 }
  }

  async getById(id: string): Promise<WorkerMain> {
    const record = await this.knexConnection
      .table(this.tableName)
      .select('id', 'hourly_rate', 'role')
      .where({ id })
      .whereNull('deleted_at')
      .first()

    if (!record) {
      throw new Error(`Worker with id: ${id} not found`)
    }

    return mapPayloadFromDbFormat(record)
  }

  async rebuild() {
    const eventNames = ['WorkerHiredV1', 'WorkerRoleChangedV1', 'WorkerHourlyRateChangedV1', 'WorkerDismissedV1']

    let lastEventID = await this.applySnapshot()
    let events = await this.eventStore.getEventsByName(eventNames, lastEventID)
    while (events.length > 0) {
      for (let i = 0; i < events.length; i += 1) {
        switch (events[i].name) {
          case 'WorkerHiredV1': {
            const { id, hourlyRate, role } = events[i].body as {
              id: string
              hourlyRate: string
              role: string
              mileage: number
            }
            if (!id || !hourlyRate || !role) {
              this.logger.warn(`event with id: ${events[i].id} is missing id, hourlyRate, or role`)
              break
            }

            await this.save({ id, hourlyRate, role, version: 1 })
            break
          }
          case 'WorkerRoleChangedV1': {
            const { role } = events[i].body as { role: string }
            if (!role) {
              this.logger.warn(`event with id: ${events[i].id} is missing role`)
              break
            }

            await this.update(events[i].aggregateId, {
              role,
              version: events[i].aggregateVersion
            })
            break
          }
          case 'WorkerHourlyRateChangedV1': {
            const { hourlyRate } = events[i].body as { hourlyRate: string }
            if (!hourlyRate) {
              this.logger.warn(`event with id: ${events[i].id} is missing hourlyRate`)
              break
            }

            await this.update(events[i].aggregateId, {
              hourlyRate,
              version: events[i].aggregateVersion
            })
            break
          }
          case 'WorkerDismissedV1': {
            const { deletedAt } = events[i].body as { deletedAt: Date }
            if (!deletedAt) {
              this.logger.warn(`event with id: ${events[i].id} is missing deletedAt`)
              break
            }

            await this.update(events[i].aggregateId, {
              deletedAt,
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
