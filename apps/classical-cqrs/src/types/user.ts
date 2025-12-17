import { AggregateMetadata, BaseEventPayload } from './common.js'

export type UserProperties = {
  password?: string
  isInSystem?: boolean
}

export type AggregateUserData = AggregateMetadata & UserProperties

export type AggregateUserCreateData = Omit<AggregateUserData, 'version'>
export type AggregateUserUpdateData = Omit<AggregateUserData, 'id'>

// Projection Types

export type UserMain = {
  id: string
  password: string
  isInSystem: boolean
}

export type UserMainDBRecord = {
  id?: string
  password?: string
  is_in_system?: boolean
  version: number
}

export type UserMainDBUpdatePayload = {
  id?: string
  password?: string
  isInSystem?: boolean
  version: number
}

// Requests

export type CreateUserRequest = {
  password: string
}

export type ChangeUserPasswordRequest = {
  id: string
  newPassword: string
}

export type UserEnterSystemRequest = {
  id: string
}

export type UserExitSystemRequest = {
  id: string
}

// Commands

export type CreateUserCommandPayload = {
  password: string
}

export type ChangeUserPasswordCommandPayload = {
  id: string
  newPassword: string
}

export type UserEnterSystemCommandPayload = {
  id: string
}

export type UserExitSystemCommandPayload = {
  id: string
}

// Events

export type UserCreatedV1EventPayload = BaseEventPayload & {
  id: string
  password: string
}

export type UserPasswordChangedV1EventPayload = BaseEventPayload & {
  previousPassword: string
  password: string
}

export type UserEnteredSystemV1EventPayload = BaseEventPayload

export type UserExitedSystemV1EventPayload = BaseEventPayload
