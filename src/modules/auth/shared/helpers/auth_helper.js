const HelperErrorException = require("../../../../shared/exceptions/exception_error");
const { default: AuthError } = require("../../../../shared/exceptions/auth/auth_exception");
const User = require("../../../user/shared/models/user");

class AuthHelper {

  async checkEmailAndPassword(email, password) {
    try {
      const user = await User.findOne({ where: { email: email.toLowerCase().trim() }});
      if (!user) throw new AuthError(HelperErrorException.invalidAccount);

      if (!(await user.passwordVerify(password))) throw new AuthError(HelperErrorException.invalidAccount);

      return user;
    } catch (error) {
      throw error;
    }
  }

}

module.exports = new AuthHelper();
