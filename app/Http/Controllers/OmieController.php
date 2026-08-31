<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Http;
use Illuminate\Http\Request;
use App\Http\Controllers\ShopifyController;
use App\Jobs\SendMessage;
use App\Models\Clients;
use App\Models\Historylog;
use App\Models\Orders;
use App\Models\Products;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;

use Exception;

class OmieController extends Controller
{
    private function makeCurlRequest($url, $data)
    {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        $response = curl_exec($ch);

        if ($response === false) {
            $error = curl_error($ch);
            curl_close($ch);
            throw new \Exception('Erro na requisição: ' . $error);
        }

        curl_close($ch);

        return json_decode($response, true);
    }

    public function checkOrder($shopify_id, $omieState)
    {
        // Verifica se existe um registro na tabela HistoryLog
        $historyLog = Historylog::where('step', 17)
            ->where('shopify_id', $shopify_id)
            ->where('log', 'like', '{"codigo_pedido":%')
            ->first();

        if ($historyLog) {
            // Se encontrou o registro, cria um novo log e retorna true
            Historylog::create([
                'step' => 30,
                'shopify_id' => $shopify_id,
                'log' => json_encode(["status" => "ja integrado"])
            ]);
            return true;
        }

        // Se não encontrou no HistoryLog, continua com a consulta no Omie
        $searchUrl = 'https://app.omie.com.br/api/v1/produtos/pedido/';
        $searchData = [
            "call" => "ConsultarPedido",
            "param" => [
                [
                    "codigo_pedido_integracao" => $shopify_id
                ]
            ]
        ];

        // Primeira consulta no ES
        $searchData['app_key'] = env('OMIEAK_ES');
        $searchData['app_secret'] = env('OMIESK_ES');
        $responseConsultar = $this->makeCurlRequest($searchUrl, $searchData);

        $pedidoEncontrado = isset($responseConsultar['pedido_venda_produto']['cabecalho']['codigo_pedido']);

        if (!$pedidoEncontrado) {
            // Se não encontrar o pedido, tenta novamente com as credenciais de PE
            $searchData['app_key'] = env('OMIEAK_PE');
            $searchData['app_secret'] = env('OMIESK_PE');
            $responseConsultar = $this->makeCurlRequest($searchUrl, $searchData);
            $pedidoEncontrado = isset($responseConsultar['pedido_venda_produto']['cabecalho']['codigo_pedido']);
            Historylog::create([
                'step' => 27,
                'shopify_id' => $shopify_id,
                'log' => json_encode([
                    'pedido_encontrado' => $pedidoEncontrado,
                    'resposta_omie' => $responseConsultar
                ])
            ]);
        }

        // Registra o log do resultado da consulta
        Historylog::create([
            'step' => 26,
            'shopify_id' => $shopify_id,
            'log' => json_encode([
                'pedido_encontrado' => $pedidoEncontrado,
                'resposta_omie' => $responseConsultar
            ])
        ]);

        return $pedidoEncontrado;
    }

    public function checkClient($cpf, $omieState)
    {
        $credentials = $this->omieCredentials($omieState);
        $url = 'https://app.omie.com.br/api/v1/geral/clientes/';
        $data = [
            "call" => "ListarClientes",
            "app_key" => $credentials['app'],
            "app_secret" => $credentials['sk'],
            "param" => [
                [
                    "pagina" => 1,
                    "registros_por_pagina" => 50,
                    "apenas_importado_api" => "N",
                    "clientesFiltro" => [
                        [
                            "cnpj_cpf" => $cpf
                        ]
                    ]
                ]
            ]
        ];

        $response = $this->makeCurlRequest($url, $data);

        if (isset($response['clientes_cadastro'][0])) {
            // Cliente encontrado - registra no HistoryLog
            Historylog::create([
                'step' => 59,
                'shopify_id' => $cpf,
                'log' => json_encode(['status' => 'Cliente encontrado no Omie', 'cliente' => $response['clientes_cadastro'][0]])
            ]);
            return $response['clientes_cadastro'][0];  // Retorna os dados do cliente
        }

        if (isset($response['faultstring']) && strpos($response['faultstring'], 'Não existem registros') !== false) {
            // Cliente não encontrado no Omie - registra no HistoryLog em vez do Log
            Historylog::create([
                'step' => 60,
                'shopify_id' => $cpf,
                'log' => json_encode(['status' => 'Cliente não encontrado no Omie', 'cpf' => $cpf])
            ]);
            return null;
        }

        Historylog::create([
            'step' => 61, // Alterado de 28 para 61
            'shopify_id' => $cpf,
            'log' => json_encode(['error' => 'Erro na consulta de cliente: ' . $response['faultstring']])
        ]);
        return null;
    }

