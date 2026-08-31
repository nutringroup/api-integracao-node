<?php
// app/Http/Controllers/HistoryLogController.php

namespace App\Http\Controllers;

use App\Models\Historylog;
use App\Models\Orders;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;



class HistoryLogController extends Controller
{
    public function index(Request $request)
    {
        // Carrega os últimos 50 logs para a visualização inicial
        $logs = Historylog::with('stepDescription')->latest()->limit(50)->get();
        return view('dashboard', compact('logs'));
    }

    public function getLogs(Request $request)
    {
        Log::info('getLogs chamado');
        $shopify_id = $request->query('shopify_id');
        Log::info('shopify_id: ' . $shopify_id);

        if ($shopify_id) {
            $logs = Historylog::with('stepDescription')
                ->where('shopify_id', 'like', '%' . $shopify_id . '%')
                ->orderBy('step', 'desc')
                ->limit(50)
                ->get();
        } else {
            $logs = Historylog::with('stepDescription')
                ->orderBy('id', 'desc')
                ->limit(50)
                ->get();
        }

        // Modificando os dados para incluir a descrição do step na resposta JSON
        $logs = $logs->map(function ($log) {
            return [
                'id' => $log->id,
                'shopify_id' => $log->shopify_id,
                'step_description' => $log->stepDescription ? $log->stepDescription->description : 'Step não encontrado',
                'log' => $log->log,
                'created_at' => $log->created_at->toDateTimeString(),
            ];
        });

        return response()->json($logs->toArray());
    }

    public function logsFiltrados(Request $request)
    {
        // Inicializar variáveis padrão para evitar erro undefined
        $logs = collect();
        $logsAgrupados = [];
        $pedidosPorDia = [];
        
        try {
            $logs = DB::table('historylog')
                ->select(
                    'historylog.shopify_id',
                    DB::raw('COUNT(*) as log_count'),
                    DB::raw('MAX(created_at) as latest_created_at')
                )
                ->whereIn('step', [17, 9, 10])
                ->whereRaw("log::text LIKE '{\"faultstring\":%'")
                ->whereNotExists(function($query) {
                    $query->select(DB::raw(1))
                          ->from('manual_orders')
                          ->whereRaw('manual_orders.shopify_id = historylog.shopify_id');
                })
                ->whereNotExists(function($query) {
                    $query->select(DB::raw(1))
                          ->from('historylog as h2')
                          ->where('h2.step', 30)
                          ->whereRaw("h2.log::text LIKE '%Pedido já integrado%'")
                          ->whereRaw('h2.shopify_id = historylog.shopify_id');
                })
                ->whereNotExists(function($query) {
                    $query->select(DB::raw(1))
                          ->from('historylog as h3')
                          ->where('h3.step', 17)
                          ->whereRaw("h3.log::text LIKE '{\"codigo_pedido\":%'")
                          ->whereRaw('h3.shopify_id = historylog.shopify_id');
                })
                ->groupBy('historylog.shopify_id')
                ->orderBy('latest_created_at', 'desc')
                ->get();

            // Buscar logs detalhados para agrupamento
            $logsAgrupados = $this->agruparLogsSemelhantes($logs);

            // Calcule os pedidos por dia
            $pedidosPorDia = $logs->groupBy(function($log) {
                return \Carbon\Carbon::parse($log->latest_created_at)->format('Y-m-d');
            })->map->count();
            
            // Buscar created_at dos pedidos na step 2
            $shopifyIds = $logs->pluck('shopify_id')->toArray();

            if (!empty($shopifyIds)) {
                $pedidosCreatedAt = DB::table('historylog')
                    ->select('shopify_id', 'log')
                    ->where('step', 2)
                    ->whereIn('shopify_id', $shopifyIds)
                    ->get()
                    ->mapWithKeys(function($item) {
                        $logData = json_decode($item->log, true);
                        return [$item->shopify_id => $logData['created_at'] ?? null];
                    });

                // Adicionar created_at aos logs
                $logs = $logs->map(function($log) use ($pedidosCreatedAt) {
                    $log->pedido_created_at = $pedidosCreatedAt[$log->shopify_id] ?? null;
                    return $log;
                });
            }

        } catch (\Exception $e) {
            Log::error('Erro ao buscar logs filtrados: ' . $e->getMessage());
            Log::error('Stack trace: ' . $e->getTraceAsString());
            
            // Garantir que as variáveis estejam definidas mesmo em caso de erro
            $logs = collect();
            $logsAgrupados = [];
            $pedidosPorDia = [];
        }

        return view('logs_filtrados', compact('logs', 'logsAgrupados', 'pedidosPorDia'))
            ->with('error', isset($e) ? 'Ocorreu um erro ao buscar os logs. Por favor, tente novamente mais tarde.' : null);
    }

