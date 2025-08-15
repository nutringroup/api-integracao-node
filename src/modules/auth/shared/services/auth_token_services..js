import jwt from 'jsonwebtoken';

import AuthConfig from '../../../../config/auth';
import TokenError from '../../../../shared/exceptions/auth/token_jwt_exception';
import CreateTokenEnum from '../enum/create_token_enum';

class AuthTokenService {
  
  createTokenJWT(idUser, typeOperation, idProfile) {
    if (typeOperation === CreateTokenEnum.userCreate) {
      return jwt.sign({ id: idUser, registerPassword: true }, AuthConfig.cod, { expiresIn: AuthConfig.expiresIn });
    } else if (typeOperation === CreateTokenEnum.tokenLogin) {
      return jwt.sign({ id: idUser, profile: idProfile, time: new Date() }, AuthConfig.cod, { expiresIn: AuthConfig.expiresIn });
    } else if (typeOperation === CreateTokenEnum.tokenSession) {
      return jwt.sign({ id: idUser, time: new Date() },AuthConfig.cod, { expiresIn: AuthConfig.expiresInSession });
    } else {
      return jwt.sign({ id: idUser, time: new Date() }, AuthConfig.cod,{ expiresIn: AuthConfig.expiresInTokenRecoveryPassword });
    }
  }

  validateToken(token) {
    try {
      let decodedToken;
      jwt.verify(token, AuthConfig.cod, (err, decoded) => {
        if (err || !decoded) {
          throw new TokenError();
        } else {
          decodedToken = decoded;
        }
      });
      return decodedToken;
    } catch (error) {
      throw error;
    }
  }

  decodeToken(token) {
    try {
      if (!token) throw new TokenError();
      let decodedToken = jwt.decode(token);
      return decodedToken;
    } catch (error) {
      throw error;
    }
  }
}

export default new AuthTokenService();
