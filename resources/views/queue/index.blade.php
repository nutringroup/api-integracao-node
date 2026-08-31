<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">
            {{ __('Monitoramento de Filas') }}
        </h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8">
            <!-- Estatísticas da Fila -->
            <div class="bg-white overflow-hidden shadow-sm sm:rounded-lg mb-6">
                <div class="p-6 text-gray-900">
                    <h3 class="text-lg font-semibold mb-4">Estatísticas da Fila</h3>
                    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div class="bg-blue-100 p-4 rounded-lg">
                            <div class="text-blue-800 text-sm font-medium">Pendentes</div>
                            <div class="text-2xl font-bold text-blue-900" id="pending-count">0</div>
                        </div>
                        <div class="bg-yellow-100 p-4 rounded-lg">
                            <div class="text-yellow-800 text-sm font-medium">Em Processamento</div>
                            <div class="text-2xl font-bold text-yellow-900" id="reserved-count">0</div>
                        </div>
                        <div class="bg-purple-100 p-4 rounded-lg">
                            <div class="text-purple-800 text-sm font-medium">Agendados</div>
                            <div class="text-2xl font-bold text-purple-900" id="delayed-count">0</div>
                        </div>
                        <div class="bg-red-100 p-4 rounded-lg">
                            <div class="text-red-800 text-sm font-medium">Falhas</div>
                            <div class="text-2xl font-bold text-red-900" id="failed-count">0</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Jobs Pendentes -->
            <div class="bg-white overflow-hidden shadow-sm sm:rounded-lg mb-6">
                <div class="p-6 text-gray-900">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-lg font-semibold">Jobs Pendentes</h3>
                        <div>
                            <span class="text-sm text-gray-500" id="queue-type"></span>
                            <button onclick="refreshData()" class="ml-3 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 text-sm">
                                Atualizar
                            </button>
                        </div>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fila</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tentativas</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Criado em</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200" id="pending-jobs">
                                <!-- Jobs serão inseridos aqui via JavaScript -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Jobs com Falha -->
            <div class="bg-white overflow-hidden shadow-sm sm:rounded-lg">
                <div class="p-6 text-gray-900">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-lg font-semibold">Jobs com Falha</h3>
                        <button onclick="clearFailedJobs()" class="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 text-sm">
                            Limpar Falhas
                        </button>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fila</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Falhou em</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Exceção</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200" id="failed-jobs">
                                <!-- Jobs com falha serão inseridos aqui via JavaScript -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>

    @push('scripts')
    <script>
        // Função para atualizar os dados da fila
        function refreshData() {
            fetch('/queue/data')
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        updateQueueInfo(data);
                    } else {
                        console.error('Erro ao buscar dados:', data.error);
                    }
                })
                .catch(error => console.error('Erro na requisição:', error));
        }

        // Função para atualizar as informações na página
        function updateQueueInfo(data) {
            // Atualizar tipo de fila
            document.getElementById('queue-type').textContent = `Conexão: ${data.connection}`;

            // Atualizar contadores
            const stats = data.data.stats;
            document.getElementById('pending-count').textContent = stats.pending;
            document.getElementById('reserved-count').textContent = stats.reserved;
            document.getElementById('delayed-count').textContent = stats.delayed;
            document.getElementById('failed-count').textContent = stats.failed;

            // Atualizar tabela de jobs pendentes
            const pendingJobsTable = document.getElementById('pending-jobs');
            pendingJobsTable.innerHTML = '';
            
            data.data.jobs.forEach(job => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${job.id}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${job.job}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${job.queue}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${job.attempts}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${job.created_at}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <button onclick='showJobDetails(${JSON.stringify(job)})' class="text-blue-600 hover:text-blue-900">
                            Detalhes
                        </button>
                    </td>
                `;
                pendingJobsTable.appendChild(row);
            });

            // Atualizar tabela de jobs com falha
            const failedJobsTable = document.getElementById('failed-jobs');
            failedJobsTable.innerHTML = '';
            
            if (data.data.failed_jobs) {
                data.data.failed_jobs.forEach(job => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${job.id}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${job.job}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${job.queue}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${job.failed_at}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div class="truncate max-w-xs" title="${job.exception}">${job.exception}</div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <button onclick="retryJob(${job.id})" class="text-green-600 hover:text-green-900 mr-3">
                                Tentar Novamente
                            </button>
                            <button onclick='showJobDetails(${JSON.stringify(job)})' class="text-blue-600 hover:text-blue-900">
                                Detalhes
                            </button>
                        </td>
                    `;
                    failedJobsTable.appendChild(row);
                });
            }
        }

        // Função para limpar jobs com falha
        function clearFailedJobs() {
            if (!confirm('Tem certeza que deseja limpar todos os jobs com falha?')) {
                return;
            }

            fetch('/queue/clear-failed', {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
                    'Content-Type': 'application/json'
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    refreshData();
                } else {
                    console.error('Erro ao limpar jobs:', data.error);
                }
            })
            .catch(error => console.error('Erro na requisição:', error));
        }

        // Função para tentar novamente um job específico
        function retryJob(id) {
            fetch(`/queue/retry/${id}`, {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
                    'Content-Type': 'application/json'
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    refreshData();
                } else {
                    console.error('Erro ao retentar job:', data.error);
                }
            })
            .catch(error => console.error('Erro na requisição:', error));
        }

        // Função para mostrar detalhes do job
        function showJobDetails(job) {
            // Criar um modal ou dialog para mostrar os detalhes
            const detailsHtml = `
                <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full" id="job-details-modal">
                    <div class="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
                        <div class="flex justify-between items-center pb-3">
                            <h3 class="text-xl font-semibold">Detalhes do Job</h3>
                            <button onclick="document.getElementById('job-details-modal').remove()" class="text-gray-400 hover:text-gray-500">
                                <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>
                        <div class="mt-4">
                            <pre class="bg-gray-100 p-4 rounded-md overflow-x-auto">
${JSON.stringify(job.payload, null, 2)}
                            </pre>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', detailsHtml);
        }

        // Atualizar dados a cada 5 segundos
        refreshData();
        setInterval(refreshData, 5000);
    </script>
    @endpush
</x-app-layout> 
