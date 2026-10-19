export const getHealthStatus = () => {
  return {
    status: 'ok',
    message: 'IdentArchive API is running',
  }
}

export default {
  getHealthStatus,
}
