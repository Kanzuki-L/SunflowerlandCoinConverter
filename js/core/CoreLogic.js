export class CoreLogic {
    constructor() {
        this.categories = {
            'Crops': ["Sunflower", "Potato", "Pumpkin", "Carrot", "Cabbage", "Beetroot", "Cauliflower", "Parsnip", "Eggplant", "Corn", "Radish", "Wheat", "Kale", "Soybean", "Barley", "Rhubarb", "Zucchini", "Yam", "Broccoli", "Pepper", "Onion", "Turnip", "Artichoke"],
            'Fruits': ["Apple", "Blueberry", "Orange", "Banana", "Tomato", "Lemon", "Celestine", "Lunara", "Duskberry"],
            'Greenhouse': ["Grape", "Rice", "Olive"]
        };
    }

    Calculate(p2pData, shopData, isBonus5, isBonus10) {
        let items = [];
        const sourceP2P = p2pData?.data?.p2p || p2pData?.p2p || p2pData || {};
        
        const shopMap = new Map();
        Object.keys(shopData).forEach(k => shopMap.set(k.toLowerCase().trim(), shopData[k]));

        const allKeys = new Set([...this.categories.Crops, ...this.categories.Fruits, ...this.categories.Greenhouse]);
        
        allKeys.forEach(name => {
            const lowerName = name.toLowerCase();
            const p2pKey = Object.keys(sourceP2P).find(k => k.toLowerCase() === lowerName);
            const p2pPrice = p2pKey ? parseFloat(sourceP2P[p2pKey]) : 0;
            const shopInfo = shopMap.get(lowerName) || { sellPrice: 0, xp: 0 };

            if (shopInfo.sellPrice > 0 || shopInfo.xp > 0 || p2pPrice > 0) {
                let cat = 'Other';
                if (this.categories.Crops.includes(name)) cat = 'Crops';
                else if (this.categories.Fruits.includes(name)) cat = 'Fruits';
                else if (this.categories.Greenhouse.includes(name)) cat = 'Greenhouse';

                let finalSellPrice = shopInfo.sellPrice;
                if (cat === 'Crops') {
                    if (isBonus5) finalSellPrice = finalSellPrice * 1.05;
                    if (isBonus10) finalSellPrice = finalSellPrice * 1.10;
                }

                const safeP2P = p2pPrice > 0 ? p2pPrice : 0;
                let ratio = 0;
                if (finalSellPrice > 0 && safeP2P > 0) {
                    ratio = finalSellPrice / safeP2P;
                }

                let efficiency = 0;
                if (shopInfo.xp > 0 && safeP2P > 0) {
                    efficiency = shopInfo.xp / safeP2P;
                }

                items.push({
                    name: name,
                    category: cat,
                    originalP2p: safeP2P,
                    p2p: safeP2P,
                    isCustom: false,
                    xp: shopInfo.xp,
                    sellPrice: finalSellPrice,
                    efficiency: efficiency,
                    ratio: ratio
                });
            }
        });
        return items;
    }

    RecalculateItem(item) {
        if (item.p2p > 0) {
            item.ratio = item.sellPrice > 0 ? item.sellPrice / item.p2p : 0;
            item.efficiency = item.xp > 0 ? item.xp / item.p2p : 0;
        } else {
            item.ratio = 0;
            item.efficiency = 0;
        }
        return item;
    }
}