    public function checkStreet($cep, $logradouro)
    {
        // Remove caracteres não numéricos do CEP
        $cep = preg_replace('/[^0-9]/', '', $cep);

        // Verifica se é um CEP geral (terminado em 000)
        if (substr($cep, -3) === '000') {
            return $logradouro;
        }

        // Faz a requisição à API do Brasil API
        $url = "https://brasilapi.com.br/api/cep/v1/{$cep}";
        $response = @file_get_contents($url);
        $data = json_decode($response, true);

        // Se a Brasil API falhar, tenta a ViaCEP
        if (!$response || isset($data['message'])) {
            $viacepUrl = "https://viacep.com.br/ws/{$cep}/json/";
            $viacepResponse = @file_get_contents($viacepUrl);
            $viacepData = json_decode($viacepResponse, true);

            if ($viacepResponse && !isset($viacepData['erro'])) {
                $data = $viacepData;
                $data['street'] = $data['logradouro'];
            }
        }

        // Verifica se a requisição foi bem-sucedida e se o logradouro está contido
        if (isset($data['street']) && !empty($data['street'])) {
            $apiLogradouro = mb_strtolower($data['street'], 'UTF-8');
            $inputLogradouro = mb_strtolower($logradouro, 'UTF-8');

            // Remove acentos para comparação
            $apiLogradouroSemAcentos = $this->removeAccents($apiLogradouro);
            $inputLogradouroSemAcentos = $this->removeAccents($inputLogradouro);

            // Verifica se o logradouro de entrada está contido no logradouro da API
            if (strpos($inputLogradouroSemAcentos, $apiLogradouroSemAcentos) !== false) {
                return $this->substituirAbreviacoes($data['street']); // Retorna o logradouro da API com abreviações
            } elseif (similar_text($inputLogradouroSemAcentos, $apiLogradouroSemAcentos, $percent) && $percent > 80) {
                return $this->substituirAbreviacoes($data['street']); // Retorna o logradouro da API com abreviações se a similaridade for maior que 80%
            } elseif (levenshtein($inputLogradouroSemAcentos, $apiLogradouroSemAcentos) <= 3) {
                return $this->substituirAbreviacoes($data['street']); // Retorna o logradouro da API com abreviações se a distância de Levenshtein for menor ou igual a 3
            }
        }

        return $this->substituirAbreviacoes($logradouro); // Mantém o logradouro original com abreviações se não houver correspondência ou se o retorno for vazio
    }

    public function substituirAbreviacoes($logradouro)
    {
    // Carrega o arquivo CSV de abreviações
    $abreviacoes = [];
    $handle = fopen(base_path('app/ABREVIACAO.csv'), 'r');
    if ($handle !== false) {
        // Pula a primeira linha (cabeçalho)
        fgetcsv($handle);
        while (($data = fgetcsv($handle, 1000, ",")) !== false) {
            $abreviacoes[$data[1]] = $data[0];
        }
        fclose($handle);
    }

    // Divide o logradouro em palavras
    $palavras = explode(' ', $logradouro);

    // Substitui as palavras pelas abreviações correspondentes
    foreach ($palavras as &$palavra) {
        $palavraUpperCase = mb_strtoupper($palavra, 'UTF-8');
        if (isset($abreviacoes[$palavraUpperCase])) {
            $palavra = $abreviacoes[$palavraUpperCase];
        }
    }

    // Junta as palavras de volta em uma string
    return implode(' ', $palavras);
    }

    public function removeAccents($string)
    {
        return preg_replace(
            array("/(á|à|ã|â|ä)/", "/(é|è|ê|ë)/", "/(í|ì|î|ï)/", "/(ó|ò|õ|ô|ö)/", "/(ú|ù|û|ü)/", "/(ñ)/", "/(ç)/"),
            array("a", "e", "i", "o", "u", "n", "c"),
            $string
        );
    }


    public function createClient($credentials, $shopifyWebhook)
    {
        $additionalFields = $this->mapAdditionalFields($shopifyWebhook['note_attributes']);

        // Obtendo valores de endereço
        $shippingAddress = $shopifyWebhook['shipping_address'] ?? $shopifyWebhook['default_address'] ?? $shopifyWebhook['customer']['default_address'];
        $zipcode = $additionalFields['shipping_zipcode'] ?? $shippingAddress['zip'] ?? $shopifyWebhook['default_address']['zip'] ?? $shopifyWebhook['customer']['default_address']['zip'];
        $street = $this->getStreet($zipcode, $additionalFields['shipping_street'] ?? explode(',', $shippingAddress['address1'] ?? $shopifyWebhook['default_address']['address1'] ?? $shopifyWebhook['customer']['default_address']['address1'])[0]);
        $number = $additionalFields['shipping_number'] ?? $this->getAddressNumber($shippingAddress['address1'] ?? $shopifyWebhook['default_address']['address1'] ?? $shopifyWebhook['customer']['default_address']['address1']);
        $neighborhood = $additionalFields['shipping_neighborhood'] ?? $shippingAddress['address2'] ?? $shopifyWebhook['default_address']['address2'] ?? $shopifyWebhook['customer']['default_address']['address2'];
        $complement = $this->getComplementValue($shopifyWebhook, $additionalFields);

        // Verificando CPF ou CNPJ
        $cpf = $this->getCpfOrCnpj($additionalFields, $shippingAddress);

        // Estado e cidade
        $state = $additionalFields['shipping_province'] ?? $shippingAddress['province_code'] ?? $shopifyWebhook['default_address']['province_code'];
        $city = $this->getCityByZipcode($zipcode, $shippingAddress['city'] ?? $shopifyWebhook['default_address']['city']);

        // Dados do cliente
        $email = $shopifyWebhook['customer']['email'];
        $phoneData = $this->getPhoneData(
            $shopifyWebhook['billing_address']['phone']
            ?? $shopifyWebhook['default_address']['phone']
            ?? $shopifyWebhook['customer']['default_address']['phone']
        );

        $name = $shippingAddress['name'] ?? $shopifyWebhook['billing_address']['name'] ?? $shopifyWebhook['default_address']['name'] ?? $shopifyWebhook['customer']['default_address']['name'];
        $shopifyCustomer = $shopifyWebhook['customer']['id'];

        // Dados para envio à Omie
        $data = $this->buildClientData($credentials, $shopifyCustomer, $email, $name, $cpf, $street, $number, $complement, $neighborhood, $city, $state, $zipcode, $phoneData);

        // Faz a requisição à Omie
        $response = $this->makeCurlRequest('https://app.omie.com.br/api/v1/geral/clientes/', $data);

        // Tratamento de erro de cliente existente
        $response = $this->handleExistingClientError($response, $credentials, $shopifyWebhook);

        // Registro no HistoryLog
        $this->logHistory(62, $shopifyWebhook['name'], $response); // Alterado de 9 para 62

        // Cria cliente se não existir ou atualiza se já existir
        return $this->saveClient($response, $cpf, $shopifyCustomer, $shopifyWebhook['name'], $credentials, $shopifyWebhook);
    }

