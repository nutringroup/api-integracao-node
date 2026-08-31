<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">
            {{ __('Histórico de Logs') }}
        </h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white overflow-hidden shadow-sm sm:rounded-lg">
                <div id="app" v-cloak class="container mx-auto px-4 py-8">
                    <div class="relative">
                        <input
                            type="text"
                            v-model="shopifyIdFilter"
                            @input="fetchLogs"
                            placeholder="Filtrar por Shopify ID"
                            class="w-full p-2 pr-10 mb-4 border rounded shadow-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                        >
                        <svg v-if="loading" class="animate-spin h-5 w-5 text-pink-500 absolute right-3 top-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    </div>

                    <div v-if="loading" class="flex justify-center items-center my-4">
                        <svg class="animate-spin h-8 w-8 text-pink-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    </div>

                    <p v-else-if="error" class="text-center text-red-600">Erro ao carregar os logs: @{{ error }}</p>
                    <div v-else-if="sortedGroupedLogs.length > 0" class="space-y-8">
                        <div v-for="group in sortedGroupedLogs" :key="group.shopify_id" class="bg-white shadow-md rounded-lg overflow-hidden">
                            <div class="bg-gray-100 px-6 py-4">
                                <h3 class="text-lg font-semibold">Shopify ID: @{{ group.shopify_id }}</h3>
                            </div>
                            <div class="px-6 py-4">
                                <table class="min-w-full divide-y divide-gray-200">
                                    <thead class="bg-gray-50">
                                        <tr>
                                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Etapa da Integração</th>
                                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Log</th>
                                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data de Criação</th>
                                        </tr>
                                    </thead>
                                    <tbody class="bg-white divide-y divide-gray-200">
                                        <tr v-for="log in group.logs" :key="log.id" class="hover:bg-gray-50">
                                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">@{{ log.step_description }}</td>
                                            <td class="px-6 py-4 text-sm text-gray-500">
                                                <div class="max-w-xs overflow-hidden">
                                                    <pre v-if="log.expanded" class="whitespace-pre-wrap break-words">@{{ formatJSON(log.log) }}</pre>
                                                    <p v-else>@{{ truncateText(log.log) }}</p>
                                                    <button @click="toggleExpand(log)" class="text-pink-500 hover:text-pink-700 mt-2">
                                                        @{{ log.expanded ? 'Recolher' : 'Expandir' }}
                                                    </button>
                                                </div>
                                            </td>
                                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">@{{ formatDate(log.created_at) }}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    <p v-else class="text-center text-gray-600">Nenhum log encontrado.</p>
                    <div v-if="newDataLoaded" class="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-4" role="alert">
                        <p class="font-bold">Novos dados carregados</p>
                        <p>A tabela foi atualizada com as informações mais recentes.</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        document.addEventListener('DOMContentLoaded', function() {
            const { createApp, ref, computed, onMounted, onUnmounted } = Vue;

            const app = createApp({
                setup() {
                    const logs = ref([]);
                    const shopifyIdFilter = ref('');
                    const loading = ref(false);
                    const error = ref(null);
                    let intervalId = null;
                    const newDataLoaded = ref(false);

                    const groupedLogs = computed(() => {
                        const groups = {};
                        logs.value.forEach(log => {
                            if (!groups[log.shopify_id]) {
                                groups[log.shopify_id] = { shopify_id: log.shopify_id, logs: [] };
                            }
                            groups[log.shopify_id].logs.push(log);
                        });
                        return Object.values(groups);
                    });

                    const sortedGroupedLogs = computed(() => {
                        return groupedLogs.value.sort((a, b) => b.shopify_id - a.shopify_id);
                    });

                    const fetchLogs = async () => {
                        if (loading.value) return;
                        loading.value = true;
                        error.value = null;
                        try {
                            console.log('Iniciando busca de logs...');
                            const response = await fetch('/api/history-logs?shopify_id=' + shopifyIdFilter.value);
                            if (!response.ok) {
                                throw new Error(`HTTP error! status: ${response.status}`);
                            }
                            const newData = await response.json();
                            console.log('Resposta da API:', newData);

                            if (hasNewOrUpdatedData(logs.value, newData)) {
                                logs.value = newData;
                                newDataLoaded.value = true;
                                setTimeout(() => {
                                    newDataLoaded.value = false;
                                }, 3000);
                                console.log('Dados atualizados no front-end');
                            } else {
                                console.log('Nenhuma atualização necessária');
                            }
                        } catch (err) {
                            console.error('Erro ao buscar logs:', err);
                            error.value = err.message;
                        } finally {
                            loading.value = false;
                        }
                    };

                    const hasNewOrUpdatedData = (currentLogs, newLogs) => {
                        if (currentLogs.length !== newLogs.length) return true;

                        for (let i = 0; i < newLogs.length; i++) {
                            const currentLog = currentLogs[i];
                            const newLog = newLogs[i];

                            if (!currentLog ||
                                currentLog.id !== newLog.id ||
                                currentLog.shopify_id !== newLog.shopify_id ||
                                currentLog.step_description !== newLog.step_description ||
                                currentLog.log !== newLog.log ||
                                currentLog.created_at !== newLog.created_at) {
                                return true;
                            }
                        }

                        return false;
                    };

                    const startAutoRefresh = () => {
                        intervalId = setInterval(fetchLogs, 30000);
                    };

                    const stopAutoRefresh = () => {
                        if (intervalId) {
                            clearInterval(intervalId);
                            intervalId = null;
                        }
                    };

                    const truncateText = (text, length = 50) => {
                        return text.length > length ? text.substring(0, length) + '...' : text;
                    };

                    const formatJSON = (jsonString) => {
                        try {
                            const obj = JSON.parse(jsonString);
                            return JSON.stringify(obj, null, 2);
                        } catch (e) {
                            return jsonString;
                        }
                    };

                    const toggleExpand = (log) => {
                        log.expanded = !log.expanded;
                    };

                    const formatDate = (dateString) => {
                        return new Date(dateString).toLocaleString('pt-BR');
                    };

                    onMounted(() => {
                        console.log('Componente montado');
                        fetchLogs();
                        startAutoRefresh();
                    });

                    onUnmounted(() => {
                        stopAutoRefresh();
                    });

                    return {
                        logs,
                        sortedGroupedLogs,
                        shopifyIdFilter,
                        fetchLogs,
                        loading,
                        error,
                        truncateText,
                        formatJSON,
                        toggleExpand,
                        formatDate,
                        newDataLoaded
                    };
                }
            });

            app.mount('#app');
        });
    </script>
</x-app-layout>

<style>
    [v-cloak] { display: none; }
</style>
