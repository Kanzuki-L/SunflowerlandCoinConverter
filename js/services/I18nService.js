import { zhCN, enUS } from '../config/translations.js';

export class I18nService {
    constructor() {
        this.dictionaries = {
            'zh': zhCN,
            'en': enUS
            // add new language here, i.e: 'jp': jaJP,
        };

        this.currentLang = localStorage.getItem('sfl_lang') || 'en'; // set default as en
    }

    setLanguage(langCode) {
        if (this.dictionaries[langCode]) {
            this.currentLang = langCode;
            localStorage.setItem('sfl_lang', langCode);
        }
    }

    t(key) {
        const dict = this.dictionaries[this.currentLang];
        
        if (dict && dict[key]) {
            return dict[key];
        }
        return key;
    }
    
    getLang() {
        return this.currentLang;
    }
}