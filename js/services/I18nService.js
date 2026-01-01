import { zhCN } from '../config/translations.js';

export class I18nService {
    constructor() {
        this.currentLang = 'zh';
        this.dictionary = zhCN;
    }

    toggleLanguage() {
        this.currentLang = this.currentLang === 'zh' ? 'en' : 'zh';
        return this.currentLang;
    }

    t(key) {
        if (this.currentLang === 'en') {
            return key; 
        }
        return this.dictionary[key] || key;
    }
    
    getLang() {
        return this.currentLang;
    }
}