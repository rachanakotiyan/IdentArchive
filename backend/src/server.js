import app from './app.js'
import config from './config/index.js'

app.listen(config.port, () => {
  console.log(`IdentArchive API server listening on port ${config.port} (${config.nodeEnv})`)
})
