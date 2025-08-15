class TokenError extends Error {
    constructor(error="Token Expired") {
      super(error);
      this.name = "TokenValidation";
    }
  }

  export default TokenError;