    private function agruparLogsSemelhantes($logs)
    {
        if ($logs->isEmpty()) {
            return [];
        }

        try {
            $shopifyIds = $logs->pluck('shopify_id')->toArray();
            
            // Buscar logs detalhados com step e mensagem de erro
            $logsDetalhados = DB::table('historylog as h1')
                ->join('steps as s', 'h1.step', '=', 's.step')
                ->select(
                    'h1.shopify_id',
                    'h1.step',
                    's.description as step_description',
                    'h1.log',
                    'h1.created_at'
                )
                ->whereIn('h1.shopify_id', $shopifyIds)
                ->whereIn('h1.step', [17, 9, 10])
                ->whereRaw("h1.log::text LIKE '{\"faultstring\":%'")
                ->get();

            // Buscar created_at dos pedidos
            $pedidosCreatedAt = DB::table('historylog')
                ->select('shopify_id', 'log')
                ->where('step', 2)
                ->whereIn('shopify_id', $shopifyIds)
                ->get()
                ->mapWithKeys(function($item) {
                    $logData = json_decode($item->log, true);
                    return [$item->shopify_id => $logData['created_at'] ?? null];
                });

            // Agrupar por step e mensagem de erro semelhante
            $grupos = [];
            
            foreach ($logsDetalhados as $log) {
                $logData = json_decode($log->log, true);
                $faultstring = $logData['faultstring'] ?? '';
                
                $chaveErro = $this->extrairChaveErro($faultstring, $log->step);
                $chaveGrupo = $log->step . '_' . md5($chaveErro);
                
                if (!isset($grupos[$chaveGrupo])) {
                    $grupos[$chaveGrupo] = [
                        'step' => $log->step,
                        'step_description' => $log->step_description,
                        'erro_representativo' => $chaveErro,
                        'pedidos' => [],
                        'total_pedidos' => 0,
                        'primeira_ocorrencia' => $log->created_at,
                        'ultima_ocorrencia' => $log->created_at
                    ];
                }
                
                $grupos[$chaveGrupo]['pedidos'][] = [
                    'shopify_id' => $log->shopify_id,
                    'log_completo' => $log->log,
                    'created_at' => $log->created_at,
                    'pedido_created_at' => $pedidosCreatedAt[$log->shopify_id] ?? null
                ];
                
                $grupos[$chaveGrupo]['total_pedidos']++;
                
                if ($log->created_at < $grupos[$chaveGrupo]['primeira_ocorrencia']) {
                    $grupos[$chaveGrupo]['primeira_ocorrencia'] = $log->created_at;
                }
                if ($log->created_at > $grupos[$chaveGrupo]['ultima_ocorrencia']) {
                    $grupos[$chaveGrupo]['ultima_ocorrencia'] = $log->created_at;
                }
            }

            uasort($grupos, function($a, $b) {
                if ($a['total_pedidos'] == $b['total_pedidos']) {
                    return $b['ultima_ocorrencia'] <=> $a['ultima_ocorrencia'];
                }
                return $b['total_pedidos'] <=> $a['total_pedidos'];
            });

            return $grupos;

        } catch (\Exception $e) {
            Log::error('Erro ao agrupar logs semelhantes: ' . $e->getMessage());
            Log::error('Stack trace: ' . $e->getTraceAsString());
            return []; // Retorna um array vazio em caso de erro
        }
    }

    private function extrairChaveErro($faultstring, $step)
    {
        // Remove IDs específicos, códigos numéricos e informações variáveis para agrupar erros similares
        $chave = $faultstring;
        
        try {
            // Generaliza a mensagem de "Tente novamente em X segundos"
            $chave = preg_replace('/Tente novamente em [0-9]+ segundos/i', 'Tente novamente em [TEMPO] segundos', $chave);

            // Remove códigos numéricos específicos entre colchetes
            $chave = preg_replace('/\[[0-9,\s]+\]/', '[ID]', $chave);
            
            // Remove números específicos de pedidos, clientes, etc.
            $chave = preg_replace('/\b[0-9]{6,}\b/', '[NUMERO]', $chave);
            
            // Remove timestamps e datas
            $chave = preg_replace('/[0-9]{4}-[0-9]{2}-[0-9]{2}[\s\T][0-9]{2}:[0-9]{2}:[0-9]{2}/', '[DATA]', $chave);
            
            // Remove CPFs/CNPJs
            $chave = preg_replace('/\b[0-9]{11,14}\b/', '[DOCUMENTO]', $chave);
            
            // Remove códigos de barras ou números longos
            $chave = preg_replace('/\b[0-9]{15,}\b/', '[CODIGO]', $chave);
            
            // Remove valores monetários
            $chave = preg_replace('/R\$\s*[0-9]+[,.]?[0-9]*/', '[VALOR]', $chave);
            
            // Remove endereços de email
            $chave = preg_replace('/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/', '[EMAIL]', $chave);
            
        } catch (\Exception $e) {
            // Se houver erro na regex, apenas limita o tamanho da string
            Log::warning('Erro ao processar regex na chave de erro: ' . $e->getMessage());
        }
        
        // Truncar para evitar chaves muito longas, mantendo a essência do erro
        if (strlen($chave) > 150) {
            $chave = substr($chave, 0, 150) . '...';
        }
        
        return $chave;
    }

