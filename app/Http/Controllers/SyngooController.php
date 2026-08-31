<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class SyngooController extends Controller
{
    public function sendMessage($data)
    {
        $url = 'https://gummyhair.syngoo-talk.app/api/v4/message/send';
        $queryString = http_build_query($data);
        $urlWithParams = $url . '?' . $queryString;

        $ch = curl_init($urlWithParams);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/json'));
        curl_setopt($ch, CURLOPT_HTTPGET, true); // Para garantir que seja uma requisição GET
        $response = curl_exec($ch);

        if (curl_errno($ch)) {
            $error = curl_error($ch);
            curl_close($ch);
            return ['status' => 'error', 'message' => $error];
        } else {
            curl_close($ch);
            return ['status' => 'success', 'response' => $response];
        }
    }
}
