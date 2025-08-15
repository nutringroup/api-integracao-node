const User = require("../../../user/shared/models/user");
const ProfileEnum = require("../../../profile/shared/enum/profile_enum");
const authHelper = require("../helpers/auth_helper");
const { default: authTokenServices } = require("./auth_token_services.");
const CreateTokenEnum = require("../enum/create_token_enum");

class AuthService {

  async signInService(userSignin) {
    try {
      const user = await authHelper.checkEmailAndPassword(userSignin.email, userSignin.password);

      const token = authTokenServices.createTokenJWT(user.id, CreateTokenEnum.tokenLogin, ProfileEnum.user);

      return {
        name: user.name,
        email: user.email,
        token: token,
        profile: ProfileEnum.user,
      };
    } catch (error) {
      throw error;
    }
  }

}

module.exports = new AuthService();
