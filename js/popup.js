// popup.js
function renderPopup(data) {
    document.getElementById('domain').innerText = data.domain;
    document.getElementById('ip').innerText = data.ip;
    document.getElementById('isp').innerText = data.isp;
    const country = data.country || '';
    const prov = data.prov || '';
    const city = data.city || '';
    document.getElementById('location').innerText = `${country} ${prov} ${city}`;
}

function getHostname(url) {
    let elem = document.createElement('a')
    elem.href = url
    return elem.hostname
}

// if extension is onclicked send a message to background.js
chrome.tabs.query({ active: true, lastFocusedWindow: true }, tabs => {
    let currentTab = tabs[0]
    if (currentTab) {
        let domain = getHostname(currentTab.url)
        chrome.runtime.sendMessage({
            'cmd': 'get_ip_data',
            'domain': domain,
        }, renderPopup)

    }
});