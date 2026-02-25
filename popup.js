injectForms();

const formTemplate = `
<div class="row">
    <div class="field">
        <label>TradingView ID</label>
        <input type="text" id="tradingViewId" placeholder="Enter TradingView ID" />
    </div>

    <div class="field">
        <label>Direction</label>
        <select id="direction">
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
        </select>
    </div>
</div>

<div class="row">
    <div class="field">
        <label>Stop Loss</label>
        <input type="number" id="sl" step="0.00001" />
    </div>

    <div class="field">
        <label>Take Profit</label>
        <input type="number" id="tp" step="0.00001" />
    </div>
</div>

<div class="row">
    <div class="field">
        <label>Entry Level</label>
        <input type="number" id="entry"/>
    </div>
</div>
`;
/*
<div class="row">
    <div class="field">
        <label>API URL</label>
        <input type="text" id="url" placeholder="https://example.com/api" />
    </div>

    <div class="field">
        <label>Request Type</label>
        <select id="method">
            <option value="POST">POST</option>
            <option value="GET">GET</option>
        </select>
    </div>
</div>
*/

function injectForms() {
    document.querySelectorAll(".form-fields").forEach(el => {
        el.innerHTML = formTemplate;
    });
}

document.addEventListener("DOMContentLoaded", () => {

    chrome.storage.local.get(["last_tv_id"], (result) => {
        if (result.last_tv_id) {
            document.getElementById("tradingViewId").value = result.last_tv_id;
        }
    });

});

document.querySelectorAll(".form-fields").forEach(el => {
    el.innerHTML = formTemplate;
});

document.querySelectorAll(".tab").forEach(button => {
    button.addEventListener("click", () => {

        document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

        button.classList.add("active");
        document.getElementById(button.dataset.tab).classList.add("active");

        loadTabDefaults(button.dataset.tab);
    });
});

const statusEl = document.getElementById("status");
const debugEl = document.getElementById("debug");

/* -----------------------------
   Debug Logger
----------------------------- */
function logDebug(text) {
    debugEl.textContent += text + "\n\n";
    debugEl.scrollTop = debugEl.scrollHeight;
}

function loadTabDefaults(tabName) {

    if (tabName === "add") {
        chrome.storage.local.get(["last_tv_id"], (result) => {

            document.getElementById("tradingViewId").value =
                result.last_tv_id || "";

            document.getElementById("direction").value = "buy";
            document.getElementById("sl").value = "";
            document.getElementById("tp").value = "";
            document.getElementById("entry").value = "";
        });
    }

    if (tabName === "edit" || tabName === "delete") {
        chrome.storage.local.get(["last_trade"], (result) => {

            if (!result.last_trade) return;

            const trade = result.last_trade;

            document.getElementById("tradingViewId").value =
                trade.tradingViewId || "";

            document.getElementById("direction").value =
                trade.direction || "buy";

            document.getElementById("sl").value =
                trade.sl ?? "";

            document.getElementById("tp").value =
                trade.tp ?? "";

            document.getElementById("entry").value =
                trade.entry || "";
        });
    }
}

document.addEventListener("DOMContentLoaded", async () => {

    const symbolEl = document.getElementById("currentSymbol");

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
        symbolEl.textContent = "No active tab";
        return;
    }

    chrome.tabs.sendMessage(
        tab.id,
        { action: "getSymbol" },
        (response) => {

            if (chrome.runtime.lastError || !response || !response.success) {
                symbolEl.textContent = "Symbol unavailable";
                return;
            }

            symbolEl.textContent = `${response.symbol} (${response.exchange || ""})`;
        }
    );
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
        const url = "http://127.0.0.1:5000/trade";
        const method = "POST";

        /* Validation */
        if (!tradingViewId)
            throw new Error("TradingView ID is required");

        /*
        if (!url)
            throw new Error("API URL is required");
        */
       
        if (sl < 0)
            throw new Error("Stop loss must be positive");

        if (tp < 0)
            throw new Error("Take profit must be positive");

        /* Save state */
        chrome.storage.local.set({
            last_tv_id: tradingViewId,
            last_trade: {
                tradingViewId,
                direction,
                sl,
                tp,
                entry: document.getElementById("entry").value.trim()
            }
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

function loadLastTrade() {
    chrome.storage.local.get(["last_trade"], (result) => {

        if (!result.last_trade) return;

        const trade = result.last_trade;

        document.getElementById("tradingViewId").value = trade.tradingViewId || "";
        document.getElementById("direction").value = trade.direction || "buy";
        document.getElementById("sl").value = trade.sl ?? "";
        document.getElementById("tp").value = trade.tp ?? "";
        document.getElementById("entry").value = trade.entry || "";
    });
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

document.addEventListener("DOMContentLoaded", () => {
    loadTabDefaults("add");
});