<?php

use App\Http\Controllers\ProfileController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\HistoryLogController;
use App\Http\Controllers\ManualordersController;

Route::get('/', function () {
    return view('auth.login');
});

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/dashboard', [HistoryLogController::class, 'index'])->name('dashboard');

    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
    Route::get('/logs-filtrados', [HistoryLogController::class, 'logsFiltrados'])->name('logs.filtrados');

    // Rotas de Pedidos Manuais
    Route::get('/manual-orders', [ManualordersController::class, 'index'])->name('manual-orders.index');
    Route::post('/manual-orders', [ManualordersController::class, 'store'])->name('manual-orders.store');
    Route::get('/manual-orders/{id}/edit', [ManualordersController::class, 'edit'])->name('manual-orders.edit');
    Route::put('/manual-orders/{id}', [ManualordersController::class, 'update'])->name('manual-orders.update');
    Route::delete('/manual-orders/{id}', [ManualordersController::class, 'destroy'])->name('manual-orders.destroy');
});

Route::group(['prefix' => '/order'], function () {
    Route::post('/new', 'App\Http\Controllers\ShopifyController@newOrder');
    Route::post('/reintegrar', 'App\Http\Controllers\ShopifyController@reintegrateOrder');
    Route::post('/reintegrar-multiplos', 'App\Http\Controllers\ShopifyController@reintegrateMultipleOrders');
    Route::post('/nfe', 'App\Http\Controllers\OmieController@newNfe');
    Route::post('/tracking/update', 'App\Http\Controllers\EstocaController@filterTracking');
    Route::get('/reintegrate', function () {
        return view('reintegrate');
    })->name('reintegrate.order');
    Route::post('/delete', 'App\Http\Controllers\OmieController@excluirPedidos');
});

Route::get('/orders-out', function () {
    return view('OrdersOut');
})->name('orders.out');

Route::get('/buscar-intervalo', [HistoryLogController::class, 'buscarIntervalo'])->name('buscar.intervalo');
Route::get('/api/history-logs', [HistoryLogController::class, 'getLogs'])->middleware('auth');
Route::post('/api/logs/filtrar', [HistoryLogController::class, 'filtrarLogs'])->name('logs.filtrar');

// Rotas para monitoramento de fila
Route::middleware(['auth'])->group(function () {
    Route::get('/queue', [App\Http\Controllers\QueueController::class, 'index'])->name('queue.index');
    Route::get('/queue/data', [App\Http\Controllers\QueueController::class, 'getQueueData'])->name('queue.data');
    Route::post('/queue/clear-failed', [App\Http\Controllers\QueueController::class, 'clearFailedJobs'])->name('queue.clear-failed');
    Route::post('/queue/retry/{id}', [App\Http\Controllers\QueueController::class, 'retryFailedJob'])->name('queue.retry');
});

require __DIR__.'/auth.php';
