
export default class UserError extends Error {
  constructor(error = "Usuário não encontrado!") {
    super(error);
    this.name = 'UserValidation';
  }
}
