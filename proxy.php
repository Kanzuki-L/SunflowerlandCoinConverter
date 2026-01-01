<?php
// proxy.php - 通用代理 (Generic Proxy) v2

// 1. 允许跨域
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// 2. 获取前端传来的 url 参数
$targetUrl_ = isset($_GET['url']) ? $_GET['url'] : null;

if (!$targetUrl_) {
    http_response_code(400);
    echo json_encode(["error" => "Missing 'url' parameter"]);
    exit;
}

// 3. 安全检查 (只允许 sfl.world 和 github)
$allowedDomains_ = ['sfl.world', 'raw.githubusercontent.com'];
$parsedUrl_ = parse_url($targetUrl_);

if (!isset($parsedUrl_['host']) || !in_array($parsedUrl_['host'], $allowedDomains_)) {
    http_response_code(403);
    echo json_encode(["error" => "Domain not allowed: " . $parsedUrl_['host']]);
    exit;
}

// 4. 伪装浏览器 User-Agent (GitHub 有时会拦截无头请求)
$options_ = [
    "http" => [
        "header" => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36\r\n"
    ]
];
$context_ = stream_context_create($options_);

// 5. 获取内容
$response_ = @file_get_contents($targetUrl_, false, $context_);

if ($response_ === FALSE) {
    http_response_code(500);
    echo json_encode(["error" => "Failed to fetch data from remote server"]);
} else {
    // 如果是 .ts 文件，封装在 JSON 里返回，防止前端解析格式错误
    if (strpos($targetUrl_, '.ts') !== false) {
        echo json_encode(["content" => $response_]);
    } else {
        echo $response_;
    }
}
?>