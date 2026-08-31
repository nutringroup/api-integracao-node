<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Historylog extends Model
{
    use HasFactory;

    protected $fillable = [
        'step',
        'shopify_id',
        'log'
    ];

    protected $table = 'historylog';

    // Definindo o relacionamento com o model Steps
    public function stepDescription()
    {
        return $this->belongsTo(steps::class, 'step', 'step');  // 'step' é a coluna em Historylog, 'id' é a chave primária em Steps
    }
}
