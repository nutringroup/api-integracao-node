import UserHelper from "../shared/helpers/user_helper";
import User from "../shared/models/user";
import UserProfile from "../shared/models/user_profile";
import ProfileHelper from "../../profile/shared/helpers/profile_helper";
import { UserStatusEnum } from "../shared/enum/user_status_enum";

class UserCreate {

  constructor(signUp, transaction) {
    this.signUp = signUp;
    this.transaction = transaction;
  }

  async createUser() {
    try {
      await this.checkEmailAndProfile();
      const user = await this.insertUser();
      await this.insertUserProfile(user.id);
      await this.insertToken(user);

      return user;
    } catch (error) {
      throw error;
    }
  }

  async checkEmailAndProfile() {
    try {
      await UserHelper.checkExistingEmail(this.signUp.email);
      await ProfileHelper.checkIfProfileExist(this.signUp.profile);
    } catch (error) {
      throw error;
    }
  }

  async insertUser() {
    try {
      return await User.create(
        { 
          name: this.signUp.name, 
          email: this.signUp.email, 
          password: this.signUp.password, 
          status: this.signUp.status, 
          token: '' 
        }, 
        { transaction: this.transaction }
      );
    } catch (error) {
      throw error;
    }
  }

  async insertUserProfile(idUser) {
    try {
      await UserProfile.create(
        { idProfile: this.signUp.profile, idUser: idUser },
        { transaction: this.transaction }
      );
    } catch (error) {
      throw error;
    }
  }

  async insertToken(user) {
    try {
      if (this.signUp.status === UserStatusEnum.active) {
        user.setToken(this.signUp.profile);
        await user.update(
          { token: user.token }, 
          { where: { id: user.id }, transaction: this.transaction }
        );
      }
    } catch (error) {
      throw error;
    }
  }

}

export default UserCreate;
