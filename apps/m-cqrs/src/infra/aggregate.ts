import { AggregateRoot } from '@nestjs/cqrs'

export class Aggregate extends AggregateRoot {
  id: string

  version: number = 0

  constructor(id: string = '', version: number = 0) {
    super()

    if (id) this.id = id
    if (version) this.version = version
  }

  toJson(): object {
    return {}
  }
}
