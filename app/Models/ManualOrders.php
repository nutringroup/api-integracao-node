<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ManualOrders extends Model
{
    use HasFactory;

    protected $fillable = ['shopify_id'];
}
