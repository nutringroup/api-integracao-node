<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">
            {{ __('Reintegrar Pedido Shopify') }}
        </h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white overflow-hidden shadow-sm sm:rounded-lg">
                <div id="app" v-cloak class="p-6 bg-white border-b border-gray-200">
                    <form @submit.prevent="reintegrateOrder" class="space-y-6">
                        <div>
                            <label for="shopify_id" class="block text-sm font-medium text-gray-700">ID do Pedido Shopify:</label>
                            <input type="text" id="shopify_id" v-model="shopifyId" required
                                class="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500">
                        </div>
                        <div>
                            <button type="submit"
                                class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-pink-600 hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500"
                                :disabled="loading">
                                <svg v-if="loading" class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Reintegrar Pedido
                            </button>
                        </div>
                    </form>

                    <!-- Modal para exibir o histórico de logs -->
                    <div v-if="showModal" class="fixed z-10 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                        <div class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:p-0">
                            <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
                            <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                            <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:w-full sm:max-w-2xl">
                                <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <h3 class="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                                        Histórico de Logs para Shopify ID: @{{ shopifyId }}
                                    </h3>
                                    <div class="mt-2 max-h-[70vh] overflow-y-auto">
                                        <div v-if="loading" class="flex justify-center items-center py-4">
                                            <svg class="animate-spin h-8 w-8 text-pink-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                        </div>
                                        <div v-else-if="logs.length === 0" class="text-center text-gray-500 py-4">
                                            Nenhum log encontrado para este Shopify ID.
                                        </div>
                                        <div v-else class="space-y-2">
                                            <div v-for="log in logs" :key="log.id"
                                                 :class="{'bg-pink-100 transition-colors duration-1000': newLogIds.has(log.id)}"
                                                 class="p-2 border-b border-gray-200 last:border-b-0">
                                                <p class="font-semibold">@{{ log.step_description }}</p>
                                                <p class="text-sm text-gray-600">@{{ log.created_at }}</p>
                                                <pre v-if="log.request_body" class="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto">@{{ formatJSON(log.request_body) }}</pre>
                                                <pre v-if="log.response_body" class="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto">@{{ formatJSON(log.response_body) }}</pre>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                    <button type="button" @click="closeModal"
                                        class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-pink-600 text-base font-medium text-white hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 sm:ml-3 sm:w-auto sm:text-sm">
                                        Fechar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        document.addEventListener('DOMContentLoaded', function() {
            const { createApp, ref, onUnmounted } = Vue;

            const app = createApp({
                setup() {
                    const shopifyId = ref('');
                    const loading = ref(false);
                    const showModal = ref(false);
                    const logs = ref([]);
                    const error = ref(null);
                    const newLogIds = ref(new Set());
                    let intervalId = null;

                    const reintegrateOrder = async () => {
                        loading.value = true;
                        try {
                            const response = await fetch('/order/reintegrar', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'X-CSRF-TOKEN': '{{ csrf_token() }}'
                                },
                                body: JSON.stringify({
                                    shopify_id: shopifyId.value
                                })
                            });

                            if (!response.ok) {
                                throw new Error('Falha ao reintegrar o pedido');
                            }

                            const data = await response.json();
                            logs.value = Array.isArray(data.newOrderResponse) ? data.newOrderResponse : [data.newOrderResponse];
                            showModal.value = true;
                            startAutoRefresh();
                        } catch (error) {
                            alert(`Erro ao processar sua solicitação: ${error.message}`);
                        } finally {
                            loading.value = false;
                        }
                    };

                    const fetchLogs = async () => {
                        if (loading.value) return;
                        error.value = null;
                        try {
                            const response = await fetch(`/api/history-logs?shopify_id=${shopifyId.value}`);
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
                        const oldLogIds = new Set(logs.value.map(log => log.id));

                        // Ordena os logs por data de criação (mais recente primeiro)
                        const sortedNewData = newData.sort((a, b) => new Date(b.id) - new Date(a.id));

                        // Atualiza os logs, mantendo todos os logs únicos
                        const uniqueLogs = Array.from(new Map([...logs.value, ...sortedNewData].map(log => [log.id, log])).values());
                        logs.value = uniqueLogs.sort((a, b) => new Date(b.id) - new Date(a.id));

                        // Identifica os novos logs
                        newLogIds.value = new Set(logs.value.filter(log => !oldLogIds.has(log.id)).map(log => log.id));

                        // Remove o destaque após 3 segundos
                        setTimeout(() => {
                            newLogIds.value.clear();
                        }, 3000);
                    };

                    const startAutoRefresh = () => {
                        intervalId = setInterval(fetchLogs, 5000); // Atualizado para 5000 ms (5 segundos)
                    };

                    const stopAutoRefresh = () => {
                        if (intervalId) {
                            clearInterval(intervalId);
                            intervalId = null;
                        }
                    };

                    const closeModal = () => {
                        showModal.value = false;
                        stopAutoRefresh();
                        logs.value = []; // Limpar os logs ao fechar o modal
                        shopifyId.value = ''; // Resetar o campo após fechar o modal
                    };

                    const formatJSON = (jsonString) => {
                        try {
                            const obj = JSON.parse(jsonString);
                            return JSON.stringify(obj, null, 2);
                        } catch (e) {
                            return jsonString;
                        }
                    };

                    onUnmounted(() => {
                        stopAutoRefresh();
                    });

                    return {
                        shopifyId,
                        loading,
                        showModal,
                        logs,
                        error,
                        reintegrateOrder,
                        closeModal,
                        formatJSON,
                        newLogIds
                    };
                }
            });

            app.mount('#app');
        });
    </script>

    <style>
        [v-cloak] { display: none; }
        .transition-colors {
            transition-property: background-color;
            transition-timing-function: ease-out;
        }
    </style>
</x-app-layout>
