import { CommandBus, EventBus, QueryBus, ICommand, IQuery, IEvent } from '@nestjs/cqrs'
import { TelemetryService } from './telemetry.service.js'

const nameOf = (obj: unknown): string => (obj as { constructor?: { name?: string } })?.constructor?.name ?? 'Unknown'

export const installCqrsTelemetry = (
  commandBus: CommandBus,
  queryBus: QueryBus,
  eventBus: EventBus,
  telemetry: TelemetryService
): void => {
  const originalCommandExecute = commandBus.execute.bind(commandBus)
  commandBus.execute = function execute<TCommand extends ICommand, TResult = unknown>(
    command: TCommand
  ): Promise<TResult> {
    return telemetry.time('command.execute', () => originalCommandExecute(command) as Promise<TResult>, {
      name: nameOf(command)
    })
  } as typeof commandBus.execute

  const originalQueryExecute = queryBus.execute.bind(queryBus)
  queryBus.execute = function execute<TQuery extends IQuery, TResult = unknown>(query: TQuery): Promise<TResult> {
    return telemetry.time('query.execute', () => originalQueryExecute(query) as Promise<TResult>, {
      name: nameOf(query)
    })
  } as typeof queryBus.execute

  const originalPublish = eventBus.publish.bind(eventBus)
  eventBus.publish = function publish<TEvent extends IEvent>(event: TEvent, ...rest: unknown[]) {
    const start = telemetry.now()
    const startedAt = Date.now()
    const name = nameOf(event)
    try {
      const result = (originalPublish as (...args: unknown[]) => unknown)(event, ...rest)
      telemetry.mark('event.publish', telemetry.toMs(start), { name, startedAt, success: true })
      return result
    } catch (e) {
      telemetry.mark('event.publish', telemetry.toMs(start), {
        name,
        startedAt,
        success: false,
        error: (e as Error).message
      })
      throw e
    }
  } as typeof eventBus.publish

  const originalPublishAll = eventBus.publishAll.bind(eventBus)
  eventBus.publishAll = function publishAll<TEvent extends IEvent>(events: TEvent[], ...rest: unknown[]) {
    const start = telemetry.now()
    const startedAt = Date.now()
    const names = events.map(nameOf)
    try {
      const result = (originalPublishAll as (...args: unknown[]) => unknown)(events, ...rest)
      telemetry.mark('event.publishAll', telemetry.toMs(start), {
        count: events.length,
        names,
        startedAt,
        success: true
      })
      return result
    } catch (e) {
      telemetry.mark('event.publishAll', telemetry.toMs(start), {
        count: events.length,
        names,
        startedAt,
        success: false,
        error: (e as Error).message
      })
      throw e
    }
  } as typeof eventBus.publishAll
}
