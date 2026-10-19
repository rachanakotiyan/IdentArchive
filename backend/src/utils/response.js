/**
 * Uniform API success response helper.
 *
 * @param {import('express').Response} res - Express response object
 * @param {*} data - Main response payload
 * @param {number} [statusCode=200] - HTTP status code
 * @param {string} [message] - Optional human-readable message
 * @param {object} [meta] - Optional pagination or query metadata
 */
export const sendSuccess = (res, data, statusCode = 200, message = undefined, meta = undefined) => {
  const payload = {
    success: true,
    data,
  }

  if (message !== undefined) {
    payload.message = message
  }

  if (meta !== undefined) {
    payload.meta = meta
  }

  return res.status(statusCode).json(payload)
}

export default sendSuccess
