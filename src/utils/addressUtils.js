const axios = require('axios');
const fs = require('fs');
const path = require('path');
const Abbreviation = require('../modules/abbreviation/shared/models/abbreviation');

/**
 * Utilitários para validação e formatação de endereços
 * Seguindo o padrão do Laravel OmieController.php
 */

class AddressUtils {
  constructor() {
     this.abbreviations = {};
  }

  /**
   * Carrega abreviações do arquivo CSV
   * @returns {object}
   */
  async loadAbbreviations() {
    try {
      const registros = await Abbreviation.findAll();
      const abbreviations = {};

      registros.forEach(r => {
        abbreviations[r.word.toUpperCase()] = r.abbreviation;
      });

      this.abbreviations = abbreviations;
      
      return abbreviations;
    } catch (error) {
      console.warn('Erro ao carregar abreviações:', error.message);
      return {};
    }
  }

  /**
   * Verifica e corrige endereço usando APIs de CEP
   * Segue exatamente o padrão do Laravel checkStreet()
   * @param {string} cep 
   * @param {string} logradouro 
   * @param {string} shopifyId - Para logging no banco
   * @returns {Promise<string>}
   */
  async checkStreet(cep, logradouro, shopifyId = null) {
    try {
      // Remove caracteres não numéricos do CEP
      const cleanCep = cep.replace(/[^0-9]/g, '');

      // Verifica se é um CEP geral (terminado em 000)
      if (cleanCep.slice(-3) === '000') {
        return this.substituirAbreviacoes(logradouro);
      }

      let streetData = null;

      // Tenta primeiro a Brasil API
      try {
        const brasilApiUrl = `https://brasilapi.com.br/api/cep/v1/${cleanCep}`;
        const brasilResponse = await axios.get(brasilApiUrl, { timeout: 5000 });
        
        if (brasilResponse.data && brasilResponse.data.street) {
          streetData = {
            street: brasilResponse.data.street
          };
        }
      } catch (brasilError) {
        console.debug('Brasil API falhou, tentando ViaCEP', { cep: cleanCep });
      }

      // Se Brasil API falhar, tenta ViaCEP
      if (!streetData) {
        try {
          const viacepUrl = `https://viacep.com.br/ws/${cleanCep}/json/`;
          const viacepResponse = await axios.get(viacepUrl, { timeout: 5000 });
          
          if (viacepResponse.data && !viacepResponse.data.erro && viacepResponse.data.logradouro) {
            streetData = {
              street: viacepResponse.data.logradouro
            };
          }
        } catch (viacepError) {
          console.debug('ViaCEP também falhou', { cep: cleanCep });
        }
      }

      // Verifica se encontrou dados da API
      if (streetData && streetData.street) {
        const apiLogradouro = streetData.street.toLowerCase();
        const inputLogradouro = logradouro.toLowerCase();

        // Remove acentos para comparação
        const apiSemAcentos = this.removeAccents(apiLogradouro);
        const inputSemAcentos = this.removeAccents(inputLogradouro);

        // Verifica se o logradouro de entrada está contido no da API
        if (inputSemAcentos.includes(apiSemAcentos)) {
          await this.logAddressValidation(shopifyId, 80, 'Endereço validado com sucesso', {
            cep: cleanCep,
            input_logradouro: logradouro,
            api_logradouro: streetData.street,
            validation_method: 'contains'
          });
          return this.substituirAbreviacoes(streetData.street);
        }

        // Verifica similaridade (equivalente ao similar_text do PHP)
        const similarity = this.calculateSimilarity(inputSemAcentos, apiSemAcentos);
        if (similarity > 80) {
          await this.logAddressValidation(shopifyId, 80, 'Endereço validado com sucesso', {
            cep: cleanCep,
            input_logradouro: logradouro,
            api_logradouro: streetData.street,
            validation_method: 'similarity',
            similarity_percent: similarity
          });
          return this.substituirAbreviacoes(streetData.street);
        }

        // Verifica distância de Levenshtein
        const distance = this.levenshteinDistance(inputSemAcentos, apiSemAcentos);
        if (distance <= 3) {
          await this.logAddressValidation(shopifyId, 80, 'Endereço validado com sucesso', {
            cep: cleanCep,
            input_logradouro: logradouro,
            api_logradouro: streetData.street,
            validation_method: 'levenshtein',
            distance: distance
          });
          return this.substituirAbreviacoes(streetData.street);
        }

        // Endereço não correspondeu aos critérios
        await this.logAddressValidation(shopifyId, 81, 'Endereço não correspondeu aos critérios de validação', {
          cep: cleanCep,
          input_logradouro: logradouro,
          api_logradouro: streetData.street,
          similarity_percent: similarity,
          levenshtein_distance: distance
        });
      } else {
        // Endereço não encontrado na API
        await this.logAddressValidation(shopifyId, 81, 'Endereço não encontrado/inválido', {
          cep: cleanCep,
          input_logradouro: logradouro,
          api_response: 'No street data found'
        });
      }

      // Mantém o logradouro original com abreviações
      return this.substituirAbreviacoes(logradouro);

    } catch (error) {
      await this.logAddressValidation(shopifyId, 82, 'Erro na validação de endereço', {
        cep,
        input_logradouro: logradouro,
        error: error.message
      });
      console.error('Erro ao verificar endereço:', error.message);
      return this.substituirAbreviacoes(logradouro);
    }
  }

