document.getElementById("sendTrade").addEventListener("click", async () => {

    const direction = document.getElementById("direction").value;
    const sl = document.getElementById("sl").value;
    const tp = document.getElementById("tp").value;
    const url = document.getElementById("url").value;
    const method = document.getElementById("method").value;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.tabs.sendMessage(
        tab.id,
        {
            action: "getPriceAndSend",
            data: { direction, sl, tp, url, method }
        },
        (response) => {
            if (response?.status) {
                document.getElementById("status").innerText = response.status;
            }
        }
    );
});
