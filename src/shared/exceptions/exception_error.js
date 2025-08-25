class HelperErrorException {}

HelperErrorException.errorDefault = 'Algo ocorreu, não foi possível realizar a ação!';
HelperErrorException.errorZipcode = 'Não foi possível encontrar o cep!';
HelperErrorException.accountExist = 'Não foi possível criar a conta, dados já cadastrados!';
HelperErrorException.tokenInvalid = 'Token Inválido!';
HelperErrorException.userUnauthorized = 'Usuário não está autenticado ou não tem permissão';
HelperErrorException.permissionDenied = 'Sem Permissão para a ação!';
HelperErrorException.statusInvalid = 'Não é possível realizar a operação. O status atual da prospecção não permite essa alteração!';
HelperErrorException.emailExist = 'O email informado já está reservado por outro usuário!';
HelperErrorException.crmExist = 'O CRM informado já está reservado por outro usuário!';
HelperErrorException.documentExistError = 'CPF informado já está reservado por outro usuário!';
HelperErrorException.documentError = 'CPF informado é inválido';
HelperErrorException.documentCompanyError = 'CNPJ informado é inválido';
HelperErrorException.invalidAccount = 'Dados inválidos. Seu email e/ou senha está incorreto!';
HelperErrorException.userProfileExist = 'O usuário já possui cadastrado para esse perfil!';
HelperErrorException.profileNotFound = 'Perfil não encontrado!';    
HelperErrorException.userNotFound = 'Usuário não encontrado!';
HelperErrorException.orderNotFound = 'Pedido não encontrado!';
HelperErrorException.invalidJson = 'JSON do pedido inválido';
HelperErrorException.logNotFound = 'Nenhum Log encontrado!';
HelperErrorException.requiredFields = 'step e shopify_id são obrigatórios';
HelperErrorException.oldLogsCleanFail = 'Erro ao limpar logs antigos!';

export default HelperErrorException;
