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

});

document.getElementById("sendTrade").addEventListener("click", async () => {

    debugEl.textContent = "";
    statusEl.innerText = "Processing...";

    try {
        const direction = document.getElementById("direction").value;
        const sl = parseFloat(document.getElementById("sl").value);
        const tp = parseFloat(document.getElementById("tp").value);
        const url = document.getElementById("url").value;

        
        if (sl < 0) {
            throw new Error("Stop loss must be a positive number");
        }

        if (tp < 0) {
            throw new Error("Take profit must be a positive number");
        }
        
        // Save API URL before sending trade
        chrome.storage.local.set({
            last_api_url: url
        });
        const method = document.getElementById("method").value;

        if (!url) {
            throw new Error("API URL is required");
        }

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab) {
            throw new Error("No active tab found");
        }

        chrome.tabs.sendMessage(
            tab.id,
            {
                action: "getPriceAndSend",
                data: { direction, sl, tp, url, method }
            },
            (response) => {

                if (chrome.runtime.lastError) {
                    const error = chrome.runtime.lastError.message;
                    statusEl.innerText = "Extension error";
                    logDebug({ error });
                    return;
                }

                if (!response) {
                    statusEl.innerText = "No response received";
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
});