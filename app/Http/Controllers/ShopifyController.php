<?php

namespace App\Http\Controllers;

use App\Jobs\ApproveOrderJob;
use App\Jobs\CreateOrderJob;
use App\Jobs\SendMessage;
use App\Models\Historylog;
use App\Models\Orders;
use App\Models\ManualOrder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Redis;
use App\Http\Controllers\OmieController;
use App\Models\ManualOrders;
use Carbon\Exceptions\Exception;
use Illuminate\Support\Facades\Log;


class ShopifyController extends Controller
{
    public function newOrder(Request $request)
    {
        $status = $request['financial_status'];
        $shopify_id = $request['name'];
        $id = $request['id'];

        // Verifica se o pedido está na lista de pedidos manuais
        $isManualOrder = ManualOrders::where('shopify_id', $shopify_id)->exists();

        if ($isManualOrder) {
            return response()->json(['message' => 'Este é um pedido manual e não deve ser processado automaticamente.'], 400);
        }


        if ($status == 'paid') {
            try {
                $orderData = Orders::where('shopify_id', $shopify_id)->first();

                if ($orderData && $orderData->pago == true) {
                    Historylog::create([
                        'step' => 7,
                        'shopify_id' => $shopify_id,
                        'log' => json_encode($request)
                    ]);
                    return response()->json(['status' => 'Já Processado'], 200);
                }

                if ($orderData && $orderData->recebido == true) {
                    ApproveOrderJob::dispatch($shopify_id, $request->all())->onQueue('orders');
                    return response()->json(['message' => 'Pedido Aprovado'], 200);
                }

                CreateOrderJob::dispatch($shopify_id, $request->all())->onQueue('orders');
                ApproveOrderJob::dispatch($shopify_id, $request->all())->delay(now()->addSeconds(20))->onQueue('orders');

        // Move a atualização do CPF para depois da verificação de pedido manual
        try {
            $cpf = $this->getCpfCnpj($shopify_id);
            $this->updateCompanyField($cpf, $id);
        } catch (\Exception $e) {
            Log::error("Erro ao atualizar CPF do pedido {$shopify_id}: " . $e->getMessage());
                    // Continua o fluxo mesmo se falhar a atualização do CPF
                }
                return response()->json(['message' => 'Pedido criado e aprovado'], 200);
            } catch (\Exception $e) {
                return response()->json(['error' => $e->getMessage()], 500);
            }
        }

        if ($status == 'pending') {
            $orderData = Orders::where('shopify_id', $shopify_id)->first();
            if (!$orderData) {
                CreateOrderJob::dispatch($shopify_id, $request->all())->onQueue('orders');
                return response()->json(['message' => 'Pedido recebido, pagamento pendente'], 200);
            }
        }

        return response()->json(['message' => 'Novo pedido recebido com sucesso']);
    }

    public function createOrder($shopify_id, array $requestData)
    {
        // Verifica se o pedido está na lista de pedidos manuais
        $isManualOrder = ManualOrders::where('shopify_id', $shopify_id)->exists();

        if ($isManualOrder) {
            Historylog::create([
                'step' => 0,
                'shopify_id' => $shopify_id,
                'log' => json_encode(['message' => 'Pedido manual não processado automaticamente'])
            ]);
            return;
        }

        Historylog::create([
            'step' => 1,
            'shopify_id' => $shopify_id,
            'log' => json_encode($requestData)
        ]);

        $link = $requestData['order_status_url'];

        Orders::create([
            'shopify_id' => $shopify_id
        ]);

        Historylog::create([
            'step' => 2,
            'shopify_id' => $shopify_id,
            'log' => json_encode($requestData)
        ]);
        Orders::where('shopify_id', $shopify_id)->update(['recebido' => true]);

        // Verifica se já existe um log de mensagem enviada para esta etapa
        $existingLog = Historylog::where('shopify_id', $shopify_id)
            ->where('step', 3)
            ->first();

        if (!$existingLog) {
            $this->sendMessage($requestData, $link, 'apigummy_recebido4', 3, $shopify_id);
        } else {
            // Registra que a mensagem não foi enviada novamente
            Historylog::create([
                'step' => 3,
                'shopify_id' => $shopify_id,
                'log' => json_encode(['message' => 'Mensagem já enviada anteriormente'])
            ]);
        }
    }

