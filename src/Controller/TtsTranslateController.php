<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Contracts\HttpClient\HttpClientInterface;
use Symfony\Contracts\Cache\CacheInterface;
use Symfony\Contracts\Cache\ItemInterface;

class TtsTranslateController extends AbstractController
{
    #[Route('/api/tts/translate', name: 'api_tts_translate', methods: ['POST'])]
    public function translate(
        Request $request,
        HttpClientInterface $http,
        CacheInterface $cache
    ): JsonResponse {
        $data = $request->toArray();

        $text = trim((string)($data['text'] ?? ''));
        if ($text === '') {
            return $this->json(['translated' => '']);
        }

        // Limit to avoid abuse/cost explosion
        $text = mb_substr($text, 0, 300);

        $source = strtolower(explode('-', (string)($data['source'] ?? 'fr'))[0]); // fr-FR -> fr
        $target = strtolower(explode('-', (string)($data['target'] ?? 'en'))[0]); // en-US -> en

        // Cache by (source, target, text)
        $cacheKey = 'tts_tr_' . sha1($source.'|'.$target.'|'.$text);

        $translated = $cache->get($cacheKey, function (ItemInterface $item) use ($http, $text, $source, $target) {
            $item->expiresAfter(86400); // 1 day

            $apiKey = $this->getParameter('gemini_api_key');
            $model  = $this->getParameter('gemini_model');

            if (!$apiKey) {
                return $text;
            }

            $url = sprintf(
                'https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s',
                rawurlencode($model),
                rawurlencode($apiKey)
            );

            $prompt = "You are a translation engine.\n"
                . "Translate from {$source} to {$target}.\n"
                . "Return ONLY the translated text. No quotes, no extra words.if the language you are translating to is in arabic make it to Tunisian Arabic (Derja). Use Tunisian everyday speech, Arabic script, no Modern Standard Arabic. Keep it natural and short.\n\n"
                . $text;

            $resp = $http->request('POST', $url, [
                'json' => [
                    'contents' => [[
                        'role' => 'user',
                        'parts' => [['text' => $prompt]],
                    ]],
                    'generationConfig' => [
                        'temperature' => 0.0,
                        'maxOutputTokens' => 256,
                    ],
                ],
                'timeout' => 10,
            ]);

            $json = $resp->toArray(false);
            $out = $json['candidates'][0]['content']['parts'][0]['text'] ?? $text;
            $out = trim((string) $out);

            return $out !== '' ? $out : $text;
        });

        return $this->json(['translated' => $translated]);
    }
}
