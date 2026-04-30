import { AcknowledgementResponse } from '../types/common.js'

export const ACKNOWLEDGEMENT_OK = 'Acknowledgement OK'

export const ackOk = (aggregateId: string, aggregateType: string): AcknowledgementResponse => ({
  message: ACKNOWLEDGEMENT_OK,
  aggregateId,
  aggregateType
})

export const PAGE_DEFAULT = 1
export const PAGE_SIZE_DEFAULT = 10
export const PAGE_SIZE_MAX = 100
