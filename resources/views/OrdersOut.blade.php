<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">
            {{ __('Pedidos Ausentes') }}
        </h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white overflow-hidden shadow-sm sm:rounded-lg">
                <div class="p-6 bg-white border-b border-gray-200">
                    <div class="max-w-md mx-auto">
                        <div class="mb-8">
                            <h3 class="text-lg font-semibold mb-4">Buscar Pedidos Ausentes</h3>
                            <form id="searchForm">
                                <div class="mb-4">
                                    <label for="id_inicial" class="block text-sm font-medium text-gray-700">ID Inicial</label>
                                    <input type="number" name="id_inicial" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" id="id_inicial">
                                </div>

                                <div class="mb-4">
                                    <label for="id_final" class="block text-sm font-medium text-gray-700">ID Final</label>
                                    <input type="number" name="id_final" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" id="id_final">
                                </div>

                                <button type="submit" class="inline-flex items-center px-4 py-2 bg-blue-600 border border-transparent rounded-md font-semibold text-xs text-white uppercase tracking-widest hover:bg-blue-700 active:bg-blue-800 focus:outline-none focus:border-blue-800 focus:ring focus:ring-blue-200 disabled:opacity-25 transition">
                                    Buscar Pedidos
                                </button>
                            </form>
                        </div>

                        <div id="resultado" class="mt-8" style="display: none;">
                            <h3 class="text-lg font-semibold mb-4">Resultados da Busca</h3>

                            <div class="bg-gray-50 p-4 rounded-lg mb-4">
                                <p class="text-sm text-gray-600">Total no intervalo: <span id="total_intervalo" class="font-medium"></span></p>
                                <p class="text-sm text-gray-600">Pedidos existentes: <span id="total_existentes" class="font-medium"></span></p>
                                <p class="text-sm text-gray-600">Pedidos ausentes: <span id="total_faltantes" class="font-medium"></span></p>
                            </div>

                            <div class="mb-4">
                                <h4 class="text-md font-medium mb-2">Lista de Pedidos Ausentes:</h4>
                                <div id="lista_ausentes" class="bg-gray-50 p-4 rounded-lg max-h-60 overflow-y-auto text-sm">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        document.getElementById('searchForm').addEventListener('submit', async function(e) {
            e.preventDefault();

            const idInicial = document.getElementById('id_inicial').value;
            const idFinal = document.getElementById('id_final').value;

            if (!idInicial || !idFinal) {
                alert('Por favor, preencha os IDs inicial e final');
                return;
            }

            try {
                const response = await fetch(`/buscar-intervalo?id_inicial=${idInicial}&id_final=${idFinal}`);
                const resultado = await response.json();

                document.getElementById('total_intervalo').textContent = resultado.total_intervalo;
                document.getElementById('total_existentes').textContent = resultado.total_existentes;
                document.getElementById('total_faltantes').textContent = resultado.total_faltantes;
                document.getElementById('lista_ausentes').textContent = resultado.pedidos_faltantes.join(', ');

                document.getElementById('resultado').style.display = 'block';
            } catch (error) {
                alert('Erro ao buscar pedidos: ' + error);
            }
        });
    </script>
</x-app-layout>