  /**
   * Substitui palavras por abreviações
   * @param {string} logradouro 
   * @returns {string}
   */
  substituirAbreviacoes(logradouro) {
    if (!logradouro) return '';

    const palavras = logradouro.split(' ');

    const palavrasAbreviadas = palavras.map(palavra => {
      const palavraUpper = palavra.toUpperCase();
      return this.abbreviations[palavraUpper] || palavra;
    });

    return palavrasAbreviadas.join(' ');
  }

  /**
   * Remove acentos de uma string
   * @param {string} string 
   * @returns {string}
   */
  removeAccents(string) {
    if (!string) return '';
    
    return string
      .replace(/[áàãâä]/g, 'a')
      .replace(/[éèêë]/g, 'e')
      .replace(/[íìîï]/g, 'i')
      .replace(/[óòõôö]/g, 'o')
      .replace(/[úùûü]/g, 'u')
      .replace(/[ñ]/g, 'n')
      .replace(/[ç]/g, 'c');
  }

  /**
   * Calcula similaridade entre duas strings (equivalente ao similar_text do PHP)
   * @param {string} str1 
   * @param {string} str2 
   * @returns {number}
   */
  calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;

    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 100;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return ((longer.length - editDistance) / longer.length) * 100;
  }

  /**
   * Calcula distância de Levenshtein entre duas strings
   * @param {string} str1 
   * @param {string} str2 
   * @returns {number}
   */
  levenshteinDistance(str1, str2) {
    if (!str1) return str2 ? str2.length : 0;
    if (!str2) return str1.length;

    const matrix = [];

    // Inicializa primeira linha e coluna
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    // Preenche a matriz
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substituição
            matrix[i][j - 1] + 1,     // inserção
            matrix[i - 1][j] + 1      // remoção
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Extrai número do endereço
   * @param {string} address1 
   * @returns {string}
   */
  extractNumber(address1) {
    if (!address1) return '';
    
    const parts = address1.split(',');
    return parts.length > 1 ? parts[1].trim() : '';
  }

  /**
   * Extrai rua do endereço
   * @param {string} address1 
   * @returns {string}
   */
  extractStreet(address1) {
    if (!address1) return '';
    
    const parts = address1.split(',');
    return parts[0].trim();
  }

  /**
   * Registra log de validação de endereço no banco
   * @param {string} shopifyId 
   * @param {number} step 
   * @param {string} status 
   * @param {object} details 
   */
  async logAddressValidation(shopifyId, step, status, details) {
    if (!shopifyId) return; // Não loga se não tiver shopifyId
    
    try {
      const { HistoryLog } = require('../models');
      await HistoryLog.create({
        step,
        shopify_id: shopifyId,
        log: { status, ...details },
      });
    } catch (error) {
      console.error('Erro ao registrar log de endereço:', error.message);
    }
  }

  /**
   * Busca cidade pelo CEP seguindo padrão do Laravel
   * @param {string} zipcode 
   * @param {string} shopifyId - Para logging no banco
   * @returns {Promise<string>}
   */
  async getCity(zipcode, shopifyId = null) {
    try {
      const cleanCep = zipcode.replace(/[^0-9]/g, '');
      
      if (!cleanCep || cleanCep.length !== 8) {
        return "Localidade não encontrada para o CEP informado.";
      }

      // Tenta primeiro ViaCEP
      try {
        const viacepUrl = `https://viacep.com.br/ws/${cleanCep}/json/`;
        const viacepResponse = await axios.get(viacepUrl, { timeout: 10000 });
        
        if (viacepResponse.data && !viacepResponse.data.erro && viacepResponse.data.ibge) {
          const ibgeCode = viacepResponse.data.ibge;
          const cityName = await this.getCityByIBGE(ibgeCode);
          
          await this.logAddressValidation(shopifyId, 83, 'Cidade encontrada por CEP', {
            cep: cleanCep,
            ibge_code: ibgeCode,
            city_name: cityName,
            api_used: 'ViaCEP'
          });
          
          return cityName;
        }
      } catch (viacepError) {
        console.debug('ViaCEP falhou, tentando Brasil Aberto', { cep: cleanCep });
      }

      // Se ViaCEP falhar, tenta Brasil Aberto
      try {
        const brasilAbertoUrl = `https://api.brasilaberto.com/v1/zipcode/${cleanCep}`;
        const brasilAbertoResponse = await axios.get(brasilAbertoUrl, { timeout: 10000 });
        
        if (brasilAbertoResponse.data && brasilAbertoResponse.data.result?.ibgeId) {
          const ibgeCode = brasilAbertoResponse.data.result.ibgeId;
          const cityName = await this.getCityByIBGE(ibgeCode);
          
          await this.logAddressValidation(shopifyId, 83, 'Cidade encontrada por CEP', {
            cep: cleanCep,
            ibge_code: ibgeCode,
            city_name: cityName,
            api_used: 'Brasil Aberto'
          });
          
          return cityName;
        }
      } catch (brasilAbertoError) {
        console.debug('Brasil Aberto também falhou', { cep: cleanCep });
      }

      await this.logAddressValidation(shopifyId, 84, 'Cidade não encontrada por CEP', {
        cep: cleanCep,
        error: 'Nenhuma API retornou dados válidos'
      });
      
      return "Localidade não encontrada para o CEP informado.";

    } catch (error) {
      await this.logAddressValidation(shopifyId, 84, 'Cidade não encontrada por CEP', {
        cep: zipcode,
        error: error.message
      });
      
      console.error('Erro ao buscar cidade:', error.message);
      return "Localidade não encontrada para o CEP informado.";
    }
  }

  /**
   * Busca cidade pelo código IBGE
   * @param {string} ibgeId 
   * @returns {Promise<string>}
   */
  async getCityByIBGE(ibgeId) {
    try {
      const url = `https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${ibgeId}`;
      const response = await axios.get(url, { timeout: 10000 });
      
      if (response.data && response.data.nome) {
        return response.data.nome;
      }
      
      return "Cidade não encontrada para o código IBGE informado.";
    } catch (error) {
      console.error('Erro ao buscar cidade pelo IBGE:', error.message);
      return "Cidade não encontrada para o código IBGE informado.";
    }
  }

  /**
   * Normaliza nome da cidade removendo códigos de estado e outros sufixos
   * @param {string} cityName 
   * @returns {string}
   */
  normalizeCityName(cityName) {
    if (!cityName) return '';
    
    // Remove códigos de estado em parênteses: "ARAUCARIA (PR)" -> "ARAUCARIA"
    let normalized = cityName.replace(/\s*\([^)]+\)\s*/g, '').trim();
    
    // Remove códigos de estado após espaço: "ARAUCARIA PR" -> "ARAUCARIA"
    // Lista de códigos de estado brasileiros
    const stateCodes = [
      'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 
      'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 
      'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
    ];
    
    // Remove códigos de estado no final: "ARAUCARIA PR" -> "ARAUCARIA"
    const words = normalized.split(' ');
    if (words.length > 1) {
      const lastWord = words[words.length - 1].toUpperCase();
      if (stateCodes.includes(lastWord)) {
        words.pop();
        normalized = words.join(' ').trim();
      }
    }
    
    return normalized;
  }

  /**
   * Busca cidade pelo CEP com fallback
   * @param {string} zipcode 
   * @param {string} cityInput 
   * @param {string} shopifyId - Para logging no banco
   * @returns {Promise<string>}
   */
  async getCityByZipcode(zipcode, cityInput, shopifyId = null) {
    const cityResult = await this.getCity(zipcode, shopifyId);
    
    if (cityResult === "Localidade não encontrada para o CEP informado.") {
      // Se as APIs falharam, normaliza a cidade de entrada removendo códigos de estado
      const normalizedCity = this.normalizeCityName(cityInput);
      
      await this.logAddressValidation(shopifyId, 85, 'Cidade normalizada por fallback', {
        original_city: cityInput,
        normalized_city: normalizedCity,
        reason: 'APIs de CEP indisponíveis'
      });
      
      return normalizedCity;
    }
    
    return cityResult;
  }
}

module.exports = new AddressUtils(); 