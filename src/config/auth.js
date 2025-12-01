const auth = {
    cod: process.env.CODIGO_TOKEN,
    expiresIn: "365d",
    expiresInEmail: "1h",
    expiresInTokenDocument: "3d",
    expiresInSession: "15m",
    expiresInTokenRecoveryPassword: "1h",
  };
  
 module.exports = auth;

