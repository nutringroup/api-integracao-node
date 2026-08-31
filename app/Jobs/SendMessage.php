<?php

namespace App\Jobs;

use App\Http\Controllers\SyngooController;
use App\Models\Historylog;
use App\Models\Orders;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendMessage implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected $data;
    protected $step;
    protected $shopify_id;

    /**
     * Create a new job instance.
     *
     * @param array $data
     * @param int $step
     * @param string $shopify_id
     * @return void
     */
    public function __construct(array $data, int $step, string $shopify_id)
    {
        $this->data = $data;
        $this->step = $step;
        $this->shopify_id = $shopify_id;
    }

    /**
     * Execute the job.
     *
     * @return void
     */
    public function handle()
    {
        $syngooController = app(SyngooController::class);
        $response = $syngooController->sendMessage($this->data);

        Historylog::create([
            'step' => $this->step,
            'shopify_id' => $this->shopify_id,
            'log' => json_encode($response)
        ]);
    }
}
