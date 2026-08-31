<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Orders extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'shopify_id',
        'omie_id',
        'omie_client',
        'recebido',
        'pago',
        'nf',
        'rastreio',
        'saiu',
        'entregue',
    ];

    /**
     * The attributes that should be cast to native types.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'shopify_log' => 'array',
        'recebido' => 'boolean',
        'pago' => 'boolean',
        'nf' => 'boolean',
        'rastreio' => 'boolean',
        'saiu' => 'boolean',
        'entregue' => 'boolean',
    ];

    protected $table = 'orders';
}
