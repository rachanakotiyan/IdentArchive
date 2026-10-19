import config from '../config/index.js'

export const requestLogger = (req, res, next) => {
  if (config.isTest) {
    return next()
  }

  const start = Date.now()

  res.on('finish', () => {
    const duration = Date.now() - start
    // Strip query string to ensure sensitive query tokens or parameters are never logged
    const cleanPath = req.originalUrl ? req.originalUrl.split('?')[0] : req.path
    console.log(`[${new Date().toISOString()}] ${req.method} ${cleanPath} ${res.statusCode} - ${duration}ms`)
  })

  next()
}

export default requestLogger
