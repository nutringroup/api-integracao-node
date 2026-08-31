<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\DB;

class QueueController extends Controller
{
    /**
     * Exibe a página principal da fila
     */
    public function index()
    {
        return view('queue.index');
    }

    /**
     * Retorna dados da fila em formato JSON para AJAX
     */
    public function getQueueData()
    {
        try {
            $queueConnection = config('queue.default');
            $data = [];

            if ($queueConnection === 'redis') {
                $data = $this->getRedisQueueData();
            } elseif ($queueConnection === 'database') {
                $data = $this->getDatabaseQueueData();
            }

            return response()->json([
                'success' => true,
                'connection' => $queueConnection,
                'data' => $data
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obter dados da fila Redis
     */
    private function getRedisQueueData()
    {
        $redis = Redis::connection();
        $queueName = config('queue.connections.redis.queue', 'default');
        $queueKey = 'queues:' . $queueName;
        
        // Obter jobs na fila
        $pendingJobs = $redis->lrange($queueKey, 0, -1);
        $processedJobs = [];
        
        foreach ($pendingJobs as $job) {
            $jobData = json_decode($job, true);
            if ($jobData) {
                $processedJobs[] = [
                    'id' => $jobData['id'] ?? 'N/A',
                    'job' => $jobData['displayName'] ?? $jobData['job'] ?? 'Unknown',
                    'queue' => $jobData['queue'] ?? $queueName,
                    'attempts' => $jobData['attempts'] ?? 0,
                    'created_at' => isset($jobData['pushedAt']) ? date('Y-m-d H:i:s', $jobData['pushedAt']) : 'N/A',
                    'payload' => $jobData
                ];
            }
        }

        // Obter estatísticas da fila
        $stats = [
            'pending' => count($pendingJobs),
            'failed' => $redis->llen('queues:' . $queueName . ':failed'),
            'delayed' => $redis->zcard('queues:' . $queueName . ':delayed'),
            'reserved' => $redis->zcard('queues:' . $queueName . ':reserved')
        ];

        return [
            'jobs' => $processedJobs,
            'stats' => $stats,
            'queue_name' => $queueName
        ];
    }

    /**
     * Obter dados da fila Database
     */
    private function getDatabaseQueueData()
    {
        $tableName = config('queue.connections.database.table', 'jobs');
        
        // Jobs pendentes
        $pendingJobs = DB::table($tableName)
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($job) {
                $payload = json_decode($job->payload, true);
                return [
                    'id' => $job->id,
                    'job' => $payload['displayName'] ?? $payload['job'] ?? 'Unknown',
                    'queue' => $job->queue,
                    'attempts' => $job->attempts,
                    'created_at' => $job->created_at,
                    'available_at' => date('Y-m-d H:i:s', $job->available_at),
                    'payload' => $payload
                ];
            });

        // Jobs falhados
        $failedJobs = DB::table('failed_jobs')
            ->orderBy('failed_at', 'desc')
            ->get()
            ->map(function ($job) {
                $payload = json_decode($job->payload, true);
                return [
                    'id' => $job->id,
                    'uuid' => $job->uuid,
                    'job' => $payload['displayName'] ?? $payload['job'] ?? 'Unknown',
                    'queue' => $job->queue ?? 'default',
                    'failed_at' => $job->failed_at,
                    'exception' => $job->exception,
                    'payload' => $payload
                ];
            });

        $stats = [
            'pending' => $pendingJobs->count(),
            'failed' => $failedJobs->count(),
            'delayed' => 0,
            'reserved' => 0
        ];

        return [
            'jobs' => $pendingJobs->toArray(),
            'failed_jobs' => $failedJobs->toArray(),
            'stats' => $stats,
            'queue_name' => config('queue.connections.database.queue', 'default')
        ];
    }

    /**
     * Limpar jobs falhados
     */
    public function clearFailedJobs()
    {
        try {
            if (config('queue.default') === 'database') {
                DB::table('failed_jobs')->truncate();
            } else {
                // Para Redis, limpar a lista de jobs falhados
                $redis = Redis::connection();
                $queueName = config('queue.connections.redis.queue', 'default');
                $redis->del('queues:' . $queueName . ':failed');
            }

            return response()->json([
                'success' => true,
                'message' => 'Jobs falhados removidos com sucesso!'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Retry job falhado específico
     */
    public function retryFailedJob($id)
    {
        try {
            if (config('queue.default') === 'database') {
                $failedJob = DB::table('failed_jobs')->where('id', $id)->first();
                if ($failedJob) {
                    // Recriar o job na fila
                    $payload = json_decode($failedJob->payload, true);
                    Queue::push($payload['job'], $payload['data'] ?? []);
                    
                    // Remover da tabela de jobs falhados
                    DB::table('failed_jobs')->where('id', $id)->delete();
                }
            }

            return response()->json([
                'success' => true,
                'message' => 'Job reenviado para a fila com sucesso!'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage()
            ], 500);
        }
    }
} 
