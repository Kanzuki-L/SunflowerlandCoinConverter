export class NetworkService {
    constructor() {}

    async fetchData(url) {
        try {
            let fetchUrl = url;
            if (url.includes('sfl.world')) {
                fetchUrl = 'https://corsproxy.io/?' + encodeURIComponent(url);
            } else {
                fetchUrl = url + '?t=' + Date.now();
            }

            const res = await fetch(fetchUrl);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            if (url.includes('.ts')) {
                const text = await res.text();
                return { content: text };
            } else {
                return await res.json();
            }
        } catch (e) {
            console.error(`Fetch Error (${url}):`, e);
            if (!fetchUrl.includes('corsproxy.io') && url.includes('github')) {
                return this.fetchData('https://corsproxy.io/?' + encodeURIComponent(url));
            }
            throw e;
        }
    }
}