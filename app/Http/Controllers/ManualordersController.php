<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\ManualOrders;
use App\Jobs\CreateOrderJob;
use App\Jobs\ApproveOrderJob;

class ManualordersController extends Controller
{
    public function index(Request $request)
    {
        $query = ManualOrders::query();

        if ($request->has('filter')) {
            $query->where('shopify_id', 'like', '%' . $request->filter . '%');
        }

        $manualOrders = $query->orderBy('created_at', 'desc')->paginate(10);

        return view('ManualOrders', compact('manualOrders'));
    }

    public function store(Request $request)
    {
        $request->validate([
            'shopify_id' => 'required|unique:manual_orders,shopify_id',
        ]);

        $manualOrder = ManualOrders::create($request->all());

        CreateOrderJob::dispatch($manualOrder->shopify_id, $manualOrder->toArray());

        return redirect()->route('manual-orders.index')->with('success', 'Pedido adicionado com sucesso.');
    }

    public function edit($id)
    {
        $order = ManualOrders::findOrFail($id);
        return view('EditManualOrder', compact('order'));
    }

    public function update(Request $request, $id)
    {
        $order = ManualOrders::findOrFail($id);

        $request->validate([
            'shopify_id' => 'required|unique:manual_orders,shopify_id,' . $id,
        ]);

        $order->update($request->all());

        ApproveOrderJob::dispatch($order->shopify_id, $order->fresh()->toArray());

        return redirect()->route('manual-orders.index')->with('success', 'Pedido atualizado com sucesso.');
    }

    public function destroy($id)
    {
        $order = ManualOrders::findOrFail($id);
        $order->delete();

        return redirect()->route('manual-orders.index')->with('success', 'Pedido excluído com sucesso.');
    }
}
