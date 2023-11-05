// background.js
var CACHED_DOMAIN = {};
// receive message from popup.js
chrome.runtime.onMessage.addListener((data, sender, sendResponse) => {
    if (data.cmd === 'get_ip_data') {
        let domain = data.domain
        let cachedHost = CACHED_DOMAIN[domain]
        if (cachedHost) {
            console.log('cache hit --->', domain, cachedHost)
            sendResponse({
                'domain': domain,
                'ip': cachedHost.ip,
                'country': cachedHost.country,
                'prov': cachedHost.prov,
                'city': cachedHost.city,
                'isp': cachedHost.isp
            })
        } else {
            console.log('cache miss --->', domain)
            console.log('check CACHED_DOMAIN status:', CACHED_DOMAIN)
        }
    }
})

// listen tabs.onUpdated event -> reload page/open new tab
chrome.tabs.onUpdated.addListener((id, changeInfo, tab) => {
    if (tab.status === "loading") {
        updateBrowserAction(id, tab.url);
    }
})

// listen tabs.onCreated event -> open new tab
chrome.tabs.onActivated.addListener((activeInfo) => {
    if (activeInfo.tabId) {
        chrome.tabs.get(activeInfo.tabId, (tab) => {
            updateBrowserAction(tab.id, tab.url);
        })
    }
})

// add context menu item -> get domain whois
chrome.contextMenus.create({
    'id': 'query_whois',
    'title': 'Search Domain Whois Data',
    'contexts': ['page'],
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'query_whois') {
        let checkURL = info.linkUrl || info.pageUrl || info.srcUrl || null;
        if (checkURL && checkURL.indexOf('http') === 0) {
            let domain = getHostname(checkURL);
            let searchURL = 'https://www.whois.com/whois/' + domain;
            chrome.tabs.create({ 'url': searchURL });
        }
    }
});


// dnslookup domain to ip 
function dnsLookup(hostname, callback) {
    fetch('https://geonet.shodan.io/api/dns/' + hostname)
        .then(response => {
            if (response.ok) {
                return response.json()
            } else {
                deleteCache(hostname)
                throw new Error(response.statusText)
            }
        })
        .then(data => {
            if (data['answers']) {
                callback(data['answers'][0]['value'])
            }
        })
        .catch(error => {
            deleteCache(hostname)
        })
}

// get ip information for baidu
function hostLookup(domain, ip, callback) {
    fetch('https://qifu-api.baidubce.com/ip/geo/v1/district?ip=' + ip)
        .then(response => {
            if (response.ok) {
                return response.json()
            } else {
                deleteCache(domain)
                throw new Error(response.statusText)
            }
        })
        .then(data => {
            callback(data)
        })
        .catch(error => {
            deleteCache(domain)
        })
}

// save data to memory
function saveCache(domain, response) {
    console.log("save cache --->", domain, response)
    let smallerHost = {
        domain: domain,
        ip: response.ip,
        country: response.data ? response.data.country : undefined,
        prov: response.data ? response.data.prov : undefined,
        city: response.data ? response.data.city : undefined,
        isp: response.data ? response.data.isp : undefined
    };
    CACHED_DOMAIN[domain] = smallerHost
}


function deleteCache(domain) {
    delete CACHED_DOMAIN[domain]
}

function getHostname(url) {
    let urlObject = new URL(url);
    let domain = urlObject.hostname
    return domain
}


// check input is ipv4
function isIP(input) {
    const ipv4Regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipv4Regex.test(input);
}

// check ip is private IP
function isPrivateIP(ip) {
    return ip.match(/^10\./) || ip.match(/^192\.168\./) || ip.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./);
}

function updateBrowserAction(tabID, url) {
    chrome.action.setBadgeText({ 'text': '' })
    if (url.indexOf('http') !== 0) {
        chrome.action.disable(tabID)
        return
    }
    let domain = getHostname(url)
    let cached = CACHED_DOMAIN[domain]
    if (cached) {
        if (cached == 'fetching') {
            return
        }
        chrome.action.setBadgeText({ 'text': '1' })
        return
    }
    if (isIP(domain)) {
        if (isPrivateIP(domain)) {
            console.log('private ip bypass: ', domain)
            chrome.action.disable(tabID)
            return
        } else {
            hostLookup(domain, domain, (response) => {
                saveCache(domain, response)
                chrome.action.setBadgeText({ 'text': '1' })
            })
            return
        }
    }

    CACHED_DOMAIN[domain] = 'fetching'
    dnsLookup(domain, (ip) => {
        hostLookup(domain, ip, (response) => {
            saveCache(domain, response)
            chrome.action.setBadgeText({ 'text': '1' })
        })
    })
}
