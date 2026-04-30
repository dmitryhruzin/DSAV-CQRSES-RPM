import type { INestApplication } from '@nestjs/common'
import { ModulesContainer } from '@nestjs/core'
import type { IEvent, IEventHandler } from '@nestjs/cqrs'
import { TelemetryService } from './telemetry.service.js'

const EVENTS_HANDLER_METADATA = '__eventsHandler__'

const TELEMETRY_FLAG = Symbol.for('telemetry.eventHandler.wrapped')

export const installEventHandlerTelemetry = (app: INestApplication, telemetry: TelemetryService): void => {
  const modulesContainer = app.get(ModulesContainer)
  for (const module of modulesContainer.values()) {
    for (const provider of module.providers.values()) {
      const instance = provider.instance as (IEventHandler<IEvent> & Record<symbol | string, unknown>) | undefined
      if (!instance || !instance.constructor) continue
      if (instance[TELEMETRY_FLAG]) continue

      const metadata = Reflect.getMetadata(EVENTS_HANDLER_METADATA, instance.constructor) as
        | Array<{ name?: string }>
        | undefined
      if (!metadata) continue

      const originalHandle = (instance as IEventHandler<IEvent>).handle?.bind(instance)
      if (typeof originalHandle !== 'function') continue

      const handlerName = instance.constructor.name
      const subscribed = metadata.map((e) => e?.name ?? 'Unknown').join(',')

      ;(instance as IEventHandler<IEvent>).handle = async (event: IEvent) =>
        telemetry.time('event.handle', () => originalHandle(event), {
          handler: handlerName,
          subscribed,
          event: (event as { constructor?: { name?: string } })?.constructor?.name
        })
      instance[TELEMETRY_FLAG] = true
    }
  }
}
