if (typeof chrome === "undefined" || !chrome.runtime) {
    console.log("Extension context not available");
}

function getToolbarSymbol() {
    const button = document.querySelector("#header-toolbar-symbol-search");

    if (!button) {
        throw new Error("Header button not found");
    }

    const span = button.querySelector("span");

    if (!span) {
        throw new Error("Header text not found");
    }

    return span.innerText.trim();
}

/* =====================================================
   Instrument Reader (GLOBAL – used everywhere)
===================================================== */
function getInstrumentData() {
    const symbolBtn = document.querySelector(
        '[data-qa-id="title-wrapper legend-source-title"] button'
    );

    const rawSymbol = symbolBtn
        ? symbolBtn.innerText.trim()
        : null;

    const exchangeEl = document.querySelector(
        '[data-qa-id="title-wrapper legend-source-exchange"] .title-l31H9iuA'
    );

    const exchange = exchangeEl
        ? exchangeEl.innerText.trim()
        : null;

    if (!rawSymbol) {
        throw new Error("Symbol not found in legend header");
    }

    return {
        symbol: rawSymbol,
        exchange: exchange
    };
}

/* =====================================================
   Retry Helper (3 sec interval)
===================================================== */
function waitForSymbol(interval = 3000, maxAttempts = 10) {
    return new Promise((resolve, reject) => {
        let attempts = 0;

        const check = () => {
            attempts++;

            try {
                const instrument = getInstrumentData();
                resolve(instrument);
            } catch (err) {
                if (attempts >= maxAttempts) {
                    reject(new Error("Symbol not found after retries"));
                } else {
                    setTimeout(check, interval);
                }
            }
        };

        check();
    });
}

/* =====================================================
   Message Listener
===================================================== */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    /* =============================
       GET SYMBOL (ASYNC RETRY)
    ============================== */
    if (request.action === "getSymbol") {

        waitForSymbol(3000, 10)
            .then(instrument => {
                sendResponse({
                    success: true,
                    symbol: instrument.symbol,
                    exchange: instrument.exchange
                });
            })
            .catch(err => {
                sendResponse({
                    success: false,
                    error: err.message
                });
            });

        return true; // KEEP MESSAGE CHANNEL OPEN
    }

    /* =============================
       GET PRICE AND SEND
    ============================== */
    if (request.action !== "getPriceAndSend") return;

    (async () => {
        try {

            const { action, tradeId, tradingViewId, direction, entry, sl, tp, url, method } = request.data;

            /* -------- PRICE READER -------- */
            function getButtonPrice(direction) {
                const selector = direction === "buy"
                    ? '[data-name="buy-order-button"] .buttonText-SXMXfs_Z'
                    : '[data-name="sell-order-button"] .buttonText-SXMXfs_Z';

                let buttonPriceEl = document.querySelector(selector);

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

            const instrument = getInstrumentData();

            const header = getToolbarSymbol();

            const payload = {
                action: action,
                tradeId: tradeId,
                tradingview_id: tradingViewId,
                header: header,
                symbol: instrument.symbol,
                exchange: instrument.exchange,
                entry: entry,
                direction,
                stop_loss: sl,
                take_profit: tp,
                current_price: currentPrice,
                timestamp: new Date().toISOString()
            };

            let response;

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

            let responseBody;

            try {
                responseBody = await response.json();
            } catch {
                responseBody = await response.text();
            }

            sendResponse({
                success: response.ok,
                http_status: response.status,
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

    return true; // async response
});