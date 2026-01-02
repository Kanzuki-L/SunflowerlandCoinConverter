export class AnalyticsService {
    constructor() {
        this.isReady = typeof window.gtag === 'function';
    }

    logEvent(eventName, params = {}) {
        if (this.isReady) {
            window.gtag('event', eventName, params);
        } else {
            // console.log(`[Analytics] ${eventName}`, params);
        }
    }
}