const statusEl = document.getElementById("status");
const debugEl = document.getElementById("debug");

/* -----------------------------
   Debug Logger
----------------------------- */
function logDebug(text) {
    debugEl.textContent += text + "\n\n";
    debugEl.scrollTop = debugEl.scrollHeight;
}

/* -----------------------------
   Load Stored Values
----------------------------- */
document.addEventListener("DOMContentLoaded", () => {

    chrome.storage.local.get(["last_api_url", "last_tv_id"], (result) => {

        if (result.last_api_url)
            document.getElementById("url").value = result.last_api_url;

        if (result.last_tv_id)
            document.getElementById("tradingViewId").value = result.last_tv_id;

    });

});

/* -----------------------------
   Trade Handler
----------------------------- */
async function handleTrade(actionType) {

    debugEl.textContent = "";
    statusEl.innerText = "Processing...";

    try {

        const tradingViewId = document.getElementById("tradingViewId").value.trim();
        const direction = document.getElementById("direction").value;
        const sl = parseFloat(document.getElementById("sl").value);
        const tp = parseFloat(document.getElementById("tp").value);
        const url = document.getElementById("url").value;
        const method = document.getElementById("method").value;

        /* Validation */
        if (!tradingViewId)
            throw new Error("TradingView ID is required");

        if (!url)
            throw new Error("API URL is required");

        if (sl < 0)
            throw new Error("Stop loss must be positive");

        if (tp < 0)
            throw new Error("Take profit must be positive");

        /* Save state */
        chrome.storage.local.set({
            last_api_url: url,
            last_tv_id: tradingViewId
        });

        const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true
        });

        if (!tab)
            throw new Error("No active tab found");

        /* Send message to content script */
        chrome.tabs.sendMessage(
            tab.id,
            {
                action: "getPriceAndSend",
                data: {
                    action: actionType,
                    tradingViewId,
                    direction,
                    sl,
                    tp,
                    url,
                    method
                }
            },
            (response) => {

                if (chrome.runtime.lastError) {
                    statusEl.innerText = "Extension error";
                    logDebug("Error: " + chrome.runtime.lastError.message);
                    return;
                }

                if (!response) {
                    statusEl.innerText = "No response";
                    logDebug("Error: No response from content script");
                    return;
                }

                statusEl.innerText = response.success
                    ? "Sent successfully"
                    : "Failed";

                /* Human readable debug output */
                if (response.server_response) {

                    const p = response.payload;

                    logDebug(
                        "Sent successfully\n\n" +
                        "Action: " + p.action + "\n" +
                        "TradingView ID: " + p.tradingview_id + "\n" +
                        "Symbol: " + p.symbol + "\n" +
                        "Exchange: " + p.exchange + "\n" +
                        "Direction: " + p.direction + "\n" +
                        "Stop Loss: " + p.stop_loss + "\n" +
                        "Take Profit: " + p.take_profit + "\n" +
                        "Price: " + p.current_price + "\n" +
                        "Timestamp: " + p.timestamp
                    );

                } else {
                    logDebug("Server Response: " +
                        (response.server_response || "No response data"));
                }

            }
        );

    } catch (err) {
        statusEl.innerText = "Error";
        logDebug("Error: " + err.message);
    }
}

/* -----------------------------
   Button Events
----------------------------- */
document.getElementById("addTrade")
    .addEventListener("click", () => handleTrade("add"));

document.getElementById("editTrade")
    .addEventListener("click", () => handleTrade("edit"));

document.getElementById("deleteTrade")
    .addEventListener("click", () => handleTrade("delete"));