    public function approvedOrder($shopify_id, array $requestData)
    {
        // Verifica se o pedido está na lista de pedidos manuais
        $isManualOrder = ManualOrders::where('shopify_id', $shopify_id)->exists();

        if ($isManualOrder) {
            Historylog::create([
                'step' => 0,
                'shopify_id' => $shopify_id,
                'log' => json_encode(['message' => 'Pedido manual não processado automaticamente'])
            ]);
            return response()->json(['message' => 'Este é um pedido manual e não deve ser processado automaticamente.'], 400);
        }

        $link = $requestData['order_status_url'];
        Historylog::create([
            'step' => 4,
            'shopify_id' => $shopify_id,
            'log' => json_encode($requestData)
        ]);

        Orders::where('shopify_id', $shopify_id)->update([
            'pago' => true
        ]);

        // Atualiza o CPF primeiro
        try {
            $shopify_name = $this->getShopifyId($shopify_id);
            $cpf = $this->getCpfCnpj($shopify_name);
            if ($cpf) {
                $this->updateCompanyField($cpf, $shopify_name);
                Historylog::create([
                    'step' => 6,
                    'shopify_id' => $shopify_id,
                    'log' => json_encode(['message' => 'CPF atualizado com sucesso: ' . $cpf])
                ]);
            }
        } catch (\Exception $e) {
            Historylog::create([
                'step' => 6,
                'shopify_id' => $shopify_id,
                'log' => json_encode(['error' => 'Erro ao atualizar CPF: ' . $e->getMessage()])
            ]);
            Log::error("Erro ao atualizar CPF do pedido {$shopify_id}: " . $e->getMessage());
        }

        // Verifica se já existe um log de mensagem enviada para esta etapa
        $existingLog = Historylog::where('shopify_id', $shopify_id)
            ->where('step', 4)
            ->first();

        if (!$existingLog) {
            $this->sendMessage($requestData, $link, 'apigummy_aprovado3', 5, $shopify_id);
        } else {
            // Registra que a mensagem não foi enviada novamente
            Historylog::create([
                'step' => 4,
                'shopify_id' => $shopify_id,
                'log' => json_encode(['message' => 'Mensagem já enviada anteriormente'])
            ]);
        }

        return response()->json(['message' => 'Order approved successfully']);
    }

    private function updateCompanyField($cpf, $shopify_id) {

        $curl = curl_init();

        curl_setopt_array($curl, array(
        CURLOPT_URL => 'https://gummyhairdev.myshopify.com/admin/api/2024-10/orders/' . $shopify_id . '.json',
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_ENCODING => '',
        CURLOPT_MAXREDIRS => 10,
        CURLOPT_TIMEOUT => 0,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
        CURLOPT_CUSTOMREQUEST => 'PUT',
        CURLOPT_POSTFIELDS =>'{
        "order": {
            "id": ' . $shopify_id . ',
            "shipping_address": {
            "company": ' . $cpf . '
            }
        }
        }',
        CURLOPT_HTTPHEADER => array(
            'Content-Type: application/json',
            'X-Shopify-Access-Token: ' . env('SHOPIFY_ACCESS_TOKEN')
        ),
        ));

        $response = curl_exec($curl);

