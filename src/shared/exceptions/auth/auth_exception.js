class AuthError extends Error {
  constructor(error = "Os dados enviados estão incompletos") {
    super(error);
    this.name = "AuthValidation";
  }
}

module.exports = AuthError;