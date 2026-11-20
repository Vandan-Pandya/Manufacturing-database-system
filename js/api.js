import { INITIAL_DATA } from './data.js';

const STORAGE_KEY = 'DBMS_PROD_SYSTEM_DATA_V1';
const CONFIG_KEY = 'DBMS_PROD_SYSTEM_CONFIG_V1';

export class DataService {
    constructor() {
        this.config = this.loadConfig();
        this.data = this.loadData();
        this.dbStatus = { connected: false, database: 'Manufacturing System', tables: [], error: null };
    }

    loadConfig() {
        const saved = localStorage.getItem(CONFIG_KEY);
        if (saved) {
            try { 
                const parsed = JSON.parse(saved);
                return {
                    mode: 'api',
                    apiBaseUrl: '/api',
                    ...parsed
                };
            } catch (e) { 
                console.error(e); 
            }
        }
        return {
            mode: 'api', // 'local' | 'api'
            apiBaseUrl: '/api'
        };
    }

    saveConfig(config) {
        this.config = { ...this.config, ...config };
        localStorage.setItem(CONFIG_KEY, JSON.stringify(this.config));
    }

    loadData() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error("Error loading local storage data:", e);
            }
        }
        // If not found, clone INITIAL_DATA and persist
        const cloned = JSON.parse(JSON.stringify(INITIAL_DATA));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cloned));
        return cloned;
    }

    saveData() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    }

    resetData() {
        this.data = JSON.parse(JSON.stringify(INITIAL_DATA));
        this.saveData();
        return this.data;
    }

    exportJSON() {
        return JSON.stringify(this.data, null, 2);
    }

    importJSON(jsonString) {
        try {
            const parsed = JSON.parse(jsonString);
            const requiredKeys = ['customers', 'suppliers', 'raw_materials', 'work_centers', 'products', 'bill_of_materials', 'production_orders', 'production_logs'];
            for (const k of requiredKeys) {
                if (!Array.isArray(parsed[k])) {
                    throw new Error(`Missing or invalid collection array: ${k}`);
                }
            }
            this.data = parsed;
            this.saveData();
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    // Sync all tables from PostgreSQL
    async syncFromDatabase() {
        try {
            // First check status
            const statusRes = await fetch(`${this.config.apiBaseUrl}/status`);
            if (statusRes.ok) {
                this.dbStatus = await statusRes.json();
            }

            if (this.dbStatus.connected) {
                const dataRes = await fetch(`${this.config.apiBaseUrl}/data`);
                if (dataRes.ok) {
                    const dbData = await dataRes.json();
                    if (dbData && typeof dbData === 'object' && !dbData.error) {
                        for (const key of Object.keys(dbData)) {
                            if (Array.isArray(dbData[key])) {
                                this.data[key] = dbData[key];
                            }
                        }
                        if (Array.isArray(this.data.work_centers)) {
                            this.data.work_centers.forEach(w => {
                                if (w.status && w.status.toLowerCase() === 'active') {
                                    w.status = 'Operational';
                                } else if (w.status && w.status.toLowerCase() === 'inactive') {
                                    w.status = 'Offline';
                                }
                            });
                        }
                        this.saveData();
                        return { success: true, connected: true, status: this.dbStatus };
                    }
                }
            }
        } catch (e) {
            console.warn("Could not sync with PostgreSQL backend:", e);
            this.dbStatus = { connected: false, error: e.message };
        }
        return { success: false, connected: false, status: this.dbStatus };
    }

    async saveDbConfig(password, dbName = 'Manufacturing System', user = 'postgres') {
        try {
            const res = await fetch(`${this.config.apiBaseUrl}/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password, database: dbName, user })
            });
            const status = await res.json();
            this.dbStatus = status;
            if (status.connected) {
                await this.syncFromDatabase();
            }
            return status;
        } catch (e) {
            return { connected: false, error: e.message };
        }
    }

    // Generic CRUD Methods
    async getAll(entityKey) {
        if (this.config.mode === 'api' && this.dbStatus.connected) {
            try {
                const res = await fetch(`${this.config.apiBaseUrl}/${entityKey}`);
                if (res.ok) {
                    const items = await res.json();
                    if (Array.isArray(items)) {
                        this.data[entityKey] = items;
                        this.saveData();
                        return items;
                    }
                }
            } catch (e) {
                console.warn(`API fetch for ${entityKey} failed, falling back to cached/local:`, e);
            }
        }
        return this.data[entityKey] || [];
    }

    async getById(entityKey, idField, idValue) {
        const list = await this.getAll(entityKey);
        return list.find(item => String(item[idField]) === String(idValue)) || null;
    }

    async create(entityKey, record) {
        if (this.config.mode === 'api' && this.dbStatus.connected) {
            try {
                const res = await fetch(`${this.config.apiBaseUrl}/${entityKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(record)
                });
                if (res.ok) {
                    const created = await res.json();
                    if (!this.data[entityKey]) this.data[entityKey] = [];
                    this.data[entityKey].unshift(created);
                    this.saveData();
                    return created;
                }
            } catch (e) {
                console.warn(`API create for ${entityKey} failed, saving locally:`, e);
            }
        }
        if (!this.data[entityKey]) this.data[entityKey] = [];
        this.data[entityKey].unshift(record);
        this.saveData();
        return record;
    }

    async update(entityKey, idField, idValue, updatedFields) {
        if (this.config.mode === 'api' && this.dbStatus.connected) {
            try {
                const res = await fetch(`${this.config.apiBaseUrl}/${entityKey}/${idValue}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedFields)
                });
                if (res.ok) {
                    const updated = await res.json();
                    const index = this.data[entityKey]?.findIndex(item => String(item[idField]) === String(idValue));
                    if (index !== -1 && index !== undefined) {
                        this.data[entityKey][index] = updated;
                        this.saveData();
                        return updated;
                    }
                }
            } catch (e) {
                console.warn(`API update for ${entityKey} failed, saving locally:`, e);
            }
        }
        const index = this.data[entityKey]?.findIndex(item => String(item[idField]) === String(idValue));
        if (index !== -1 && index !== undefined) {
            this.data[entityKey][index] = { ...this.data[entityKey][index], ...updatedFields };
            this.saveData();
            return this.data[entityKey][index];
        }
        throw new Error(`Record with ${idField} = ${idValue} not found in ${entityKey}`);
    }

    async delete(entityKey, idField, idValue) {
        if (this.config.mode === 'api' && this.dbStatus.connected) {
            try {
                const res = await fetch(`${this.config.apiBaseUrl}/${entityKey}/${idValue}`, {
                    method: 'DELETE'
                });
                if (res.ok) {
                    this.data[entityKey] = (this.data[entityKey] || []).filter(item => String(item[idField]) !== String(idValue));
                    this.saveData();
                    return true;
                }
            } catch (e) {
                console.warn(`API delete for ${entityKey} failed, updating locally:`, e);
            }
        }
        const initialLen = this.data[entityKey]?.length || 0;
        this.data[entityKey] = (this.data[entityKey] || []).filter(item => String(item[idField]) !== String(idValue));
        this.saveData();
        return this.data[entityKey].length < initialLen;
    }

    // Analytics and Relational Computed Aggregations
    getStats() {
        const productsCount = this.data.products?.length || 0;
        const activeOrders = (this.data.production_orders || []).filter(o => o.status === 'In Progress').length;
        const totalOrders = this.data.production_orders?.length || 0;
        const rawMaterialsCount = this.data.raw_materials?.length || 0;
        const totalInventoryValue = (this.data.raw_materials || []).reduce((sum, item) => sum + (Number(item.stock) * Number(item.unit_cost)), 0);
        const operationalWorkCenters = (this.data.work_centers || []).filter(w => (w.status || '').toLowerCase() === 'operational').length;
        const totalWorkCenters = this.data.work_centers?.length || 0;
        const lowStockMaterials = (this.data.raw_materials || []).filter(m => Number(m.stock) < 300).length;

        return {
            productsCount,
            activeOrders,
            totalOrders,
            rawMaterialsCount,
            totalInventoryValue,
            operationalWorkCenters,
            activeWorkCenters: operationalWorkCenters,
            totalWorkCenters,
            lowStockMaterials,
            customersCount: this.data.customers?.length || 0,
            suppliersCount: this.data.suppliers?.length || 0,
            totalLogs: this.data.production_logs?.length || 0
        };
    }

    getOrderProgress(orderId) {
        const logs = (this.data.production_logs || []).filter(l => String(l.order_id) === String(orderId));
        const totalCompleted = logs.reduce((sum, l) => sum + Number(l.units_completed || 0), 0);
        const totalHours = logs.reduce((sum, l) => sum + Number(l.labour_hours || 0), 0);
        const order = (this.data.production_orders || []).find(o => String(o.order_id) === String(orderId));
        const target = order ? Number(order.target) : 0;
        const percentage = target > 0 ? Math.min(100, Math.round((totalCompleted / target) * 100)) : 0;
        return {
            totalCompleted,
            totalHours,
            target,
            percentage,
            remaining: Math.max(0, target - totalCompleted)
        };
    }

    getProductBOM(prodId) {
        const bomItems = (this.data.bill_of_materials || []).filter(b => String(b.prod_id) === String(prodId));
        return bomItems.map(item => {
            const mat = (this.data.raw_materials || []).find(m => String(m.material_id) === String(item.material_id));
            return {
                ...item,
                material_name: mat ? mat.material_name : 'Unknown Material',
                unit_cost: mat ? mat.unit_cost : 0,
                stock: mat ? mat.stock : 0
            };
        });
    }

    getSupplierMaterials(suppId) {
        return (this.data.raw_materials || []).filter(m => String(m.supp_id) === String(suppId));
    }
}

export const db = new DataService();
