const bcrypt = require('bcryptjs');
const User = require("../models/user");
const UserHelper = require("../helpers/user_helper");
const UserStatusEnum = require('../enum/user_status_enum');
const CreateTokenEnum = require('../../../auth/shared/enum/create_token_enum');
const ProfileEnum = require('../../../profile/shared/enum/profile_enum');
const authTokenServices = require('../../../auth/shared/services/auth_token_service');
const UserCreate = require('../../implementations/user_create');
const UserError = require('../../../../shared/exceptions/user/user_exception');
const HelperErrorException = require('../../../../shared/exceptions/exception_error');


class UserService {

  async createUser(data, transaction) {
    try {
      data.status = UserStatusEnum.active;
      data.profile = ProfileEnum.user;
      data.password = await bcrypt.hash(data.password, 8);

      const userCreate = new UserCreate(data, transaction);
      const user = await userCreate.createUser();
      if (!user || !user.id) throw new Error("Usuário não foi criado corretamente");


      const userProfile = await UserHelper.getUserProfileByIdUserWithTransaction(user.id, transaction);
      const token = authTokenServices.createTokenJWT(user.id, CreateTokenEnum.tokenLogin, userProfile.idProfile);

      return {
        name: user.name,
        email: user.email,
        token: token,
        profile: userProfile.idProfile,
      };
    } catch (error) {
      throw error;
    }
  }

  async updateUser(id, data, transaction) {
    try {
      const user = await User.findByPk(id);
      if (!user) throw new UserError(HelperErrorException.userNotFound);

      const hashedPassword = data.password ? await bcrypt.hash(data.password, 8) : user.password;

      await user.update({
        name: data.name || user.name,
        email: data.email ? data.email.toLowerCase().trim() : user.email,
        status: data.status !== undefined ? data.status : user.status,
        password: hashedPassword, 
      }, { transaction });

      return user;
    } catch (error) {
      throw error;
    }
  }

  async getAllUsers() {
    return await UserHelper.getAllUsers();
  }

  async getUserById(id) {
    return await UserHelper.getUserById(id);
  }

  async deleteUser(id, transaction) {
    try {
      const user = await User.findByPk(id);
      if (!user) throw new UserError(HelperErrorException.userNotFound);

      await user.destroy({ transaction });
      return { message: "Usuário excluído com sucesso" };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new UserService();
