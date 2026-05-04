const http = require('http');

const url = "http://127.0.0.1:8788/api/proxy-image?url=" + encodeURIComponent("http://media2.uparts.info/CAR00401//parts/ALTIS/%E5%A3%93%E7%B8%AE%E6%A9%9F/COM-T016.jpg");

http.get(url, (res) => {
    console.log("Status:", res.statusCode);
    console.log("Headers:", res.headers);
    let data = [];
    res.on('data', chunk => data.push(chunk));
    res.on('end', () => {
        const buffer = Buffer.concat(data);
        console.log("Size:", buffer.length);
        if (res.statusCode >= 400) {
            console.log("Body:", buffer.toString());
        }
    });
}).on('error', (e) => {
    console.error("Error:", e.message);
});
