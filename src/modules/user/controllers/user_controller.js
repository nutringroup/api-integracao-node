const SequelizeConnect = require("../../../config/sequelize_request");
const HelperErrorException = require("../../../shared/exceptions/exception_error");
const ProfileError = require("../../../shared/exceptions/profile/profile_exception");
const UserError = require("../../../shared/exceptions/user/user_exception");
const userService = require("../shared/services/user_service");
const userValidation = require("../shared/validations/user_validation");
const sequelize = SequelizeConnect.getInstance().getSequelize();

class UserController {

  async createUser(req, res) {
    const transaction = await sequelize.transaction();
    try {
      await userValidation.createUserValidation(req.body);
      const user = await userService.createUser(req.body, transaction);
      await transaction.commit();
      return res.json(user);
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
       console.error('Stack:', error.stack); 
      await transaction.rollback();
      if (error instanceof UserError)
        return res.status(400).json({ error: error.message });
      else
        return res.status(400).json({ error: HelperErrorException.errorDefault });
    }
  }

  async updateUser(req, res) {
    const transaction = await sequelize.transaction();
    try {
      const userId = parseInt(req.params.id);

      await userValidation.createUserValidation(req.body);
      await userService.updateUser(userId, req.body, transaction);

      await transaction.commit();
      return res.json({ message: "Usuário atualizado com sucesso" });
    } catch (error) {
      await transaction.rollback();
      if (error instanceof UserError)
        return res.status(404).json({ error: HelperErrorException.userNotFound });
      else
        return res.status(400).json({ error: HelperErrorException.errorDefault });
    }
  }

  async deleteUser(req, res) {
    const transaction = await sequelize.transaction();
    try {
      const result = await userService.deleteUser(req.body.id, transaction);
      await transaction.commit();
      return res.json(result);
    } catch (error) {
      await transaction.rollback();
      if (error instanceof UserError)
        return res.status(400).json({ error: error.message });
      else
        return res.status(400).json({ error: HelperErrorException.errorDefault });
    }
  }

  async getAllUsers(req, res) {
    try {
      const users = await userService.getAllUsers();
      return res.json(users);
    } catch (error) {
      return res.status(400).json({ error: HelperErrorException.errorDefault });
    }
  }

  async getUserById(req, res) {
    try {
      const userId = parseInt(req.params.id);

      const user = await userService.getUserById(userId);
      return res.json(user);
    } catch (error) {
      if (error instanceof ProfileError)
        return res.status(404).json({ error: HelperErrorException.userNotFound });
      else
        return res.status(400).json({ error: HelperErrorException.errorDefault });
    }
  }
}

module.exports = new UserController();
