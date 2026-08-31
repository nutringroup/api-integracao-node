<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use App\Http\Controllers\ShopifyController;
use App\Jobs\SendToOmie;

class ApproveOrderJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected $shopify_id;
    protected $requestData;

    public function __construct($shopify_id, array $requestData)
    {
        $this->shopify_id = $shopify_id;
        $this->requestData = $requestData;
    }

    public function handle()
    {
        $shopifyController = new ShopifyController();
        $shopifyController->approvedOrder($this->shopify_id, $this->requestData);
        SendToOmie::dispatch($this->requestData)->delay(15);
    }
}