    private function getStreet($zipcode, $street)
    {
        return $this->checkStreet($zipcode, $street);
    }

    private function getAddressNumber($address1)
    {
        return explode(',', $address1)[1];
    }

    private function getComplementValue($shopifyWebhook, $additionalFields)
    {
        if (strpos($shopifyWebhook['note'], 'Pedido Yampi') === 0) {
            return $this->getComplement($shopifyWebhook['shipping_address']['address1']);
        }
        return $this->getNoteAttributeValue($shopifyWebhook['note_attributes'], 'additional_info_shipping_complement');
    }

    private function getCpfOrCnpj($additionalFields, $shippingAddress)
    {
        $cpfCnpj = preg_replace('/[.-]/', '', $additionalFields['cpf_cnpj']);
        return strlen($cpfCnpj) == 11 ? $additionalFields['cpf_cnpj'] : $shippingAddress['company'];
    }

    private function getCityByZipcode($zipcode, $cityInput)
    {
        $cityResult = $this->getCity($zipcode);
        return $cityResult === "Localidade não encontrada para o CEP informado." ? $cityInput : $cityResult;
    }

    private function getPhoneData($phone)
    {
        $phone = str_replace(['+', '55'], '', $phone);
        return [
            'ddd' => substr($phone, 0, 2),
            'number' => substr($phone, 2)
        ];
    }

    private function buildClientData($credentials, $shopifyCustomer, $email, $name, $cpf, $street, $number, $complement, $neighborhood, $city, $state, $zipcode, $phoneData)
    {
        return [
            "call" => "IncluirCliente",
            "app_key" => $credentials['app'],
            "app_secret" => $credentials['sk'],
            "param" => [
                [
                    "codigo_cliente_integracao" => $shopifyCustomer,
                    "email" => $email,
                    "razao_social" => $name,
                    "nome_fantasia" => $name,
                    "cnpj_cpf" => $cpf,
                    "endereco" => $street,
                    "endereco_numero" => $number,
                    "complemento" => $complement,
                    "bairro" => $neighborhood,
                    "cidade" => $city,
                    "estado" => $state,
                    "cep" => $zipcode,
                    "codigo_pais" => "1058",
                    "telefone1_ddd" => $phoneData['ddd'],
                    "telefone1_numero" => $phoneData['number'],
                    "pessoa_fisica" => "S",
                    "optante_simples_nacional" => "N",
                    "importado_api" => "S",
                    "contribuinte" => "N"
                ]
            ]
        ];
    }

    private function handleExistingClientError($response, $credentials, $shopifyWebhook)
    {
        if (!isset($response['codigo_cliente_omie']) && isset($response['faultstring']) && strpos($response['faultstring'], 'nCod [') !== false) {
            preg_match('/nCod \[(\d+)\]/', $response['faultstring'], $matches);
            if (isset($matches[1])) {
                $codigoClienteOmie = $matches[1];
                return $this->updateClient($codigoClienteOmie, $credentials, $shopifyWebhook);
            }
        }
        return $response;
    }

    private function logHistory($step, $shopifyId, $response)
    {
        Historylog::create([
            'step' => $step,
            'shopify_id' => $shopifyId,
            'log' => json_encode($response)
        ]);
    }

    private function saveClient($response, $cpf, $shopifyCustomer, $shopifyId, $credentials, $shopifyWebhook)
    {

        if (isset($response['faultstring']) && strpos($response['faultstring'], 'Cliente já cadastrado') !== false) {
            preg_match('/Id \[(\d+)\]/', $response['faultstring'], $matches);
            if (isset($matches[1])) {
                $omieClientId = $matches[1];

                // Atualiza o cliente existente
                $updatedResponse = $this->updateClient($omieClientId, $credentials, $shopifyWebhook);

                // Atualiza ou cria o registro do cliente
                Clients::updateOrCreate(
                    ['cpf' => $cpf],
                    [
                        'omie_client' => $omieClientId,
                        'shopify_client' => $shopifyCustomer
                    ]
                );

                // Atualiza o pedido
                Orders::where('shopify_id', $shopifyId)->update([
                    'omie_client' => $omieClientId
                ]);

                return $omieClientId;
            }
        }

        if (isset($response['codigo_cliente_omie'])) {
            Clients::create([
                'omie_client' => $response['codigo_cliente_omie'],
                'cpf' => $cpf,
                'shopify_client' => $shopifyCustomer
            ]);

            Orders::where('shopify_id', $shopifyId)->update([
                'omie_client' => $response['codigo_cliente_omie']
            ]);

            return $response['codigo_cliente_omie'];
        }

        if (isset($response['httpCode']) && $response['httpCode'] == 500) {
            Historylog::create([
                'step' => 63, // Alterado de 29 para 63
                'shopify_id' => $shopifyId,
                'log' => json_encode(['error' => 'Erro 500 ao criar cliente na Omie'])
            ]);
            return null;
        }

        Historylog::create([
            'step' => 64, // Alterado de 30 para 64
            'shopify_id' => $shopifyId,
            'log' => json_encode(['error' => 'Resposta inesperada da Omie ao criar cliente: ' . json_encode($response)])
        ]);
        return null;
    }

