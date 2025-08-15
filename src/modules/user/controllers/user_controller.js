
import SequelizeConnect from "../../../config/sequelize_request";
import { sequelize } from "../../../models";
import HelperErrorException from "../../../shared/exceptions/exception_error";
import ProfileError from "../../../shared/exceptions/profile/profile_exception";
import UserError from "../../../shared/exceptions/user/user_exception";
import userService from "../shared/services/user_service";
import userValidation from "../shared/validations/user_validation";
const sequelize = SequelizeConnect.sequelizeConnect;

class UserController {

  async createUser(req, res) {
    const transaction = await sequelize.transaction();
    try {
      await userValidation.createUserValidation(req.body);
      const user = await userService.createUser(req.body, transaction);
      await transaction.commit();
      return res.json(user);
    } catch (error) {
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

export default new UserController();
