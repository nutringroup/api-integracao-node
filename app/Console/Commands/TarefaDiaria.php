<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Carbon\Carbon;
use App\Http\Controllers\OmieController;
use App\Http\Controllers\ShopifyController;
use Illuminate\Support\Facades\Log;
use App\Models\ManualOrders; // Adicionando o modelo ManualOrders

class TarefaDiaria extends Command
{
    protected $signature = 'tarefa:diaria';
    protected $description = 'Executa a tarefa diária às 23:59';

    protected $omieController;
    protected $shopifyController;

    public function __construct(OmieController $omieController, ShopifyController $shopifyController)
    {
        parent::__construct();
        $this->omieController = $omieController;
        $this->shopifyController = $shopifyController;
    }

    public function handle()
    {
        // Obter as credenciais da Shopify do arquivo .env
        $shopifyUrl = env('SHOPIFYURL');
        $shopifyApiVersion = env('SHOPIFYAPIV');
        $shopifyAccessToken = env('SHOPIFY_SK');

        // $hoje = Carbon::now()->format('Y-m-d');
        $hoje = "2025-01-20";
        // $trintaDiasAtras = Carbon::now()->subDays(2)->format('Y-m-d');
        $trintaDiasAtras = "2025-01-15";

        // Inicializar array para armazenar todos os pedidos
        $todosPedidos = [];

        // URL inicial da API
        $url = "{$shopifyUrl}/admin/api/{$shopifyApiVersion}/orders.json?status=any&financial_status=paid&created_at_min={$trintaDiasAtras}&created_at_max={$hoje}&order=created_at asc";

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
                $this->error('Falha ao recuperar pedidos: ' . $response->status());
                break;
            }
        } while ($url);

        $this->info('Total de pedidos aprovados recuperados: ' . count($todosPedidos));

        // Verificar integração com Omie e reintegrar se necessário
        $pedidosReintegrados = [];
        foreach ($todosPedidos as $pedido) {
            $shopifyId = $pedido['id'];
            $name = $pedido['name'];
            $state = isset($pedido['shipping_address']['province_code'])
                ? $pedido['shipping_address']['province_code']
                : 'SP'; // Valor padrão caso não exista

            // Verificar se o pedido está na tabela de pedidos manuais
            $pedidoManual = ManualOrders::where('shopify_id', $shopifyId)->first();
            if ($pedidoManual) {
                $this->info("Pedido {$name} (Província: {$state}) já está na tabela de pedidos manuais.");
                continue;
            }

            $pedidoIntegrado = $this->verificarIntegracaoOmie($name, $state);

            if (!$pedidoIntegrado) {
                $this->info("Pedido {$name} (Província: {$state}) não integrado. Iniciando reintegração...");
                Log::info("TarefaDiaria: Pedido {$name} (Província: {$state}) não integrado. Iniciando reintegração.");
                $reintegrado = $this->reintegrarPedido($name, $state);
                if ($reintegrado) {
                    $pedidosReintegrados[] = $name;
                }
            } else {
                $this->info("Pedido {$name} (Província: {$state}) já integrado no Omie.");
            }
        }

        $this->info('Tarefa diária concluída às ' . Carbon::now()->format('H:i:s'));
        $this->info('Total de pedidos reintegrados: ' . count($pedidosReintegrados));
        if (!empty($pedidosReintegrados)) {
            $this->info('Pedidos reintegrados: ' . implode(', ', $pedidosReintegrados));
        }
    }

    private function extrairProximaUrl($linkHeader)
    {
        if (preg_match('/<([^>]*)>;\s*rel="next"/', $linkHeader, $matches)) {
            return $matches[1];
        }
        return null;
    }

    private function verificarIntegracaoOmie($name, $state)
    {
        $omieState = $this->omieController->omieState($state);
        return $this->omieController->checkOrder($name, $omieState);
    }

    private function reintegrarPedido($name, $state)
    {
        try {
            $shopifyController = new \App\Http\Controllers\ShopifyController();

            // Cria uma nova requisição com os dados do pedido
            $request = new \Illuminate\Http\Request(['shopify_id' => $name]);

            // Chama o método reintegrateOrder do ShopifyController
            $response = $shopifyController->reintegrateOrder($request);

            // Verifica a resposta
            if ($response->getStatusCode() == 200) {
                $this->info("Pedido {$name} enviado para fila.");
                return true;
            } else {
                $this->error("Falha ao reintegrar o pedido {$name}.");
                return false;
            }
        } catch (\Exception $e) {
            $this->error("Erro ao reintegrar o pedido {$name}: " . $e->getMessage());
            Log::error("TarefaDiaria: Erro ao reintegrar o pedido {$name}: " . $e->getMessage());
            return false;
        }
    }
}
