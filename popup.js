const statusEl = document.getElementById("status");
const debugEl = document.getElementById("debug");

function logDebug(data) {
    debugEl.textContent += JSON.stringify(data, null, 2) + "\n\n";
    debugEl.scrollTop = debugEl.scrollHeight;
}

document.addEventListener("DOMContentLoaded", () => {

    chrome.storage.local.get(["last_api_url"], (result) => {
        if (result.last_api_url) {
            document.getElementById("url").value = result.last_api_url;
        }
    });

    chrome.storage.local.get(["last_tv_id"], (result) => {
        if (result.last_tv_id) {
            document.getElementById("tradingViewId").value = result.last_tv_id;
        }
    });

});

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

        if (sl < 0) throw new Error("Stop loss must be positive");
        if (tp < 0) throw new Error("Take profit must be positive");
        if (!url) throw new Error("API URL is required");
        if (!tradingViewId) throw new Error("TradingView ID is required");

        chrome.storage.local.set({ last_api_url: url });
        chrome.storage.local.set({ last_tv_id: tradingViewId });

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab) throw new Error("No active tab found");

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
                    logDebug({ error: chrome.runtime.lastError.message });
                    return;
                }

                if (!response) {
                    statusEl.innerText = "No response";
                    logDebug({ error: "No response from content script" });
                    return;
                }

                statusEl.innerText = response.success ? "Success" : "Failed";

                logDebug({
                    sent_payload: response.payload,
                    server_status: response.http_status,
                    server_response: response.server_response,
                    error: response.error || null
                });
            }
        );

    } catch (err) {
        statusEl.innerText = "Error";
        logDebug({ error: err.message });
    }
}

document.getElementById("addTrade")
    .addEventListener("click", () => handleTrade("add"));

document.getElementById("editTrade")
    .addEventListener("click", () => handleTrade("edit"));

document.getElementById("deleteTrade")
    .addEventListener("click", () => handleTrade("delete"));