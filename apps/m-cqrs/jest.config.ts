import { nodeConfig } from '@DSAV-CQRSES-RPM/jest-config'
import type { Config } from 'jest'

export default async (): Promise<Config> => ({
  ...nodeConfig
})
