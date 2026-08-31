<?php

namespace App\Jobs;

use App\Http\Controllers\ShopifyController;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class CreateOrderJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected $shopify_id;
    protected $requestData;

    /**
     * Cria uma nova instância de job.
     *
     * @param string $shopify_id
     * @param array $requestData
     * @return void
     */
    public function __construct($shopify_id, array $requestData)
    {
        $this->shopify_id = $shopify_id;
        $this->requestData = $requestData;
    }

    /**
     * Executa o job.
     *
     * @return void
     */
    public function handle()
    {
        $shopifyController = new ShopifyController();
        $shopifyController->createOrder($this->shopify_id, $this->requestData);
    }
}
