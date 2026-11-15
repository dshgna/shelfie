import { createMemorySettingsRepository } from '../memory-settings-repository'
import {
  contractHousehold,
  contractUser,
  describeSettingsRepositoryContract,
} from './helpers/settingsRepositoryContract'

describeSettingsRepositoryContract('memory', () => {
  // The memory version keeps these two objects as its store, so the test can read and break them.
  const user = contractUser()
  const household = contractHousehold()
  return {
    repo: createMemorySettingsRepository({ user, household }),
    peekUser: async () => structuredClone(user),
    peekHousehold: async () => structuredClone(household),
    writeRawUserPrefs: async (value) => {
      Object.assign(user, { userPrefs: value })
    },
    writeRawHouseholdPrefs: async (value) => {
      Object.assign(household, { householdPrefs: value })
    },
    cleanup: () => {},
  }
})
