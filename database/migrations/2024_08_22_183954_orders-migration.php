<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->bigInteger('omie_id')->nullable();
            $table->text('shopify_id');
            $table->bigInteger('omie_client')->nullable();
            $table->boolean('recebido')->nullable();
            $table->boolean('pago')->nullable();
            $table->boolean('nf')->nullable();
            $table->boolean('rastreio')->nullable();
            $table->boolean('saiu')->nullable();
            $table->boolean('entregue')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('orders');
    }
};
