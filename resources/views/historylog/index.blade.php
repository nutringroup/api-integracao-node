<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>History Logs</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.28.0/themes/prism.min.css" rel="stylesheet" />
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.28.0/prism.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.28.0/components/prism-json.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/alpinejs/3.12.0/cdn.min.js" defer></script>
    <style>
        body {
            font-family: Arial, sans-serif;
            padding: 20px;
            background-color: #f4f4f4;
        }

        table {

            max-width: 95vw;
            border-collapse: collapse;
            margin-bottom: 20px;
            background-color: #fff;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        }

        th, td {
            padding: 12px;
            border: 1px solid #ddd;
            text-align: left;
            vertical-align: top;
        }

        th {
            background-color: #f8f8f8;
        }

        .language-json {
            max-height: 6em; /* Limita a altura a aproximadamente 4 linhas */
            overflow-y: auto; /* Adiciona rolagem interna se necessário */
            font-family: monospace;
            background-color: #f4f4f4;
            border-radius: 4px;
            padding: 8px;
            max-width: 70vw;
            white-space: pre-wrap; /* Permite quebra de linha */
            word-wrap: break-word;
            overflow-wrap: break-word; /* Garante a quebra de palavras longas */

        }

        pre {
            margin: 0;
            max-width: 100%;
            white-space: pre-wrap;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }

        input[type="text"] {
            width: 100%;
            padding: 8px;
            margin-bottom: 20px;
            border: 1px solid #ddd;
            border-radius: 4px;
            box-sizing: border-box;
        }

    </style>
</head>
<body>

<div x-data="{
       interval: null,
       init() {
           this.interval = setInterval(() => {
               this.fetchLogs();
           }, 3000); // Atualiza a cada 3 segundos
       },
       fetchLogs() {
           fetch('/api/history-logs?shopify_id=' + document.getElementById('shopify_id_filter').value)
               .then(response => response.json())
               .then(data => {
                   this.updateTable(data);
               });
       },
       updateTable(data) {
           let tableBody = '';
           data.forEach(log => {
               tableBody += `
                   <tr>
                       <td class='border px-4 py-2'>${log.shopify_id}</td>
                       <td class='border px-4 py-2'>${log.step}</td>
                       <td class='border px-4 py-2 json-field'><pre><code class='language-json'>${Prism.highlight(JSON.stringify(JSON.parse(log.log), null, 2), Prism.languages.json, 'json')}</code></pre></td>
                       <td class='border px-4 py-2'>${log.created_at}</td>
                   </tr>
               `;
           });
           document.getElementById('logs_table_body').innerHTML = tableBody;
           Prism.highlightAll();  // Reaplica o destaque após a atualização
       }
   }">

    <!-- Campo de Filtro -->
    <input type="text" id="shopify_id_filter" placeholder="Filter by Shopify ID" @input.debounce="fetchLogs()" />

    <!-- Tabela de Logs -->
    <table class="table-auto">
        <thead>
            <tr>
                <th class="px-4 py-2">Shopify ID</th>
                <th class="px-4 py-2">Etapa</th>
                <th class="px-4 py-2">Log</th>
                <th class="px-4 py-2">Criado em</th>
            </tr>
        </thead>
        <tbody id="logs_table_body">
            @foreach ($logs as $log)
                <tr>
                    <td class="border px-4 py-2">{{ $log->shopify_id }}</td>
                    <td class="border px-4 py-2">{{ $log->step }}</td>
                    <td class="border px-4 py-2 json-field">
                        <pre><code class="language-json">{{ json_encode(json_decode($log->log), JSON_PRETTY_PRINT) }}</code></pre>
                    </td>
                    <td class="border px-4 py-2">{{ $log->created_at }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

</div>

</body>
</html>
