<x-app-layout>
    <x-slot name="header">
        <h2 class="text-xl font-semibold text-gray-800">
            {{ __('Logs Filtrados') }}
        </h2>
    </x-slot>

    <style>
        /* Mantendo os mesmos estilos... */
        .scroll-to-top {
            position: fixed;
            bottom: 20px;
            left: 20px;
            background-color: #333;
            color: #fff;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            opacity: 0;
            transition: opacity 0.3s ease-in-out;
        }

        .scroll-to-top.visible {
            opacity: 1;
        }

        .scroll-to-top:hover {
            background-color: #555;
        }

        .sidebar {
            position: fixed;
            top: 0;
            right: 0;
            width: 400px;
            height: 100vh;
            background-color: #f3f4f6;
            overflow-y: auto;
            transition: transform 0.3s ease-in-out;
            transform: translateX(100%);
            z-index: 1000;
        }

        .sidebar.open {
            transform: translateX(0);
        }

        .main-content {
            transition: margin-right 0.3s ease-in-out;
        }

        .main-content.sidebar-open {
            margin-right: 400px;
        }

        /* Estilos para grupos de erro */
        .group-card {
            transition: all 0.3s ease;
            border-left: 4px solid #ef4444;
        }

        .group-card:hover {
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }

        .group-header {
            transition: background-color 0.2s ease;
        }

        .group-header:hover {
            background-color: #f9fafb;
        }

        .rotate-180 {
            transform: rotate(180deg);
        }

        .transition-transform {
            transition: transform 0.3s ease;
        }

        /* Badge para contadores */
        .badge-error {
            background-color: #fee2e2;
            color: #991b1b;
        }

        .badge-count {
            background-color: #f3f4f6;
            color: #374151;
        }
    </style>

    <div class="scroll-to-top" id="scrollToTop" onclick="scrollToTop()">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 15l-6-6-6 6"/>
        </svg>
    </div>

    <script>
        function scrollToTop() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }

        window.addEventListener('scroll', function() {
            var scrollToTopButton = document.getElementById('scrollToTop');
            if (window.pageYOffset > 300) {
                scrollToTopButton.classList.add('visible');
            } else {
                scrollToTopButton.classList.remove('visible');
            }
        });
    </script>

    <div id="app">
        <div class="py-6 bg-white main-content" :class="{ 'sidebar-open': showSidebar }">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="bg-gray-100 shadow rounded-lg">
                    <div class="p-6">
                        <!-- Filtros -->
                        <div class="mb-6 bg-white p-4 rounded-lg shadow">
                            <form @submit.prevent="aplicarFiltros" class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700">Data Inicial</label>
                                    <input type="date" v-model="filtros.dataInicial" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700">Data Final</label>
                                    <input type="date" v-model="filtros.dataFinal" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700">Mensagem de Erro</label>
                                    <input type="text" v-model="filtros.mensagemErro" placeholder="Digite o início da mensagem de erro" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                                </div>
                                <div class="md:col-span-3 flex justify-end">
                                    <button type="submit" class="bg-black hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">
                                        Aplicar Filtros
                                    </button>
                                </div>
                            </form>
                        </div>

                        @if(isset($logs) && $logs->count() > 0)
                            <div class="mb-6 text-center">
                                <span class="text-2xl font-bold text-gray-800">Total de Pedidos com Erro: {{ $logs->count() }}</span>
                            </div>

                            <!-- Toggle para alternar entre visualizações -->
                            <div class="mb-6 flex justify-center">
                                <div class="inline-flex rounded-md shadow-sm" role="group">
                                    <button type="button" @click="viewMode = 'individual'" :class="viewMode === 'individual' ? 'bg-black text-white' : 'bg-white text-gray-700 hover:bg-gray-50'" class="px-4 py-2 text-sm font-medium border border-gray-200 rounded-l-lg focus:z-10 focus:ring-2 focus:ring-gray-500">
                                        Visualização Individual
                                    </button>
                                    <button type="button" @click="viewMode = 'grouped'" :class="viewMode === 'grouped' ? 'bg-black text-white' : 'bg-white text-gray-700 hover:bg-gray-50'" class="px-4 py-2 text-sm font-medium border-t border-b border-r border-gray-200 rounded-r-lg focus:z-10 focus:ring-2 focus:ring-gray-500">
                                        Agrupado por Erro
                                    </button>
                                </div>
                            </div>

                            <div class="mb-8 h-64 pt-4">
                                <div id="pedidosPorDia" class="w-full h-full rounded-lg"></div>
                            </div>

                            <div class="space-y-6">
                                <!-- Visualização Agrupada -->
                                <div v-show="viewMode === 'grouped'" class="space-y-4">
                                    @if(isset($logsAgrupados) && count($logsAgrupados) > 0)
                                        @foreach($logsAgrupados as $chaveGrupo => $grupo)
                                                                                         <div class="bg-white border border-gray-200 rounded-lg shadow-sm group-card">
                                                <div class="px-6 py-4 border-b border-gray-200 cursor-pointer group-header" @click="toggleGroup('{{ $chaveGrupo }}')">
                                                    <div class="flex justify-between items-center">
                                                        <div class="flex-1">
                                                            <div class="flex items-center space-x-4">
                                                                                                                                 <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium badge-error">
                                                                    Etapa {{ $grupo['step'] }}
                                                                </span>
                                                                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium badge-count">
                                                                    {{ $grupo['total_pedidos'] }} pedido(s)
                                                                </span>
                                                            </div>
                                                            <h3 class="text-lg font-medium text-gray-900 mt-2">{{ $grupo['step_description'] }}</h3>
                                                            <p class="text-sm text-gray-600 mt-1">{{ \Str::limit($grupo['erro_representativo'], 120) }}</p>
                                                            <div class="flex space-x-4 text-xs text-gray-500 mt-2">
                                                                <span>Primeira: {{ \Carbon\Carbon::parse($grupo['primeira_ocorrencia'])->format('d/m/Y H:i') }}</span>
                                                                <span>Última: {{ \Carbon\Carbon::parse($grupo['ultima_ocorrencia'])->format('d/m/Y H:i') }}</span>
                                                            </div>
                                                        </div>
                                                        <div class="flex items-center space-x-2">
                                                            <button type="button" class="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded text-sm" @click.stop="reintegrarGrupo('{{ $chaveGrupo }}')">
                                                                Reintegrar Grupo
                                                            </button>
                                                            <svg :class="expandedGroups.includes('{{ $chaveGrupo }}') ? 'rotate-180' : ''" class="w-5 h-5 text-gray-400 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                                                            </svg>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <div v-show="expandedGroups.includes('{{ $chaveGrupo }}')" class="px-6 py-4">
                                                    <div class="mb-4 p-3 bg-gray-50 rounded-lg">
                                                        <h4 class="font-semibold text-sm text-gray-700 mb-2">Mensagem de Erro Completa:</h4>
                                                        <pre class="text-xs text-gray-600 whitespace-pre-wrap">{{ $grupo['erro_representativo'] }}</pre>
                                                    </div>
                                                    
                                                    <div class="overflow-x-auto">
                                                        <table class="min-w-full divide-y divide-gray-300">
                                                            <thead class="bg-gray-50">
                                                                <tr>
                                                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Selecionar</th>
                                                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Shopify ID</th>
                                                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Data do Pedido</th>
                                                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Data do Log</th>
                                                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Ações</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody class="bg-white divide-y divide-gray-200">
                                                                @foreach($grupo['pedidos'] as $pedido)
                                                                    <tr>
                                                                        <td class="px-4 py-2 whitespace-nowrap">
                                                                            <input type="checkbox" v-model="selectedOrders" value="{{ $pedido['shopify_id'] }}" class="form-checkbox h-4 w-4 text-blue-600">
                                                                        </td>
                                                                        <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{{ $pedido['shopify_id'] }}</td>
                                                                        <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-800">
                                                                            {{ $pedido['pedido_created_at'] ? \Carbon\Carbon::parse($pedido['pedido_created_at'])->format('d/m/Y H:i') : 'N/A' }}
                                                                        </td>
                                                                        <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{{ \Carbon\Carbon::parse($pedido['created_at'])->format('d/m/Y H:i') }}</td>
                                                                        <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-800">
                                                                            <div class="flex space-x-1">
                                                                                <button type="button" class="bg-black hover:bg-blue-700 text-white font-bold py-1 px-3 rounded text-xs" @click="visualizarPedido('{{ $pedido['shopify_id'] }}')">
                                                                                    Ver
                                                                                </button>
                                                                                <button type="button" class="bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-3 rounded text-xs" @click="reintegrarPedido('{{ $pedido['shopify_id'] }}')">
                                                                                    Reintegrar
                                                                                </button>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                @endforeach
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            </div>
                                        @endforeach
                                    @else
                                        <p class="text-center text-gray-600">Nenhum grupo de erro encontrado.</p>
                                    @endif
                                </div>

                                <!-- Visualização Individual -->
                                <div v-show="viewMode === 'individual'" class="overflow-x-auto">
                                    <form @submit.prevent="reintegrarMultiplos">
                                        <button type="submit" class="mb-4 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">
                                            Reintegrar Selecionados
                                        </button>
                                        <table class="min-w-full divide-y divide-gray-300">
                                            <thead class="bg-gray-100">
                                                <tr>
                                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Selecionar</th>
                                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Shopify ID</th>
                                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Data de Criação do Pedido</th>
                                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Data do Último Log</th>
                                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Ações</th>
                                                </tr>
                                            </thead>
                                            <tbody class="bg-white divide-y divide-gray-200">
                                                @foreach($logs->sortBy('pedido_created_at') as $log)
                                                    <tr>
                                                        <td class="px-6 py-4 whitespace-nowrap">
                                                            <input type="checkbox" v-model="selectedOrders" :value="'{{ $log->shopify_id }}'" class="form-checkbox h-5 w-5 text-blue-600">
                                                        </td>
                                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{{ $log->shopify_id }}</td>
                                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{{ \Carbon\Carbon::parse($log->pedido_created_at)->format('d/m/Y H:i:s') }}</td>
                                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{{ \Carbon\Carbon::parse($log->latest_created_at)->format('d/m/Y H:i:s') }}</td>
                                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                                                            <div class="flex space-x-2">
                                                                <button type="button" class="bg-black hover:bg-blue-700 text-white font-bold py-2 px-4 rounded" @click="visualizarPedido('{{ $log->shopify_id }}')">
                                                                    Visualizar
                                                                </button>
                                                                <button type="button" class="btn-reintegrar bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded flex items-center" @click="reintegrarPedido('{{ $log->shopify_id }}')">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                                                        <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" />
                                                                    </svg>
                                                                    Reintegrar
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                @endforeach
                                            </tbody>
                                        </table>
                                    </form>
                                </div>
                            </div>
                        @else
                            <p class="text-center text-gray-600">Nenhum log encontrado.</p>
                        @endif
                    </div>
                </div>
            </div>
        </div>

        <!-- Sidebar para exibir os logs -->
        <div class="sidebar" :class="{ 'open': showSidebar }">
            <div class="p-6">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-medium text-gray-900">Logs do Pedido @{{ currentShopifyId }}</h3>
                    <button @click="showSidebar = false" class="text-gray-500 hover:text-gray-700">
                        <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div v-if="loading" class="text-center">
                    <p>Carregando...</p>
                </div>
                <div v-else-if="error" class="text-red-600">
                    @{{ error }}
                </div>
                <div v-else>
                    <div v-for="log in logs" :key="log.id" class="mb-6 bg-white shadow rounded-lg p-4">
                        <p class="font-semibold">Etapa: @{{ log.step_description }}</p>
                        <p class="mt-2"><strong>Log:</strong></p>
                        <div class="mt-1 bg-gray-100 p-2 rounded max-h-40 overflow-y-auto">
                            <pre class="whitespace-pre-wrap text-sm">@{{ truncateJSON(log.log, 500) }}</pre>
                        </div>
                        <p class="mt-2 text-sm text-gray-600">Data: @{{ formatDate(log.created_at) }}</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/echarts@5.4.2/dist/echarts.min.js"></script>
    <script>
        document.addEventListener('DOMContentLoaded', (event) => {
            const { createApp, ref } = Vue;

            const app = createApp({
                setup() {
                    const logs = ref([]);
                    const loading = ref(false);
                    const error = ref(null);
                    const showSidebar = ref(false);
                    const currentShopifyId = ref('');
                    const selectedOrders = ref([]);
                    const errosRepetidos = ref([]);
                    const viewMode = ref('individual'); // 'individual' ou 'grouped'
                    const expandedGroups = ref([]);
                    const grupos = ref(@json($logsAgrupados ?? []));
                    const filtros = ref({
                        dataInicial: '',
                        dataFinal: '',
                        mensagemErro: ''
                    });
                    let intervalId = null;


                    const aplicarFiltros = async () => {
                        try {
                            loading.value = true;
                            const response = await fetch('/api/logs/filtrar', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'X-CSRF-TOKEN': '{{ csrf_token() }}'
                                },
                                body: JSON.stringify(filtros.value)
                            });

                            if (!response.ok) {
                                throw new Error('Erro ao aplicar filtros');
                            }

                            const data = await response.json();
                            
                            // Atualizar os grupos com os novos dados filtrados
                            if (data.logsAgrupados) {
                                grupos.value = data.logsAgrupados;
                            }
                            
                            window.location.reload();
                        } catch (err) {
                            console.error('Erro:', err);
                            error.value = 'Erro ao aplicar filtros';
                        } finally {
                            loading.value = false;
                        }
                    };

                    const visualizarPedido = async (shopifyId) => {
                        loading.value = true;
                        error.value = null;
                        currentShopifyId.value = shopifyId;
                        showSidebar.value = true;
                        try {
                            const response = await fetch(`/api/history-logs?shopify_id=${shopifyId}`);
                            if (!response.ok) {
                                throw new Error('Falha na resposta do servidor');
                            }
                            const logsData = await response.json();
                            logs.value = logsData;

                        } catch (err) {
                            console.error('Erro ao buscar logs:', err);
                            error.value = err.message;
                        } finally {
                            loading.value = false;
                        }
                    };

                    const formatDate = (dateString) => {
                        return new Date(dateString).toLocaleString('pt-BR');
                    };

                    const truncateJSON = (jsonString, maxLength) => {
                        try {
                            const obj = JSON.parse(jsonString);
                            const formatted = JSON.stringify(obj, null, 2);
                            if (formatted.length <= maxLength) {
                                return formatted;
                            }
                            return formatted.substring(0, maxLength) + '...';
                        } catch (e) {
                            return jsonString.length > maxLength ? jsonString.substring(0, maxLength) + '...' : jsonString;
                        }
                    };

                    const reintegrarPedido = async (shopifyId) => {
                        if (confirm('Tem certeza que deseja reintegrar este pedido?')) {
                            loading.value = true;
                            error.value = null;
                            currentShopifyId.value = shopifyId;
                            showSidebar.value = true;
                            try {
                                const response = await fetch('/order/reintegrar', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'X-CSRF-TOKEN': '{{ csrf_token() }}'
                                    },
                                    body: JSON.stringify({ shopify_id: shopifyId })
                                });

                                if (!response.ok) {
                                    throw new Error('Falha na resposta do servidor');
                                }

                                const data = await response.json();
                                logs.value = Array.isArray(data.newOrderResponse) ? data.newOrderResponse : [data.newOrderResponse];

                                startAutoRefresh();
                            } catch (error) {
                                console.error('Erro ao reintegrar pedido:', error);
                                error.value = 'Ocorreu um erro ao reintegrar o pedido. Por favor, tente novamente.';
                            } finally {
                                loading.value = false;
                            }
                        }
                    };

                    const startAutoRefresh = () => {
                        intervalId = setInterval(fetchLogs, 5000);
                    };

                    const stopAutoRefresh = () => {
                        if (intervalId) {
                            clearInterval(intervalId);
                            intervalId = null;
                        }
                    };

                    const fetchLogs = async () => {
                        if (loading.value) return;
                        error.value = null;
                        try {
                            const response = await fetch(`/api/history-logs?shopify_id=${currentShopifyId.value}`);
                            if (!response.ok) {
                                throw new Error(`HTTP error! status: ${response.status}`);
                            }
                            const newData = await response.json();
                            updateLogs(newData);
                        } catch (err) {
                            console.error('Erro ao buscar logs:', err);
                            error.value = err.message;
                        }
                    };

                    const updateLogs = (newData) => {
                        logs.value = newData;
                    };

                    const reintegrarMultiplos = async () => {
                        if (selectedOrders.value.length === 0) {
                            alert('Por favor, selecione pelo menos um pedido para reintegrar.');
                            return;
                        }

                        if (confirm(`Tem certeza que deseja reintegrar ${selectedOrders.value.length} pedido(s)?`)) {
                            try {
                                const response = await fetch('/order/reintegrar-multiplos', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'X-CSRF-TOKEN': '{{ csrf_token() }}'
                                    },
                                    body: JSON.stringify({ pedidos: selectedOrders.value })
                                });

                                if (!response.ok) {
                                    throw new Error('Falha na resposta do servidor');
                                }

                                alert('Pedidos reintegrados com sucesso!');
                                location.reload();
                            } catch (error) {
                                console.error('Erro ao reintegrar pedidos:', error);
                                alert('Ocorreu um erro ao reintegrar os pedidos. Por favor, tente novamente.');
                            }
                        }
                    };

                    const toggleGroup = (chaveGrupo) => {
                        const index = expandedGroups.value.indexOf(chaveGrupo);
                        if (index > -1) {
                            expandedGroups.value.splice(index, 1);
                        } else {
                            expandedGroups.value.push(chaveGrupo);
                        }
                    };

                    const reintegrarGrupo = async (chaveGrupo) => {
                        const grupo = grupos.value[chaveGrupo];
                        if (!grupo || !grupo.pedidos) {
                            alert('Grupo não encontrado.');
                            return;
                        }

                        const pedidosDoGrupo = grupo.pedidos.map(p => p.shopify_id);
                        
                        if (confirm(`Tem certeza que deseja reintegrar todos os ${pedidosDoGrupo.length} pedidos deste grupo?`)) {
                            try {
                                const response = await fetch('/order/reintegrar-multiplos', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'X-CSRF-TOKEN': '{{ csrf_token() }}'
                                    },
                                    body: JSON.stringify({ pedidos: pedidosDoGrupo })
                                });

                                if (!response.ok) {
                                    throw new Error('Falha na resposta do servidor');
                                }

                                alert(`Grupo de ${pedidosDoGrupo.length} pedidos reintegrado com sucesso!`);
                                location.reload();
                            } catch (error) {
                                console.error('Erro ao reintegrar grupo:', error);
                                alert('Ocorreu um erro ao reintegrar o grupo. Por favor, tente novamente.');
                            }
                        }
                    };

                    return {
                        logs,
                        loading,
                        error,
                        showSidebar,
                        currentShopifyId,
                        selectedOrders,
                        filtros,
                        errosRepetidos,
                        viewMode,
                        expandedGroups,
                        grupos,
                        visualizarPedido,
                        formatDate,
                        truncateJSON,
                        reintegrarPedido,
                        reintegrarMultiplos,
                        aplicarFiltros,
                        toggleGroup,
                        reintegrarGrupo
                    };
                }
            });

            app.mount('#app');

            const chart = echarts.init(document.getElementById('pedidosPorDia'));
            const pedidosPorDia = {!! json_encode($logs->groupBy(function($log) {
                return \Carbon\Carbon::parse($log->pedido_created_at)->format('Y-m-d');
            })->map->count() ?? []) !!};

            const option = {
                title: {
                    text: 'Pedidos com erro por data',
                    left: 'center',
                    textStyle: { color: '#333', fontSize: 20 }
                },
                tooltip: {
                    trigger: 'axis',
                    axisPointer: { type: 'shadow' }
                },
                xAxis: {
                    type: 'category',
                    data: Object.keys(pedidosPorDia).sort(),
                    axisLabel: { rotate: 45, fontSize: 10, color: '#333' }
                },
                yAxis: {
                    type: 'value',
                    minInterval: 1,
                    axisLabel: { color: '#333' }
                },
                series: [{
                    name: 'Quantidade de Pedidos',
                    type: 'bar',
                    data: Object.keys(pedidosPorDia).sort().map(key => pedidosPorDia[key]),
                    itemStyle: { color: 'rgba(0, 0, 0, 0.8)' }
                }],
                backgroundColor: 'rgba(255, 255, 255, 0.8)'
            };
            chart.setOption(option);

            window.addEventListener('resize', function() {
                chart.resize();
            });
        });
    </script>
</x-app-layout>
