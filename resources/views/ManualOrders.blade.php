<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">
            {{ __('Pedidos Manuais') }}
        </h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white overflow-hidden shadow-sm sm:rounded-lg">
                <div class="p-6 bg-white border-b border-gray-200">
                    <!-- Formulário de Adição de Pedido -->
                    <div class="mb-8">
                        <h3 class="text-lg font-semibold mb-4">Adicionar Novo Pedido</h3>
                        <form action="{{ route('manual-orders.store') }}" method="POST">
                            @csrf
                            <div class="mb-4">
                                <label for="shopify_id" class="block text-sm font-medium text-gray-700">ID do Shopify</label>
                                <input type="text" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" id="shopify_id" name="shopify_id" required>
                            </div>
                            <button type="submit" class="inline-flex items-center px-4 py-2 bg-blue-600 border border-transparent rounded-md font-semibold text-xs text-white uppercase tracking-widest hover:bg-blue-700 active:bg-blue-800 focus:outline-none focus:border-blue-800 focus:ring focus:ring-blue-200 disabled:opacity-25 transition">Adicionar Pedido</button>
                        </form>
                    </div>

                    <!-- Filtro -->
                    <div class="mb-8">
                        <h3 class="text-lg font-semibold mb-4">Filtrar Pedidos</h3>
                        <form action="{{ route('manual-orders.index') }}" method="GET">
                            <div class="mb-4">
                                <label for="filter" class="block text-sm font-medium text-gray-700">Filtrar por ID do Shopify</label>
                                <input type="text" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" id="filter" name="filter" value="{{ request('filter') }}">
                            </div>
                            <button type="submit" class="inline-flex items-center px-4 py-2 bg-gray-600 border border-transparent rounded-md font-semibold text-xs text-white uppercase tracking-widest hover:bg-gray-700 active:bg-gray-800 focus:outline-none focus:border-gray-800 focus:ring focus:ring-gray-200 disabled:opacity-25 transition">Filtrar</button>
                        </form>
                    </div>

                    <!-- Tabela de Pedidos -->
                    <div>
                        <h3 class="text-lg font-semibold mb-4">Lista de Pedidos Manuais</h3>
                        <div class="overflow-x-auto">
                            <table class="min-w-full divide-y divide-gray-200">
                                <thead class="bg-gray-50">
                                    <tr>
                                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID do Shopify</th>
                                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data de Criação</th>
                                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                                    </tr>
                                </thead>
                                <tbody class="bg-white divide-y divide-gray-200">
                                    @foreach($manualOrders as $order)
                                    <tr>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ $order->id }}</td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ $order->shopify_id }}</td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ $order->created_at->format('d/m/Y H:i:s') }}</td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <a href="{{ route('manual-orders.edit', $order->id) }}" class="text-indigo-600 hover:text-indigo-900 mr-2">Editar</a>
                                            <form action="{{ route('manual-orders.destroy', $order->id) }}" method="POST" class="inline-block">
                                                @csrf
                                                @method('DELETE')
                                                <button type="submit" class="text-red-600 hover:text-red-900" onclick="return confirm('Tem certeza que deseja excluir este pedido?')">Excluir</button>
                                            </form>
                                        </td>
                                    </tr>
                                    @endforeach
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Paginação -->
                    <div class="mt-4">
                        {{ $manualOrders->links() }}
                    </div>
                </div>
            </div>
        </div>
    </div>
</x-app-layout>
