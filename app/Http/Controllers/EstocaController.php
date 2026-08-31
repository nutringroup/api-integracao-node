<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Http\Controllers\ShopifyController;
use App\Jobs\SendMessage;
use App\Models\Orders;

class EstocaController extends Controller
{
    public function filterTracking(Request $request)
    {
        $trackings = $request['data']['trackings'];
        foreach ($trackings as $tracking) {
            $status = $tracking['status'];
            $marketplaceOrderId = $tracking['marketplaceOrderId'];
            $trackingCode = $tracking['trackingCode'];
            switch ($status):
                case 'Conferido':
                case 'OBJETO POSTADO':
                case 'OBJETO POSTADO APÓS O HORÁRIO LIMITE DA UNIDADE':
                case 'bipe de expedição':
                case 'COLETA SOLICITADA':
                    $this->sendTrackingCode($marketplaceOrderId, $trackingCode);
                    break;

                case 'OBJETO SAIU PARA ENTREGA AO DESTINATÁRIO':
                case 'Retirado':
                case 'bipe de saída para entrega':
                case 'em rota':
                    $this->inDelivery($marketplaceOrderId, $trackingCode);
                    break;
                case 'Entregue':
                case 'OBJETO ENTREGUE AO DESTINATÁRIO':
                case 'assinatura de encomenda':
                case 'ENTREGUE':
                    $this->delivered($marketplaceOrderId, $trackingCode);
                    break;
                case 'OBJETO AGUARDANDO RETIRADA NO ENDEREÇO INDICADO':
                    break;
                default:
                    return response()->json(['status' => 'Atualização recebida'], 200);
                    break;
            endswitch;
        }
        return response()->json(['status' => 'Atualização recebida'], 200);
    }

    private function sendTrackingCode($orderId, $tracking)
    {
        $shopify = new ShopifyController();
        $shopifyId = $shopify->getShopifyId($orderId);
        $orderDetails = $shopify->getOrderDetails($shopifyId);
        $name = $orderDetails['name'];
        $phone = $orderDetails['phone'];
        $phoneLength = strlen($phone);
        if ($phoneLength == 8 || $phoneLength == 9) {
            $phone = '55' . $phone;
        }
        $cpf = $orderDetails['cpf'];
        $link = 'https://gummyhair.rastreio.estoca.com.br/tracking?code=' . $tracking . '&cnpj=' . $cpf;
        $data = [
            'platform_id' => $phone,
            'channel_id' => env('SYNGOO_ID'),
            'type' => 'text',
            'is_hsm' => '1',
            'hsm_template_name' => 'apigummy_rastreio3',
            'hsm_placeholders' => [
                $name,
                $orderId,
                $link
            ],
            'token' => env('SYNGOO_TOKEN'),
            'close_session' => 3
        ];

        $order = Orders::updateOrCreate(
            ['shopify_id' => $orderId],
            [
                'rastreio' => true,
                'recebido' => true,
                'pago' => true,
                'nf' => true,
                'rastreio' => true
            ]
        );

        SendMessage::dispatch($data, 19, $orderId)->onQueue('messages');
    }

    private function inDelivery($orderId, $tracking)
    {
        $shopify = new ShopifyController();
        $shopifyId = $shopify->getShopifyId($orderId);
        $orderDetails = $shopify->getOrderDetails($shopifyId);
        $name = $orderDetails['name'];
        $phone = $orderDetails['phone'];
        $phoneLength = strlen($phone);
        if ($phoneLength == 8 || $phoneLength == 9) {
            $phone = '55' . $phone;
        }

        $cpf = $orderDetails['cpf'];
        $link = 'https://gummyhair.rastreio.estoca.com.br/tracking?code=' . $tracking . '&cnpj=' . $cpf;
        $data = [
            'platform_id' => $phone,
            'channel_id' => env('SYNGOO_ID'),
            'type' => 'text',
            'is_hsm' => '1',
            'hsm_template_name' => 'apigummy_emrota',
            'hsm_placeholders' => [
                $name,
                $orderId,
                $link
            ],
            'token' => env('SYNGOO_TOKEN'),
            'close_session' => 3
        ];

        $order = Orders::updateOrCreate(
            ['shopify_id' => $orderId],
            [
                'rastreio' => true,
                'recebido' => true,
                'pago' => true,
                'nf' => true,
                'saiu' => true
            ]
        );

        SendMessage::dispatch($data, 20, $orderId)->onQueue('messages');
    }

    private function delivered($orderId, $tracking)
    {
        $shopify = new ShopifyController();
        $shopifyId = $shopify->getShopifyId($orderId);
        $orderDetails = $shopify->getOrderDetails($shopifyId);
        $name = $orderDetails['name'];
        $phone = $orderDetails['phone'];
        $phoneLength = strlen($phone);
        if ($phoneLength == 8 || $phoneLength == 9) {
            $phone = '55' . $phone;
        }
        $cpf = $orderDetails['cpf'];
        $link = 'https://gummyhair.rastreio.estoca.com.br/tracking?code=' . $tracking . '&cnpj=' . $cpf;
        $data = [
            'platform_id' => $phone,
            'channel_id' => env('SYNGOO_ID'),
            'type' => 'text',
            'is_hsm' => '1',
            'hsm_template_name' => 'apigummy_emrota',
            'hsm_placeholders' => [
                $name,
                $orderId,
                $link
            ],
            'token' => env('SYNGOO_TOKEN'),
            'close_session' => 3
        ];

        $order = Orders::updateOrCreate(
            ['shopify_id' => $orderId],
            [
                'rastreio' => true,
                'recebido' => true,
                'pago' => true,
                'nf' => true,
                'saiu' => true,
                'entregue' => true
            ]
        );

        SendMessage::dispatch($data, 21, $orderId)->onQueue('messages');
    }

    private function avaliablePickup($orderId, $tracking)
    {
        $shopify = new ShopifyController();
        $shopifyId = $shopify->getShopifyId($orderId);
        $orderDetails = $shopify->getOrderDetails($shopifyId);
        $name = $orderDetails['name'];
        $phone = $orderDetails['phone'];
        $phoneLength = strlen($phone);
        if ($phoneLength == 8 || $phoneLength == 9) {
            $phone = '55' . $phone;
        }
        $cpf = $orderDetails['cpf'];
        $link = 'https://gummyhair.rastreio.estoca.com.br/tracking?code=' . $tracking . '&cnpj=' . $cpf;
        $data = [
            'platform_id' => $phone,
            'channel_id' => env('SYNGOO_ID'),
            'type' => 'text',
            'is_hsm' => '1',
            'hsm_template_name' => 'apigummy_retirada',
            'hsm_placeholders' => [
                $name,
                $orderId,
                $link
            ],
            'token' => env('SYNGOO_TOKEN'),
            'close_session' => 3
        ];

        $order = Orders::updateOrCreate(
            ['shopify_id' => $orderId],
            [
                'rastreio' => true,
                'recebido' => true,
                'pago' => true,
                'nf' => true,
                'saiu' => true
            ]
        );

        SendMessage::dispatch($data, 22, $orderId)->onQueue('messages');
    }
}
