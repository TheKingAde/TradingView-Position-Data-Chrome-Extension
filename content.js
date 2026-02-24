chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    if (request.action === "getPriceAndSend") {

        const { direction, sl, tp, url, method } = request.data;

        // Attempt to extract current price from TradingView DOM
        let priceElement = document.querySelector('[data-field="last"]');

        if (!priceElement) {
            priceElement = document.querySelector('.lastPrice'); // fallback
        }

        if (!priceElement) {
            sendResponse({ status: "Price not found on chart." });
            return;
        }

        const currentPrice = priceElement.innerText.replace(',', '');

        const payload = {
            symbol: document.title,
            direction: direction,
            stop_loss: sl,
            take_profit: tp,
            current_price: currentPrice,
            timestamp: new Date().toISOString()
        };

        if (method === "POST") {
            fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            })
            .then(res => res.text())
            .then(data => {
                sendResponse({ status: "POST sent successfully" });
            })
            .catch(err => {
                sendResponse({ status: "POST failed: " + err.message });
            });

        } else {

            const params = new URLSearchParams(payload).toString();
            fetch(`${url}?${params}`, {
                method: "GET"
            })
            .then(res => res.text())
            .then(data => {
                sendResponse({ status: "GET sent successfully" });
            })
            .catch(err => {
                sendResponse({ status: "GET failed: " + err.message });
            });
        }

        return true; // Required for async sendResponse
    }
});
