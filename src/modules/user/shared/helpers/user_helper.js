const AuthError = require("../../../../shared/exceptions/auth/auth_exception");
const User = require("../models/user");
const ProfileError = require("../../../../shared/exceptions/profile/profile_exception");
const HelperErrorException = require("../../../../shared/exceptions/exception_error");
const UserStatusEnum = require("../enum/user_status_enum");
const UserProfile = require("../models/user_profile");
const UserError = require("../../../../shared/exceptions/user/user_exception");

class UserHelper {

  static async checkExistingEmail(email) {
    try {
      const emailExist = await User.findOne({
        where: { email: email.toLowerCase().trim() },
      });
      if (emailExist) throw new AuthError(HelperErrorException.emailExist);
    } catch (error) {
      throw error;
    }
  }  

  static async checkEmailAndPasswordIsCorrectAndReturnUser(account) {
    try {
      const user = await User.findOne({
        where: { email: account.email.toLowerCase().trim() },
      });
      if (!user) throw new AuthError(HelperErrorException.invalidAccount);
      if (!(await user.passwordVerify(account.password)))
        throw new AuthError(HelperErrorException.invalidAccount);
      return user;
    } catch (error) {
      throw error;
    }
  }

  static async getUserProfileByIdUserWithTransaction(idUser, transaction) {
    try {
      const userProfile = await UserProfile.findOne({
        where: { id_user: idUser }, 
        attributes: ["id", "id_profile"], 
        transaction,
      });
      if (!userProfile) throw new UserError();
      return userProfile;
    } catch (error) {
      throw error;
    }
  }

  static async getAllUsers() {
    try {
      const users = await User.findAll({ attributes: ["id", "name", "email", "status"] });            
      return users.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        status: user.status,
        statusName: this.getStatusName(user.status)
      }));
    } catch (error) {
      throw error;
    }
  }

  static async getUserById(id) {
    try {
      const user = await User.findOne({ where: { id: id } });
      if (!user) throw new ProfileError();
      return user;
    } catch (error) {
      throw error;
    }
  }

  static async getUserByEmail(email) {
    try {
      const user = await User.findOne({
        where: { email: email.toLowerCase().trim() },
      });
      if (!user) throw new ProfileError();
      return user;
    } catch (error) {
      throw error;
    }
  }

  static async checkUserIsActive(user) {
    try {
      if (user.status != 1) throw new ProfileError();
    } catch (error) {
      throw error;
    }
  }

  static getStatusName(status) {
    switch (status) {
      case UserStatusEnum.inactive:
        return "inativo";
      case UserStatusEnum.active:
        return "ativo";
      default:
        return "desconhecido";
    }
  }
}

module.exports = UserHelper;
