const https = require('https');
const http = require('http');

const urlHttp = "http://media2.uparts.info/CAR00401//parts/ALTIS/%E5%A3%93%E7%B8%AE%E6%A9%9F/COM-T016.jpg";
const urlHttps = "https://media2.uparts.info/CAR00401//parts/ALTIS/%E5%A3%93%E7%B8%AE%E6%A9%9F/COM-T016.jpg";

http.get(urlHttp, (res) => {
    console.log("HTTP status:", res.statusCode);
}).on('error', (e) => {
    console.error("HTTP error:", e.message);
});

https.get(urlHttps, { rejectUnauthorized: false }, (res) => {
    console.log("HTTPS status:", res.statusCode);
}).on('error', (e) => {
    console.error("HTTPS error:", e.message);
});
