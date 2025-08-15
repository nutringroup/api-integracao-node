const HelperErrorException = require("../../../../shared/exceptions/exception_error");
const ProfileError = require("../../../../shared/exceptions/profile/profile_exception");
const Profile = require("../models/profile");

class ProfileHelper {

  static async checkIfProfileExist(idProfile) {
    const profile = await Profile.findOne({ where: { id: idProfile } });
    if (!profile) throw new ProfileError(HelperErrorException.profileNotFound);
  }

}

module.exports = ProfileHelper;