    public function filtrarLogs(Request $request)
    {
        try {
            $query = DB::table('historylog')
                ->select(
                    'historylog.shopify_id',
                    DB::raw('MAX(historylog.created_at) as latest_created_at'),
                    DB::raw('string_agg(DISTINCT historylog.log::text, \' | \') as logs')
                )
                ->where('historylog.step', 30)
                ->whereRaw("historylog.log::text LIKE '%Erro%'")
                ->whereNotExists(function($query) {
                    $query->select(DB::raw(1))
                          ->from('historylog as h2')
                          ->where('h2.step', 30)
                          ->whereRaw("h2.log::text LIKE '%Pedido já integrado%'")
                          ->whereRaw('h2.shopify_id = historylog.shopify_id');
                })
                ->whereNotExists(function($query) {
                    $query->select(DB::raw(1))
                          ->from('historylog as h3')
                          ->where('h3.step', 17)
                          ->whereRaw("h3.log::text LIKE '{\"codigo_pedido\":%'")
                          ->whereRaw('h3.shopify_id = historylog.shopify_id');
                });

            // Aplicar filtros adicionais baseados na requisição
            if ($request->has('data_inicio') && $request->data_inicio) {
                $query->where('historylog.created_at', '>=', $request->data_inicio . ' 00:00:00');
            }

            if ($request->has('data_fim') && $request->data_fim) {
                $query->where('historylog.created_at', '<=', $request->data_fim . ' 23:59:59');
            }

            if ($request->has('shopify_id') && $request->shopify_id) {
                $query->where('historylog.shopify_id', $request->shopify_id);
            }

            $logs = $query->groupBy('historylog.shopify_id')
                         ->orderBy('latest_created_at', 'desc')
                         ->get();

            // Calcular pedidos por dia
            $pedidosPorDia = $logs->groupBy(function($log) {
                return \Carbon\Carbon::parse($log->latest_created_at)->format('Y-m-d');
            })->map->count();

            // Buscar created_at dos pedidos na step 2
            $shopifyIds = $logs->pluck('shopify_id')->toArray();

            $pedidosCreatedAt = DB::table('historylog')
                ->select('shopify_id', 'log')
                ->where('step', 2)
                ->whereIn('shopify_id', $shopifyIds)
                ->get()
                ->mapWithKeys(function($item) {
                    $logData = json_decode($item->log, true);
                    return [$item->shopify_id => $logData['created_at'] ?? null];
                });

            // Adicionar created_at aos logs
            $logs = $logs->map(function($log) use ($pedidosCreatedAt) {
                $log->pedido_created_at = $pedidosCreatedAt[$log->shopify_id] ?? null;
                return $log;
            });

            // Buscar logs agrupados para filtros também
            $logsAgrupados = $this->agruparLogsSemelhantes($logs);

            return response()->json([
                'logs' => $logs,
                'logsAgrupados' => $logsAgrupados,
                'pedidosPorDia' => $pedidosPorDia
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Erro ao filtrar logs: ' . $e->getMessage()
            ], 500);
        }
     }

    public function buscarIntervalo(Request $request)
    {
        try {
            $request->validate([
                'id_inicial' => 'required|numeric',
                'id_final' => 'required|numeric|gte:id_inicial'
            ]);

            $idInicial = $request->id_inicial;
            $idFinal = $request->id_final;

            // Busca todos os pedidos existentes no intervalo
            $pedidosExistentes = DB::table('orders')
                ->whereBetween('shopify_id', [$idInicial, $idFinal])
                ->orderBy('shopify_id', 'asc')
                ->pluck('shopify_id')
                ->toArray();

            // Cria array com todos os números do intervalo
            $todosNumeros = range($idInicial, $idFinal);

            // Encontra os números que faltam
            $pedidosFaltantes = array_diff($todosNumeros, $pedidosExistentes);

            return response()->json([
                'mensagem' => 'Análise de intervalo concluída',
                'total_intervalo' => count($todosNumeros),
                'total_existentes' => count($pedidosExistentes),
                'total_faltantes' => count($pedidosFaltantes),
                'pedidos_existentes' => $pedidosExistentes,
                'pedidos_faltantes' => array_values($pedidosFaltantes)
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'erro' => 'Erro ao analisar intervalo: ' . $e->getMessage()
            ], 500);
        }
    }

}
