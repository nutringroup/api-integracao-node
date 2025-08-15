import * as Yup from 'yup';
import AuthError from '../../../../shared/exceptions/auth/auth_exception';

class UserValidation {

  async createUserValidation(data, passwordRequired = true) {
    try {
      const schema = Yup.object().shape({
        name: Yup.string().required('O nome do usuário é obrigatório'),
        email: Yup.string()
          .email('Formato de e-mail inválido')
          .required('O e-mail do usuário é obrigatório'),
        password: passwordRequired
          ? Yup.string()
              .min(6, 'A senha deve ter no mínimo 6 caracteres')
              .required('A senha é obrigatória')
          : Yup.string().notRequired(),
      });

      if (!(await schema.isValid(data))) {
        throw new AuthError('Dados de usuário inválidos');
      }
    } catch (error) {
      throw error;
    }
  }

}

export default new UserValidation();