    public function updateClient($omie_client, $credentials, $shopifyWebhook)
    {
        $dadosEntrega = $this->mapAdditionalFields($shopifyWebhook['note_attributes']);
        $shippingAddress = $shopifyWebhook['shipping_address'] ?? $shopifyWebhook['default_address'] ?? $shopifyWebhook['customer']['default_address'];
        $zipcode = $dadosEntrega['shipping_zipcode'] ?? $shippingAddress['zip'] ?? $shopifyWebhook['default_address']['zip'] ?? $shopifyWebhook['customer']['default_address']['zip'];
        $street = $this->checkStreet($zipcode, $dadosEntrega['shipping_street'] ?? explode(',', $shippingAddress['address1'])[0]);
        $number = $dadosEntrega['shipping_number'] ?? explode(',', $shippingAddress['address1'])[1];
        $neighborhood = $dadosEntrega['shipping_neighborhood'] ?? $shippingAddress['address2'] ?? $shopifyWebhook['default_address']['address2'] ?? $shopifyWebhook['customer']['default_address']['address2'];

        if (strpos($shopifyWebhook['note'], 'Pedido Yampi') === 0) {
            $complement = $this->getComplement($shippingAddress['address1']);
        } else {
            $complement = $this->getNoteAttributeValue($shopifyWebhook['note_attributes'], 'additional_info_shipping_complement');
        }

        $cpf = strlen(preg_replace('/[.-]/', '', $dadosEntrega['cpf_cnpj'])) == 11 ? $dadosEntrega['cpf_cnpj'] : $shippingAddress['company'];
        $state = $dadosEntrega['shipping_province'] ?? $shippingAddress['province_code'];
        $cityInput = $shippingAddress['city'];
        $cityResult = $this->getCity($dadosEntrega['shipping_zipcode'] ?? $shippingAddress['zip']);
        $city = $cityResult === "Localidade não encontrada para o CEP informado." ? $cityInput : $cityResult;
        $email = $shopifyWebhook['customer']['email'];
        $phone = str_replace(['+', '55'], '', $shopifyWebhook['billing_address']['phone'] ?? $shopifyWebhook['default_address']['phone']);
        $name = $shippingAddress['name'] ?? $shopifyWebhook['billing_address']['name'] ?? $shopifyWebhook['default_address']['name'];
        $ddd = substr($phone, 0, 2);
        $phone = substr($phone, 2);
        $shopify_customer = $shopifyWebhook['customer']['id'];

        $data = [
            "call" => "UpsertCliente",
            "app_key" => $credentials['app'],
            "app_secret" => $credentials['sk'],
            "param" => [
                [
                    "codigo_cliente_omie" => $omie_client,
                    "email" => $email,
                    "razao_social" => $name,
                    "nome_fantasia" => $name,
                    "cnpj_cpf" => strlen($dadosEntrega['cpf_cnpj']) == 11 ? $dadosEntrega['cpf_cnpj'] : $shippingAddress['company'],
                    "endereco" => $street,
                    "endereco_numero" => $number,
                    "complemento" => $complement,
                    "bairro" => $neighborhood,
                    "cidade" => $city,
                    "estado" => $state,
                    "cep" => $zipcode,
                    "codigo_pais" => "1058",
                    "telefone1_ddd" => $ddd,
                    "telefone1_numero" => $phone,
                    "pessoa_fisica" => "S",
                    "optante_simples_nacional" => "N",
                    "importado_api" => "S",
                    "contribuinte" => "N",
                    "bloquear_faturamento" => "N",
                    "inativo" => "N"
                ]
            ]
        ];

        $response = $this->makeCurlRequest('https://app.omie.com.br/api/v1/geral/clientes/', $data);

        Historylog::create([
            'step' => 65, // Alterado de 10 para 65
            'shopify_id' => $shopifyWebhook['name'],
            'log' => json_encode($response)
        ]);

        Clients::updateOrCreate(
            ['cpf' => $cpf],
            [
                'omie_client' => $omie_client,
                'shopify_client' => $shopify_customer,
                'cpf' => $cpf
            ]
        );
        if (isset($response['codigo_cliente_omie']) && $response['codigo_status'] == '0') {
            return $response['codigo_cliente_omie'];
        } elseif (isset($response['codigo_status']) && $response['codigo_status'] == '101' && isset($response['codigo_cliente_omie'])) {
            // Cliente já cadastrado, atualizar novamente com o ID do cliente
            $data['param'][0]['codigo_cliente_omie'] = $response['codigo_cliente_omie'];
            $novaResposta = $this->makeCurlRequest('https://app.omie.com.br/api/v1/geral/clientes/', $data);

            if (isset($novaResposta['codigo_cliente_omie']) && $novaResposta['codigo_status'] == '0') {
                return $novaResposta['codigo_cliente_omie'];
            }
        }

        // Registra erro no HistoryLog em vez do Log padrão
        Historylog::create([
            'step' => 66,
            'shopify_id' => $shopifyWebhook['name'],
            'log' => json_encode(['error' => 'Erro ao atualizar cliente na Omie', 'response' => $response])
        ]);
        return false;
    }

