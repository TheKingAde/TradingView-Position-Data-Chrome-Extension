chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    if (request.action !== "getPriceAndSend") return;

    (async () => {
        try {
            const { direction, sl, tp, url, method } = request.data;

            function getButtonPrice(direction) {
                const selector = direction === "buy"
                    ? '[data-name="buy-order-button"] .buttonText-SXMXfs_Z'
                    : '[data-name="sell-order-button"] .buttonText-SXMXfs_Z';

                let buttonPriceEl = document.querySelector(selector);

                // Fallback: if TradingView changes internal class names,
                // try reading first span inside the button wrapper
                if (!buttonPriceEl) {
                    const wrapperSelector = direction === "buy"
                        ? '[data-name="buy-order-button"]'
                        : '[data-name="sell-order-button"]';

                    const wrapper = document.querySelector(wrapperSelector);

                    if (wrapper) {
                        const spans = wrapper.querySelectorAll("span");
                        for (let span of spans) {
                            const value = span.innerText.replace(/,/g, '');
                            if (!isNaN(parseFloat(value))) {
                                buttonPriceEl = span;
                                break;
                            }
                        }
                    }
                }

                if (!buttonPriceEl) {
                    throw new Error(`${direction.toUpperCase()} button price not found`);
                }

                return buttonPriceEl.innerText.replace(/,/g, '');
            }

            const currentPrice = getButtonPrice(direction);

            const payload = {
                symbol: document.title,
                direction,
                stop_loss: sl,
                take_profit: tp,
                current_price: currentPrice,
                timestamp: new Date().toISOString()
            };

            let response;
            let httpStatus;
            let responseBody;

            if (method === "POST") {
                response = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
            } else {
                const params = new URLSearchParams(payload).toString();
                response = await fetch(`${url}?${params}`, { method: "GET" });
            }

            httpStatus = response.status;

            try {
                responseBody = await response.json();
            } catch {
                responseBody = await response.text();
            }

            sendResponse({
                success: response.ok,
                http_status: httpStatus,
                server_response: responseBody,
                payload: payload
            });

        } catch (error) {
            sendResponse({
                success: false,
                error: error.message
            });
        }
    })();

    return true; // async
});