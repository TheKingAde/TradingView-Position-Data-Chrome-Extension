/* -----------------------------
   Form Template
----------------------------- */
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
        <input type="number" id="entry" step="0.00001" />
    </div>
</div>
`;

function generateTradeId() {
    return "TvOB-" +
        Date.now().toString(36) +
        Math.random().toString(36).substring(2, 8).toUpperCase();
}

/* -----------------------------
   Inject Forms
----------------------------- */
function injectForms() {
    document.querySelectorAll(".form-fields").forEach(el => {
        el.innerHTML = formTemplate;
    });
}

/* -----------------------------
   Tab Setup
----------------------------- */
function setupTabs() {
    document.querySelectorAll(".tab").forEach(button => {
        button.addEventListener("click", () => {

            document.querySelectorAll(".tab")
                .forEach(t => t.classList.remove("active"));

            document.querySelectorAll(".tab-content")
                .forEach(c => c.classList.remove("active"));

            button.classList.add("active");
            document.getElementById(button.dataset.tab)
                .classList.add("active");

            loadTabDefaults(button.dataset.tab);
        });
    });
}

/* -----------------------------
   Load Tab Defaults
----------------------------- */
function loadTabDefaults(tabName) {

    const tabContainer = document.getElementById(tabName);
    const tradingViewId = tabContainer.querySelector("#tradingViewId");
    const direction = tabContainer.querySelector("#direction");
    const sl = tabContainer.querySelector("#sl");
    const tp = tabContainer.querySelector("#tp");
    const entry = tabContainer.querySelector("#entry");

    if (tabName === "add") {

        chrome.storage.local.get(["last_tv_id"], (result) => {

            tradingViewId.value = result.last_tv_id || "";
            direction.value = "buy";
            sl.value = "";
            tp.value = "";
            entry.value = "";
        });
    }

    else if (tabName === "edit" || tabName === "delete") {

        chrome.storage.local.get(["last_trade"], (result) => {

            if (!result.last_trade) return;

            const trade = result.last_trade;

            tradingViewId.value = trade.tradingViewId || "";
            direction.value = trade.direction || "buy";
            sl.value = trade.sl ?? "";
            tp.value = trade.tp ?? "";
            entry.value = trade.entry || "";
        });
    }
}
/* -----------------------------
   Load Symbol
----------------------------- */
function loadSymbol() {

    const symbolEl = document.getElementById("currentSymbol");

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {

        if (!tabs[0]) {
            symbolEl.textContent = "No active tab";
            return;
        }

        chrome.tabs.sendMessage(
            tabs[0].id,
            { action: "getSymbol" },
            (response) => {

                if (chrome.runtime.lastError || !response || !response.success) {
                    symbolEl.textContent = "Symbol unavailable";
                    return;
                }

                symbolEl.textContent =
                    `${response.symbol} (${response.exchange || ""})`;
            }
        );
    });
}

/* -----------------------------
   Debug + Status
----------------------------- */
const statusEl = document.getElementById("status");
const debugEl = document.getElementById("debug");

function logDebug(text) {
    debugEl.textContent += text + "\n\n";
    debugEl.scrollTop = debugEl.scrollHeight;
}

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
        const entry = document.getElementById("entry").value.trim();

        const url = "https://disciplinedminds.in/webhook/take-trade";
        const method = "POST";

        if (!tradingViewId)
            throw new Error("TradingView ID is required");

        if (!isNaN(sl) && sl < 0)
            throw new Error("Stop loss must be positive");

        if (!isNaN(tp) && tp < 0)
            throw new Error("Take profit must be positive");
        
        let tradeId;

        if (actionType === "add") {

            tradeId = generateTradeId();

            await chrome.storage.local.set({
                last_tv_id: tradingViewId,
                last_trade: {
                    tradeId,
                    tradingViewId,
                    direction,
                    sl,
                    tp,
                    entry
                }
            });

        } else {

            const result = await chrome.storage.local.get(["last_trade"]);

            if (!result.last_trade || !result.last_trade.tradeId) {
                throw new Error("No previous trade found to edit/delete");
            }

            tradeId = result.last_trade.tradeId;
        }

        const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true
        });

        if (!tab)
            throw new Error("No active tab found");

        chrome.tabs.sendMessage(
            tab.id,
            {
                action: "getPriceAndSend",
                data: {
                    action: actionType,
                    tradeId: tradeId,
                    tradingViewId,
                    direction,
                    entry,
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
                logDebug("Raw response object:\n" + JSON.stringify(response, null, 2));

                let server = response.server_response;

                if (typeof server === "string") {
                    try { server = JSON.parse(server); } catch {}
                }

                logDebug("Server Response Parsed:\n" + JSON.stringify(server, null, 2));

                const statusValue = server?.status?.toLowerCase();

                const isSuccess =
                    response.success &&
                    (statusValue === "ok" || statusValue === "success");

                statusEl.innerText = isSuccess
                    ? "Sent successfully"
                    : "Failed";

                if (isSuccess) {

                    const p = response.payload;

                    logDebug(
                        "Sent successfully\n\n" +
                        "Action: " + p.action + "\n" +
                        "Trade ID: " + p.tradeId + "\n" +
                        "TradingView ID: " + p.tradingview_id + "\n" +
                        "Symbol: " + p.symbol + "\n" +
                        "Exchange: " + p.exchange + "\n" +
                        "Direction: " + p.direction + "\n" +
                        "Entry Level: " + p.entry + "\n" +
                        "Stop Loss: " + p.stop_loss + "\n" +
                        "Take Profit: " + p.take_profit + "\n" +
                        "Current Price: " + p.current_price + "\n" +
                        "Timestamp: " + p.timestamp,

                        response.server_response
                    );

                } else {
                    logDebug(
                        "Server Response:\n" +
                        JSON.stringify(response.server_response, null, 2)
                    );
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

/* -----------------------------
   Initialize
----------------------------- */
document.addEventListener("DOMContentLoaded", () => {
    injectForms();
    setupTabs();
    loadTabDefaults("add");
    loadSymbol();
});