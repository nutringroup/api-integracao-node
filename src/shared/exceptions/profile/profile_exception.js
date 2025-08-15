export default class ProfileError extends Error {
  constructor(error = "Perfil não encontrado!") {
    super(error);
    this.name = 'ProfileValidation';
  }
}