    private function getComplement($address)
    {
        $addressParts = explode(",", $address);
        $complement = $addressParts[2] ?? '';
        return $complement;
    }

    public function getCity($zipcode)
    {
        // Formata a URL com o CEP informado
        $url = "https://viacep.com.br/ws/{$zipcode}/json/";

        // Inicializa a sessão cURL
        $ch = curl_init();

        // Configura as opções da sessão cURL
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);

        // Executa a requisição
        $response = curl_exec($ch);

        // Verifica se houve erro na requisição
        if ($response === false) {
            curl_close($ch);
            return "Erro na requisição: " . curl_error($ch);
        }

        // Fecha a sessão cURL
        curl_close($ch);

        // Decodifica o JSON retornado
        $data = json_decode($response, true);

        // Verifica se o campo "ibge" está presente
        if (isset($data['ibge'])) {
            $ibgeCode = $data['ibge'];
        } else {
            // Tenta buscar a cidade usando a API Brasil Aberto
            $brasilAbertoUrl = "https://api.brasilaberto.com/v1/zipcode/{$zipcode}";
            $brasilAbertoResponse = Http::get($brasilAbertoUrl);

            if ($brasilAbertoResponse->successful()) {
                $brasilAbertoData = $brasilAbertoResponse->json();
                if (isset($brasilAbertoData['result']['ibgeId'])) {
                    $ibgeCode = $brasilAbertoData['result']['ibgeId'];
                } else {
                    return "Localidade não encontrada para o CEP informado.";
                }
            } else {
                return "Localidade não encontrada para o CEP informado.";
            }
        }

