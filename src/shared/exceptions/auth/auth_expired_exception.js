class AuthExpiredError extends Error {
  constructor(error = "Sessão expirada!") {
    super(error);
    this.name = "AuthExpiredValidation";
  }
}

module.exports = AuthExpiredError;