        curl_close($curl);
        echo $response;

    }

    private function sendMessage($requestData, $link, $hsm, $step, $shopify_id)
    {
        $phone = str_replace('+', '', $requestData['shipping_address']['phone'] ?? $requestData['billing_address']['phone']);
        $phoneLength = strlen($phone);
        if ($phoneLength == 8 || $phoneLength == 9) {
            $phone = '55' . $phone;
        }
        $data = [
            'platform_id' => $phone,
            'channel_id' => env('SYNGOO_ID'),
            'type' => 'text',
            'is_hsm' => '1',
            'hsm_template_name' => $hsm,
            'hsm_placeholders' => [
                $requestData['billing_address']['first_name'],
                $shopify_id,
                $link
            ],
            'token' => env('SYNGOO_TOKEN'),
            'close_session' => 3
        ];

        SendMessage::dispatch($data, $step, $shopify_id)->onQueue('messages');

        return response()->json(['status' => 'adicionado a fila de envio'], 200);
    }


    public function getShopifyId($shopify_id)
    {

        $curl = curl_init();

        curl_setopt_array($curl, array(
            CURLOPT_URL => 'https://gummyhairdev.myshopify.com/admin/api/2024-07/graphql.json',
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_ENCODING => '',
            CURLOPT_MAXREDIRS => 10,
            CURLOPT_TIMEOUT => 0,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
            CURLOPT_CUSTOMREQUEST => 'POST',
            CURLOPT_POSTFIELDS => '{
          "query": "query GetOrderByOrderName { orders(first: 1, query: \\"name:#' . $shopify_id . '\\") { edges { node { id name email createdAt totalPriceSet { shopMoney { amount currencyCode } } } } } }"
        }',
            CURLOPT_HTTPHEADER => array(
                'Content-Type: application/json',
                'X-Shopify-Access-Token: ' . env('SHOPIFY_ACCESS_TOKEN')
            ),
        ));

        $response = curl_exec($curl);
        $response = json_decode($response, true);

        $orderId = $response['data']['orders']['edges'][0]['node']['id'];
        $parts = explode('/', $orderId);
        $orderIdOnly = end($parts);
        return $orderIdOnly;
    }

    public function getOrderDetails($shopifyOrder)
    {
        $curl = curl_init();

        curl_setopt_array($curl, array(
            CURLOPT_URL => 'https://gummyhairdev.myshopify.com/admin/api/2024-10/orders/' . $shopifyOrder . '.json',
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_ENCODING => '',
            CURLOPT_MAXREDIRS => 10,
            CURLOPT_TIMEOUT => 0,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
            CURLOPT_CUSTOMREQUEST => 'GET',
            CURLOPT_HTTPHEADER => array(
                'X-Shopify-Access-Token: ' . env('SHOPIFY_ACCESS_TOKEN'),
                'Cache-Control: no-cache'
            ),
        ));

        $response = curl_exec($curl);

        curl_close($curl);
        $responseArray = json_decode($response, true); // Convert to an associative array
        $phone = $responseArray['order']['billing_address']['phone'];
        $firstName = $responseArray['order']['billing_address']['first_name'];
        $cpf = $responseArray['order']['billing_address']['company'];

        return ['phone' => $phone, 'name' => $firstName, 'cpf' => $cpf];
    }

    public function getOrderData($shopifyOrder)
    {
        $curl = curl_init();

        curl_setopt_array($curl, array(
            CURLOPT_URL => 'https://gummyhairdev.myshopify.com/admin/api/2024-10/orders/' . $shopifyOrder . '.json',
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_ENCODING => '',
            CURLOPT_MAXREDIRS => 10,
            CURLOPT_TIMEOUT => 0,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
            CURLOPT_CUSTOMREQUEST => 'GET',
            CURLOPT_HTTPHEADER => array(
                'X-Shopify-Access-Token: ' . env('SHOPIFY_ACCESS_TOKEN'),
                'Cache-Control: no-cache, no-store, must-revalidate',
                'Pragma: no-cache',
                'Expires: 0'
            ),
        ));

        $response = curl_exec($curl);

        curl_close($curl);
        $responseArray = json_decode($response, true); // Converte para um array associativo

        return $responseArray;
    }

    public function reintegrateOrder(Request $request)
    {
        try {
            $shopify_id = $request->input('shopify_id');

            // Verifica se o pedido está na lista de pedidos manuais
            $isManualOrder = ManualOrders::where('shopify_id', $shopify_id)->exists();

            if ($isManualOrder) {
                return response()->json([
                    'message' => 'Este é um pedido manual e não deve ser reintegrado automaticamente.',
                    'newOrderResponse' => [
                        ['step' => 0, 'log' => json_encode(['message' => 'Pedido manual não reintegrado'])]
                    ]
                ], 400);
            }

            // Verifica se o pedido já existe no banco local
            $existingOrder = Orders::where('shopify_id', $shopify_id)->first();

            // Recupera o ID do pedido Shopify usando o nome do pedido
            $orderId = $this->getShopifyId($shopify_id);

            // Obtém os detalhes do pedido do Shopify
            $orderDetails = $this->getOrderData($orderId);
            $reintegrateOrder = $orderDetails['order'];

            // Verifica se existe um log com step 17 e o padrão especificado
            $logStep17 = Historylog::where('shopify_id', $shopify_id)
                ->where('step', 17)
                ->whereJsonContains('log->descricao_status', 'Pedido cadastrado com sucesso!')
                ->first();

            if ($logStep17) {
                // Adiciona uma nova etapa com step 30
                Historylog::create([
                    'step' => 30,
                    'shopify_id' => $shopify_id,
                    'log' => json_encode(['message' => 'Pedido já está integrado'])
                ]);

                return response()->json([
                    'message' => 'Pedido já está integrado.',
                    'newOrderResponse' => [
                        ['step' => 30, 'log' => json_encode(['message' => 'Pedido já está integrado'])]
                    ]
                ]);
            }

            // Apaga todos os registros de Historylog com o mesmo shopify_id após a step 5
            Historylog::where('shopify_id', $shopify_id)->where('step', '>=', 5)->delete();

            // Se o pedido já existe, apaga-o
            if ($existingOrder) {
                $existingOrder->delete();
            }

            // Passa o pedido reintegrado para o fluxo do método newOrder
            $newRequest = new Request($reintegrateOrder);
            $response = $this->newOrder($newRequest);

            // Retorna uma resposta JSON com uma mensagem de sucesso
            return response()->json([
                'message' => 'Pedido reintegrado com sucesso!',
                'newOrderResponse' => $response->original
            ]);
        } catch (\Exception $e) {
            // Tratamento de exceção
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function findGaps($gaps)
    {
        $paidGaps = [];

        // Verifica os gaps que são pagos e não foram processados (sem fulfillment status)
        foreach ($gaps as $gap) {
            $orderId = $this->getShopifyId($gap);
            $orderData = $this->getOrderData($orderId);

            if ($orderData['order']['financial_status'] == 'paid' && $orderData['order']['fulfillment_status'] == null) {
                $paidGaps[] = $gap;
            }
        }

        $missingInEstoca = [];

        // Verifica na API da Estoca se os IDs não existem
        foreach ($paidGaps as $gap) {
            $estocaExists = $this->getEstoca($gap);

            if (!$estocaExists) {
                $missingInEstoca[] = $gap;
            }
        }

        $missingInOmie = [];

        // Verifica na API da Omie se os IDs não existem
        foreach ($missingInEstoca as $gap) {
            $omieExists = $this->getOmie($gap); // Função getOmie retorna true ou false

            if ($omieExists) {
                $missingInOmie[] = $gap;
            }
        }

        return $missingInOmie; // Retorna os IDs que não existem na Omie
    }


    public function getEstoca($shopify_id)
    {
        $curl = curl_init();

        curl_setopt_array($curl, array(
            CURLOPT_URL => 'https://api.estoca.com.br/orders/' . $shopify_id . '/external',
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_ENCODING => '',
            CURLOPT_MAXREDIRS => 10,
            CURLOPT_TIMEOUT => 0,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
            CURLOPT_CUSTOMREQUEST => 'GET',
            CURLOPT_HTTPHEADER => array(
                'X-Api-Key: 32898484-32c8-4024-9e6c-b8495516d0b0',
                'X-Api-Version: v1'
            ),
        ));

        $response = curl_exec($curl);
        $httpcode = curl_getinfo($curl, CURLINFO_HTTP_CODE);

        curl_close($curl);

        if ($httpcode == 404) {
            return false;
        } elseif ($httpcode == 200) {
            return true;
        }

        return false; // Você pode ajustar esse retorno conforme a necessidade
    }
    public function getOmie($shopify_id)
    {
        $omie = new OmieController();
        $omie->checkOrder($shopify_id, 'ES');
    }

    public function getShopifyHistory()
    {
        // Obter as credenciais da Shopify do arquivo .env
    $shopifyUrl = env('SHOPIFYURL');
    $shopifyApiVersion = env('SHOPIFYAPIV');
    $shopifyAccessToken = env('SHOPIFY_SK');

    $hoje = '2024-08-04';
    $trintaDiasAtras = '2024-08-03';

    // Inicializar array para armazenar todos os pedidos
    $todosPedidos = [];

    // URL inicial da API
    $url = "{$shopifyUrl}/admin/api/{$shopifyApiVersion}/orders.json?status=any&financial_status=paid&created_at_min={$trintaDiasAtras}&created_at_max={$hoje}";

    do {
        // Fazer a requisição à API da Shopify
        $response = Http::withHeaders([
            'X-Shopify-Access-Token' => $shopifyAccessToken,
        ])->get($url);

        // Verificar se a requisição foi bem-sucedida
        if ($response->successful()) {
            $pedidosAprovados = $response->json()['orders'];
            $todosPedidos = array_merge($todosPedidos, $pedidosAprovados);

            // Verificar se há mais páginas
            $linkHeader = $response->header('Link');
            $nextUrl = $this->extrairProximaUrl($linkHeader);
            $url = $nextUrl;
        } else {
           dd('erro');
            break;
        }
    } while ($url);

    // Extrair e retornar os nomes dos pedidos
    $nomesPedidos = [];

    foreach ($todosPedidos as $pedido) {
        $name = $pedido['name']; // Extrai o nome do pedido
        $nomesPedidos[] = $name;  // Armazena o nome em um array
    }
        $gaps = $this->findGaps($nomesPedidos);
        return $gaps;
    }

    private function extrairProximaUrl($linkHeader)
    {
        if (preg_match('/<([^>]*)>;\s*rel="next"/', $linkHeader, $matches)) {
            return $matches[1];
        }
        return null;
    }

public function reintegrateMultipleOrders(Request $request)
{
    $pedidos = $request->input('pedidos');

    if (is_array($pedidos)) {
        foreach ($pedidos as $shopify_id) {
            $this->reintegrateOrder(new Request(['shopify_id' => $shopify_id]));
        }

        return response()->json(['message' => 'Pedidos reintegrados com sucesso.']);
    }

    return response()->json(['message' => 'Formato de requisição inválido.'], 400);
}


// Nova função pra pegar o cpf/cnpj do cliente
public function getCpfCnpj($shopify_id){
    $curl = curl_init();

    curl_setopt_array($curl, array(
        CURLOPT_URL => 'https://gummyhairdev.myshopify.com/admin/api/2024-01/graphql.json',
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_ENCODING => '',
        CURLOPT_MAXREDIRS => 10,
        CURLOPT_TIMEOUT => 0,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
        CURLOPT_CUSTOMREQUEST => 'POST',
        CURLOPT_POSTFIELDS =>'{
        "query": "query { order(id: \\"gid://shopify/Order/' . $shopify_id . '\\") { name localizationExtensions(first: 10) { nodes { purpose countryCode title value } } } }"
        }',
        CURLOPT_HTTPHEADER => array(
            'X-Shopify-Access-Token: ' . env('SHOPIFY_ACCESS_TOKEN'),
            'Cache-Control: no-cache',
            'Content-Type: application/json'
        ),
    ));

    $response = curl_exec($curl);
    curl_close($curl);

    $response = json_decode($response, true);

    if (isset($response['data']['order']['localizationExtensions']['nodes'][0]['value'])) {
        return $response['data']['order']['localizationExtensions']['nodes'][0]['value'];
    }

    return null;
}


}

