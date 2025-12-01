class TokenError extends Error {
  constructor(error = "Token Expired") {
    super(error);
    this.name = "TokenValidation";
  }
}

module.exports = TokenError;