const Yup = require('yup');
const AuthError = require('../../../../shared/exceptions/auth/auth_exception');

class AuthValidation {

  async signInValidation(data) {
    try {
      const schema = Yup.object().shape({
        email: Yup.string().email().required('O email é obrigatório'),
        password: Yup.string().required('A senha é obrigatória'),
      });

      await schema.validate(data, { abortEarly: false }).catch((err) => {
        throw new AuthError(err.errors[0]);
      });

    } catch (error) {
      throw error;
    }
  }

}

module.exports = new AuthValidation();
