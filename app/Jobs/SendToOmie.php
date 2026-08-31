<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use App\Http\Controllers\OmieController;
use App\Models\Historylog;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class SendToOmie implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected $shopifyData;

    /**
     * Create a new job instance.
     */
    public function __construct(array $shopifyData)
    {
        $this->shopifyData = $shopifyData;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $omieController = new OmieController();
        $shopify_id = $this->shopifyData['name'];

        // Define qual Omie vai ser usado
        $state = $omieController->omieState($this->shopifyData['billing_address']['province_code']);
        $omieCredentials = $omieController->omieCredentials($state);

        // Checa se o pedido já existe na Omie
        $orderExists = $omieController->checkOrder($this->shopifyData['name'], $state);

        if ($orderExists) {
            Historylog::create([
                'step' => 8,
                'shopify_id' => $this->shopifyData['name'],
                'log' => '{"status":"Pedido já integrado"}'
            ]);
            return;  // Finaliza a execução se o pedido já existe
        }

        // Recupera CPF/CNPJ do cliente
        $cpfCnpj = $this->getCpfCnpj();
        if (!$this->isValidCpfCnpj($cpfCnpj)) {
            Historylog::create([
                'step' => 9,
                'shopify_id' => $shopify_id,
                'log' => json_encode(['status' => 'CPF ou CNPJ inválido', 'cpf_cnpj' => $cpfCnpj])
            ]);
            return; // Interrompe a execução se o CPF/CNPJ for inválido
        }

        // Checa se o cliente já existe na Omie
        $omieClient = $omieController->checkClient($cpfCnpj, $state);

        // Atualiza ou cria o cliente
        if ($omieClient) {
            $omieClient = $omieController->updateClient($omieClient['codigo_cliente_omie'], $omieCredentials, $this->shopifyData);
            if (!$omieClient) {
                Historylog::create([
                    'step' => 10,
                    'shopify_id' => $shopify_id,
                    'log' => json_encode(['status' => 'Erro ao atualizar o cliente na Omie'])
                ]);
                return; // Interrompe a execução se não conseguir atualizar o cliente
            }
        } else {
            $omieClient = $omieController->createClient($omieCredentials, $this->shopifyData);
            if (!$omieClient) {
                Historylog::create([
                    'step' => 11,
                    'shopify_id' => $shopify_id,
                    'log' => json_encode(['status' => 'Erro ao criar o cliente na Omie'])
                ]);
                return; // Interrompe a execução se não conseguir criar o cliente
            }
        }

        // Verifica a transportadora e faz o push dos dados para a Omie
        $shippingMethod = $omieController->shippingMethod(
            isset($this->shopifyData['shipping_lines'][0]['code']) ? $this->shopifyData['shipping_lines'][0]['code'] : 'LOGGI',
            $omieCredentials,
            $shopify_id
        );
        $estimatedTime = $omieController->setBillingTime();
        $skuDiscounts = $omieController->getDiscountSKU($this->shopifyData);
        $totalQty = count($skuDiscounts);
        $shippingPrice = $this->shopifyData['total_shipping_price_set']['shop_money']['amount'];
        $skuArray = $omieController->skuArray($totalQty, $shopify_id, $omieCredentials, $shippingMethod, $omieClient, $estimatedTime, $shippingPrice, $skuDiscounts, $state, $this->shopifyData);
        $omieController->pushOmie($omieCredentials, $skuArray, $shopify_id);
    }

    /**
     * Obtém o CPF/CNPJ do cliente com base nas informações fornecidas.
     *
     * @return string|null
     */
    private function getCpfCnpj()
    {
        $shopifyController = new \App\Http\Controllers\ShopifyController();
        $cpfCnpj = $shopifyController->getCpfCnpj($this->shopifyData['id']);

        if (is_null($cpfCnpj)) {
            $cpfCnpj = $this->shopifyData['billing_address']['company'] ?? null;

            if (is_null($cpfCnpj)) {
                $cpfCnpj = $this->getNoteAttributeValue($this->shopifyData['note_attributes'], 'cpf_cnpj');
            }
        }

        return $cpfCnpj;
    }

    /**
     * Mapeia campos adicionais a partir de 'note_attributes'.
     *
     * @param array $noteAttributes
     * @return array
     */
    public function mapAdditionalFields($noteAttributes)
    {
        return [
            'cpf_cnpj' => $this->getNoteAttributeValue($noteAttributes, 'additional_cpf_cnpj')
        ];
    }

    /**
     * Obtém o valor de um atributo específico em 'note_attributes'.
     *
     * @param array $noteAttributes
     * @param string $attributeName
     * @return mixed|null
     */
    private function getNoteAttributeValue($noteAttributes, $attributeName)
    {
        foreach ($noteAttributes as $attribute) {
            if ($attribute['name'] === $attributeName) {
                return $attribute['value'];
            }
        }
        return null;
    }

    /**
     * Valida se o valor é um CPF ou CNPJ válido.
     *
     * @param string|null $cpfCnpj
     * @return bool
     */
    private function isValidCpfCnpj($cpfCnpj)
    {
        if (is_null($cpfCnpj)) {
            return false;
        }

        // Remove caracteres não numéricos
        $cpfCnpj = preg_replace('/\D/', '', $cpfCnpj);

        // Verifica se é um CPF válido (11 dígitos)
        if (strlen($cpfCnpj) === 11) {
            return true;
        }

        // Verifica se é um CNPJ válido (14 dígitos)
        if (strlen($cpfCnpj) === 14) {
            return true;
        }

        return false;
    }
}
