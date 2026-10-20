import app from './app.js'
import config from './config/index.js'
import { checkDatabaseConnection } from './config/database.js'

app.listen(config.port, async () => {
  console.log(`IdentArchive API server listening on port ${config.port} (${config.nodeEnv})`)
  await checkDatabaseConnection()
})
