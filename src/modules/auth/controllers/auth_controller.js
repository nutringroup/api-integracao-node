const AuthError = require("../../../shared/exceptions/auth/auth_exception");
const authService = require("../shared/services/auth_service");
const UserError = require("../../../shared/exceptions/user/user_exception");
const authValidation = require("../shared/validations/auth_validation");
const HelperErrorException = require("../../../shared/exceptions/exception_error");

class AuthController {

  async signIn(req, res) {
    try {
      const signin = req.body;
      await authValidation.signInValidation(signin);
      const user = await authService.signInService(signin);
      return res.json(user);
    } catch (error) {
      if (error instanceof AuthError)
        return res.status(400).json({ error: error.message });
      else if (error instanceof UserError)
        return res.status(400).json({ error: error.message });
      else
        return res.status(400).json({ error: HelperErrorException.errorDefault });
    }
  }

}

module.exports = new AuthController();