        // Chama a função getCityByIBGE e retorna o resultado
        return $this->getCityByIBGE($ibgeCode);
    }


    public function getCityByIBGE($ibgeId)
    {
        $url = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios/{$ibgeId}";

        $response = Http::get($url);

        if ($response->successful()) {
            $data = $response->json();
            if (isset($data['nome'])) {
                return $data['nome'];
            }
        }

        return "Cidade não encontrada para o código IBGE informado.";
    }

    public function setBillingTime()
    {
        date_default_timezone_set('America/Sao_Paulo');

        $currentDateTime = Carbon::now();

        if ($currentDateTime->hour < 18) {
            return $currentDateTime->format('d/m/Y');
        }

        $currentDateTime->addDay();

        return $currentDateTime->format('d/m/Y');
    }

    public function skuArray($totalQty, $shopify_id, $omieCredentials, $shippingMethod, $omieClient, $estimatedTime, $shippingPrice, $skuDiscounts, $uf, $shopifyWebhook)
    {
        $additionalFields = $this->mapAdditionalFields($shopifyWebhook['note_attributes']);
        $neighborhood = $additionalFields['shipping_neighborhood'] ?? $shopifyWebhook['shipping_address']['address2'] ?? $shopifyWebhook['default_address']['address2'];

        $cityInput = $shopifyWebhook['shipping_address']['city'] ?? $shopifyWebhook['default_address']['city'];
        $cityResult = $this->getCity($additionalFields['shipping_zipcode'] ?? $shopifyWebhook['shipping_address']['zip'] ?? $shopifyWebhook['default_address']['zip']);
        $city = $cityResult === "Localidade não encontrada para o CEP informado." ? $cityInput : $cityResult;
        $state = $additionalFields['shipping_province'] ?? $shopifyWebhook['shipping_address']['province_code'] ?? $shopifyWebhook['default_address']['province_code'];

        $complement = $this->getComplement($shopifyWebhook['shipping_address']['address1'] ?? $shopifyWebhook['default_address']['address1']);
        $pedido = [
            'informacoes_adicionais' => [
                'enviar_email' => 'N',
                'consumidor_final' => 'S',
                'codigo_categoria' => '1.01.01',
                'codigo_conta_corrente' => $omieCredentials['conta'],
                'numero_pedido_cliente' => $shopify_id,
                'contato'=>$shopifyWebhook['shipping_address']['name'] ?? $shopifyWebhook['billing_address']['name'],
                'outros_detalhes' => [
                    'cBairroOd' => $additionalFields['shipping_neighborhood'] ?? $shopifyWebhook['shipping_address']['address2'],
                    'cCEPOd' => $zipcode = $additionalFields['shipping_zipcode'] ?? $shopifyWebhook['shipping_address']['zip'],
                    'cCidadeOd' => $city. '(' . $state . ')',
                    'cCnpjCpfOd' => strlen($additionalFields['cpf_cnpj']) == 11 ? $additionalFields['cpf_cnpj'] : $shopifyWebhook['shipping_address']['company'],
                    'cEnderecoOd' => $this->checkStreet($zipcode, $additionalFields['shipping_street'] ?? explode(',', $shopifyWebhook['shipping_address']['address1'])[0]),
                    'cEstadoOd' => $state,
                    'cNumeroOd' => $additionalFields['shipping_number'] ?? explode(',', $shopifyWebhook['shipping_address']['address1'])[1],
                    'cComplementoOd' => $complement
                ]
            ],
            'cabecalho' => [
                'codigo_cliente' => $omieClient,
                'codigo_pedido_integracao' => $shopify_id,
                'etapa' => '50',
                'quantidade_itens' => $totalQty,
                'data_previsao' => $estimatedTime
            ],
            'frete' => [
                'modalidade' => '0',
                'valor_frete' => $shippingPrice,
                'quantidade_volumes' => '1',
                'especie_volumes' => 'Caixas',
                'codigo_transportadora' => $shippingMethod
            ],
            'det' => []
        ];

        $skuMapping = [
            'CBGH448' => 'CBGH614',
            'CBGH449' => 'CBGH615',
            'CBGH450' => 'CBGH616',
            'CBGH451' => 'CBGH617',
            'CBGH18' => 'KGH003',
            'CBGH481' => 'CBGH677',
            'CBGH448' => 'CBGH678',
            'CBGH449' => 'CBGH679',
            'CBGH334'=> 'CBGH677',
            'CBGH280' => 'CBGH680',
            'CBGH337' => 'CBGH681',
            'CBGH338' => 'CBGH682',
            'CBGH450' => 'CBGH683',
            'CBGH451' => 'CBGH684',
            'CHGH647'=>'CBGH647',
            'CBGH732'=>'CBGH750',
            'CBGH733'=>'CBGH752',
            'CBGH644' => 'CBGH590',
            'CBGH645' => 'CBGH591',
            'CBGH646' => 'CBGH593',
            'CBGH647' => 'CBGH592',
            'CBGH720' => 'CBGH594',
            
            // kit night abaixo
            // 'CBGH195'=>'CBGH757',
            // 'CBGH674'=> 'CBGH758',
            // 'CBGH724'=> 'CBGH759',
            // 'CBGH722'=> 'CBGH760',
            // 'CBGH531'=> 'CBGH761',
            // 'CBGH750'=> 'CBGH762',
            // 'CBGH730'=> 'CBGH763',
            // 'CBGH755'=> 'CBGH764'
        ];

        $pedidosEspeciais = [
        '643398', '643401', '643409', '643411', '643427', '643013', '643053', '643079',
        '642634', '642655', '642681', '642689', '642860', '642866', '642900', '642956',
        '642965', '642980', '642225', '642228', '642264', '642267', '642270', '642390',
        '642391', '642424', '642458', '642463', '642467', '642485', '642504', '642543',
        '642566', '642575', '642577', '642599', '641827', '641837', '641860', '641898',
        '641938', '641952', '641978', '641983', '642007', '642020', '642036', '642080',
        '642085', '642200', '642204', '642213', '641213', '641227', '641239', '641248',
        '641270', '641272', '641278', '641292', '641303', '641305', '641340', '641413',
        '641416', '641417', '641433', '641507', '641522', '641525', '641545', '641588',
        '641603', '641614', '641653', '641656', '641671', '641713', '641753', '641763',
        '641801'
        ];

        if (in_array($shopify_id, $pedidosEspeciais)) {
            $skuMapping = [
                'CBGH663' => 'CBGH669',
                'CBGH664' => 'CBGH670',
                'CBGH665' => 'CBGH671',
                'CBGH666' => 'CBGH672',
                'CBGH701' => 'CBGH708'
            ];
        }

        foreach ($skuDiscounts as $index => $item) {
            $item['sku'] = $skuMapping[$item['sku']] ?? $item['sku'];

            $product = Products::where('sku', $item['sku'])->where('uf', $uf)->first();

            if (!$product) {
                $omieProduct = $this->getOmieSku([$item['sku']], $omieCredentials['app'], $omieCredentials['sk']);

                if (isset($omieProduct[0])) {
                    $omieProductDetails = json_decode($omieProduct[0], true);

                    $product = Products::updateOrCreate(
                        ['sku' => $item['sku'], 'uf' => $uf],
                        ['id_produto' => $omieProductDetails['codigo_produto']]
                    );

                    $codigoProduto = $omieProductDetails['codigo_produto'];
                } else {
                    throw new \Exception('Erro ao recuperar dados do produto Omie para SKU: ' . $item['sku']);
                }
            } else {
                $codigoProduto = $product->id_produto;
            }

            $currentItem = [
                'ide' => [
                    'codigo_item_integracao' => $index
                ],
                'produto' => [
                    'codigo_produto' => $codigoProduto,
                    'codigo_produto_integracao' => $product->codigo_produto_integracao ?? null,
                    'quantidade' => $item['quantity'],
                    'valor_unitario' => $item['price'],
                    'valor_desconto' => $item['discount'],
                    'tipo_desconto' => 'V'
                ]
            ];
            $pedido['det'][] = $currentItem;
        }

        return $pedido;
    }

    public function getDiscountSKU($result)
    {
        $skuDiscounts = [];
        $additionalDiscounts = [];

        if (!isset($result['line_items'])) {
            // Retorna um array vazio em vez de uma string
            return [];
        }

        foreach ($result['line_items'] as $item) {
            $price = $item['price'];
            $sku = $item['sku'];
            $totalDiscount = $item['discount_allocations'][0]['amount_set']['shop_money']['amount'] ?? 0;
            $qty = $item['current_quantity'];

            if ($price == 0.00 || $price == 0.01) {
                $price = 16.50;
                $additionalDiscounts[] = 16.50 * $qty;
            }

            $skuDiscounts[] = [
                'sku' => $sku,
                'discount' => $totalDiscount,
                'quantity' => $qty,
                'price' => $price
            ];
        }

        foreach ($additionalDiscounts as $additionalDiscount) {
            foreach ($skuDiscounts as &$skuDiscount) {
                if ($skuDiscount['price'] != 16.50) {
                    $skuDiscount['discount'] += $additionalDiscount;
                    break;
                }
            }
        }

        return $skuDiscounts;
    }


    public function getOmieSku($skus, $app, $sk)
    {
        $url = 'https://app.omie.com.br/api/v1/geral/produtos/';
        $responses = [];

        foreach ($skus as $sku) {
            $data = [
                "call" => "ConsultarProduto",
                "app_key" => $app,
                "app_secret" => $sk,
                "param" => [
                    [
                        "codigo" => $sku
                    ]
                ]
            ];

            $ch = curl_init($url);

            curl_setopt($ch, CURLOPT_POST, 1);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Content-Type: application/json'
            ]);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

            if ($response === false) {
                $error = curl_error($ch);
                echo "Erro na requisição para SKU $sku: $error\n";
                continue;
            }

            if ($httpCode != 200) {
                echo "Erro na requisição para SKU $sku: HTTP $httpCode\n";
                echo "Resposta: $response\n";
                continue;
            }

            $responses[] = $response;
            curl_close($ch);
        }

        return $responses;
    }

    public function shippingMethod($shipping, $omieCredentials, $shopify_id)
    {
        $uf = ($omieCredentials['app'] == '2378496621501') ? 'ES' : 'PE';

        $envVar = match ($shipping) {
            'FRENET_LOGGI_LOG_VIP_2' => env('LOGGI' . $uf),
            'FRENET_LOGGI_LOG_VIP', 'FRENET_LOGGI_EXPRESSO_LOG_VIP' => env('LOGGI' . $uf),
            'FRENET_SEDEX__03220' => env('SEDEX' . $uf),
            'FRENET_PAC_03298', 'FRENET_PAC_04510_BACKUP' => env('PAC' . $uf),
            default => env('LOGGI' . $uf),
        };

        if ($envVar) {
            return $envVar;
        }

        Historylog::create([
            'step' => 25,
            'shopify_id' => $shopify_id,
            'log' => '{"status":"Transportadora não reconhecida:' . $shipping . '}',
        ]);

        throw new \Exception('Transportadora não reconhecida: ' . $shipping);
    }

    public function pushOmie($omieCredentials, $skuArray, $shopify_id)
    {
        try {
            $dataCriar = [
                "call" => "IncluirPedido",
                "app_key" => $omieCredentials['app'],
                "app_secret" => $omieCredentials['sk'],
                "param" => [$skuArray]
            ];

            $responseCriar = $this->makeCurlRequest('https://app.omie.com.br/api/v1/produtos/pedido/', $dataCriar);

            Historylog::create([
                'step' => 17,
                'shopify_id' => $shopify_id,
                'log' => json_encode($responseCriar)
            ]);

            $codigo_pedido = $responseCriar['codigo_pedido'] ?? $this->extractValue($responseCriar['faultstring'], 'Código [', ']');
            Orders::where('shopify_id', $shopify_id)->update(['omie_id' => $codigo_pedido]);

            return $responseCriar;
        } catch (\Exception $e) {
            Historylog::create([
                'step' => 17,
                'shopify_id' => $shopify_id,
                'log' => $e->getMessage()
            ]);
            throw $e;
        }
    }

    public function omieCredentials($uf)
    {
        return [
            'sk' => env('OMIESK_ES'),
            'app' => env('OMIEAK_ES'),
            'conta' => env('OMIECONTA_ES')
        ];
        // return match ($uf) {
        //     'ES' => [
        //         'sk' => env('OMIESK_ES'),
        //         'app' => env('OMIEAK_ES'),
        //         'conta' => env('OMIECONTA_ES')
        //     ],
        //     default => [
        //         'sk' => env('OMIESK_PE'),
        //         'app' => env('OMIEAK_PE'),
        //         'conta' => env('OMIECONTA_PE')
        //     ]
        // };
    }

    public function omieState($province_code)
    {
        $states = ['ES'];
        return 'ES';
    }



    private function extractValue($string, $startDelim, $endDelim)
    {
        $startPos = strpos($string, $startDelim);
        if ($startPos === false) {
            return false;
        }
        $startPos += strlen($startDelim);
        $endPos = strpos($string, $endDelim, $startPos);
        if ($endPos === false) {
            return false;
        }
        return substr($string, $startPos, $endPos - $startPos);
    }

    public function newNfe(Request $request)
    {
        $orderId = $request['event']['id_pedido'];
        $link = $request['event']['nfe_danfe'];
        $appKey = $request['appKey'];

        $envVars = $this->getEnvVars($appKey);
        $appkey = $envVars['appkey'];
        $secret = $envVars['secret'];

        $omieData = $this->getOrderData($orderId, $appkey, $secret);
        $shopify = new ShopifyController();
        $shopifyId = $shopify->getShopifyId($omieData);
        $orderDetails = $shopify->getOrderDetails($shopifyId);
        $name = $orderDetails['name'];
        $phone = $orderDetails['phone'];

        $this->sendNfe($name, $phone, $link, $omieData);
    }

    private function getEnvVars($appKey)
    {
        return match ($appKey) {
            env('OMIEAK_ES') => [
                'appkey' => env('OMIEAK_ES'),
                'secret' => env('OMIESK_ES'),
            ],
            env('OMIEAK_PE') => [
                'appkey' => env('OMIEAK_PE'),
                'secret' => env('OMIESK_PE'),
            ],
            default => throw new Exception('Invalid app key'),
        };
    }

    private function getOrderData($orderId, $app, $sk)
    {
        $response = Http::withHeaders([
            'Content-Type' => 'application/json',
        ])->post('https://app.omie.com.br/api/v1/produtos/pedido/', [
            'call' => 'ConsultarPedido',
            'app_key' => $app,
            'app_secret' => $sk,
            'param' => [
                [
                    'codigo_pedido' => $orderId
                ]
            ]
        ]);

        $response = json_decode($response, true);
        return $response['pedido_venda_produto']['cabecalho']['codigo_pedido_integracao'];
    }

    public function sendNfe($name, $phone, $link, $orderId)
    {
        $data = [
            'platform_id' => $phone,
            'channel_id' => env('SYNGOO_ID'),
            'type' => 'text',
            'is_hsm' => '1',
            'hsm_template_name' => 'apigummy_nfe2',
            'hsm_placeholders' => [
                $name,
                $orderId,
                $link
            ],
            'token' => env('SYNGOO_TOKEN'),
            'close_session' => 3
        ];

        Orders::updateOrCreate(
            ['shopify_id' => $orderId],
            [
                'rastreio' => true,
                'recebido' => true,
                'pago' => true,
                'nf' => true
            ]
        );

        SendMessage::dispatch($data, 18, $orderId)->onQueue('messages');

        return response()->json(['status' => 'adicionado a fila de envio'], 200);
    }


    public function mapAdditionalFields($noteAttributes)
    {
        return [
            'shipping_zipcode' => $this->getNoteAttributeValue($noteAttributes, 'additional_info_shipping_zipcode'),
            'shipping_province' => $this->getNoteAttributeValue($noteAttributes, 'additional_info_shipping_province'),
            'shipping_city' => $this->getNoteAttributeValue($noteAttributes, 'additional_info_shipping_city'),
            'shipping_neighborhood' => $this->getNoteAttributeValue($noteAttributes, 'additional_info_shipping_neighborhood'),
            'shipping_complement' => $this->getNoteAttributeValue($noteAttributes, 'additional_info_shipping_complement'),
            'shipping_number' => $this->getNoteAttributeValue($noteAttributes, 'additional_info_shipping_number'),
            'shipping_street' => $this->getNoteAttributeValue($noteAttributes, 'additional_info_shipping_street'),
            'cpf_cnpj' => $this->getNoteAttributeValue($noteAttributes, 'additional_cpf_cnpj')
        ];
    }

    // Função auxiliar para obter o valor do campo específico em note_attributes
    private function getNoteAttributeValue($noteAttributes, $attributeName)
    {
        foreach ($noteAttributes as $attribute) {
            if ($attribute['name'] === $attributeName) {
                return $attribute['value'];
            }
        }
        return null;
    }

    public function excluirPedidos(Request $request)
    {
        $app_key = env('OMIEAK_PE');
        $app_secret = env('OMIESK_PE');
        $url = 'https://app.omie.com.br/api/v1/produtos/pedido/';

        $pedidos = $request->input('pedidos', []);

        foreach ($pedidos as $codigo_pedido) {
            $data = [
                'call' => 'ExcluirPedido',
                'app_key' => $app_key,
                'app_secret' => $app_secret,
                'param' => [
                    [
                        'codigo_pedido_integracao' => $codigo_pedido
                    ]
                ]
            ];

            $options = [
                CURLOPT_URL => $url,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => json_encode($data),
                CURLOPT_HTTPHEADER => [
                    'Content-Type: application/json'
                ]
            ];

            $curl = curl_init();
            curl_setopt_array($curl, $options);
            $response = curl_exec($curl);
            $httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
            curl_close($curl);

            // Decodifica a resposta JSON
            $responseData = json_decode($response, true);

            // Salva o log usando o HistoryLog
            HistoryLog::create([
                'shopify_id' => $codigo_pedido,
                'log' => json_encode($responseData),
                'step' => 50
            ]);

            // Verifica se a exclusão foi bem-sucedida ou se recebeu o código 500
            if ($httpCode == 500) {
                // Se receber o código 500, continua para o próximo pedido
                continue;
            } elseif (!isset($responseData['codigo_status']) || $responseData['codigo_status'] !== "0") {
                // Log adicional de erro se a exclusão falhar
                HistoryLog::create([
                    'shopify_id' => $codigo_pedido,
                    'log' => "Falha ao excluir pedido: " . json_encode($responseData),
                    'step' => 50
                ]);
            }
        }

        return response()->json(['mensagem' => 'Processo de exclusão de pedidos concluído.']);
    }
}

