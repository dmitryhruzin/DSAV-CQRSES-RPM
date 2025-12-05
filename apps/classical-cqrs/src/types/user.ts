import { AggregateMetadata, EventBasePayload } from './common.js'

export type UserProperties = {
  password: string
}

export type AggregateUserData = AggregateMetadata & UserProperties

export type AggregateUserCreateData = Omit<AggregateUserData, 'version'>
export type AggregateUserUpdateData = Omit<AggregateUserData, 'id'>

// Requests

export type CreateUserRequest = {
  password: string
}

export type UserEntersTheSystemRequest = {}

export type UserExitsTheSystemRequest = {}

export type ChangeUserPasswordRequest = {
  newPassword: string
}

// Commands

export type CreateUserCommandPayload = {
  password: string
}

// Events

export type UserCreatedV1EventPayload = EventBasePayload & {
  id: string
  password: string
}
