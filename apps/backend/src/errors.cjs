class HttpError extends Error {
  constructor(status, message, data = {}) {
    super(message);
    this.status = status;
    this.data = data;
  }
}
class BadRequestError extends HttpError {
  constructor(message = "Invalid request", data) {
    super(400, message, data);
  }
}
class UnauthorizedError extends HttpError {
  constructor(message = "Authentication required") {
    super(401, message);
  }
}
class ForbiddenError extends HttpError {
  constructor(message = "Access denied") {
    super(403, message);
  }
}
class NotFoundError extends HttpError {
  constructor(message = "Record not found") {
    super(404, message);
  }
}
module.exports = {
  HttpError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
};
