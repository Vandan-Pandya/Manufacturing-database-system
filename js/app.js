import { db } from './api.js?v=2.1';
import { Icons, showToast, openModal, closeModal, formatCurrency, renderStatusBadge } from './components.js?v=2.1';

class App {
    constructor() {
        this.currentView = 'dashboard';
        this.searchQuery = '';
        this.orderStatusFilter = 'ALL';
        this.wcStatusFilter = 'ALL';
        this.selectedBOMProdId = null;
        this.init();
    }

    async init() {
        this.bindEvents();
        this.renderSidebarNav();
        const syncRes = await db.syncFromDatabase();
        this.updateDbStatus(syncRes);
        this.renderSidebarNav();
        this.navigate(this.currentView);
    }

    updateDbStatus(syncRes) {
        const pill = document.querySelector('.db-status-pill');
        if (!pill) return;
        if (syncRes && syncRes.connected) {
            pill.innerHTML = `
                <span class="db-status-dot" style="background:#10b981; box-shadow:0 0 8px #10b981;"></span>
                <span>PostgreSQL: Connected (${syncRes.status?.database || 'Manufacturing System'})</span>
            `;
            pill.title = 'Connected to PostgreSQL database';
        } else {
            pill.innerHTML = `
                <span class="db-status-dot" style="background:#f59e0b; box-shadow:0 0 8px #f59e0b;"></span>
                <span style="cursor:pointer;" id="db-connect-prompt">Configure Connection</span>
            `;
            pill.title = syncRes?.status?.error || 'Click to configure PostgreSQL connection';
            const promptBtn = document.getElementById('db-connect-prompt');
            if (promptBtn) {
                promptBtn.addEventListener('click', () => this.showDbConfigModal());
            }
        }
    }

    showDbConfigModal() {
        const modalHtml = `
            <div style="padding: 1.5rem;">
                <h3 style="margin-top:0; margin-bottom: 0.5rem; display:flex; align-items:center; gap:0.5rem;">
                    ${Icons.database} PostgreSQL Database Connection
                </h3>
                <p style="color:var(--text-muted); font-size:0.875rem; margin-bottom:1.25rem;">
                    Enter your PostgreSQL password to sync live tables directly from <strong>Manufacturing System</strong>.
                </p>
                <div style="margin-bottom:1rem;">
                    <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:0.35rem;">Database Name</label>
                    <input type="text" id="modal-db-name" value="Manufacturing System" style="width:100%; padding:0.6rem; border-radius:6px; border:1px solid var(--border); background:var(--bg-surface); color:var(--text-main);" />
                </div>
                <div style="margin-bottom:1rem;">
                    <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:0.35rem;">Username</label>
                    <input type="text" id="modal-db-user" value="postgres" style="width:100%; padding:0.6rem; border-radius:6px; border:1px solid var(--border); background:var(--bg-surface); color:var(--text-main);" />
                </div>
                <div style="margin-bottom:1.5rem;">
                    <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:0.35rem;">PostgreSQL Password</label>
                    <input type="password" id="modal-db-pass" placeholder="Enter password used in pgAdmin" style="width:100%; padding:0.6rem; border-radius:6px; border:1px solid var(--border); background:var(--bg-surface); color:var(--text-main);" />
                </div>
                <div style="display:flex; justify-content:flex-end; gap:0.75rem;">
                    <button class="btn-secondary" id="modal-cancel-btn">Cancel</button>
                    <button class="btn-primary" id="modal-connect-btn">Connect & Sync</button>
                </div>
                <div id="modal-status-msg" style="margin-top:1rem; font-size:0.85rem;"></div>
            </div>
        `;
        openModal('PostgreSQL Connection Settings', modalHtml);
        document.getElementById('modal-cancel-btn')?.addEventListener('click', closeModal);
        document.getElementById('modal-connect-btn')?.addEventListener('click', async () => {
            const pass = document.getElementById('modal-db-pass').value;
            const dbName = document.getElementById('modal-db-name').value;
            const user = document.getElementById('modal-db-user').value;
            const statusMsg = document.getElementById('modal-status-msg');
            statusMsg.innerHTML = '<span style="color:var(--text-muted);">Connecting to PostgreSQL...</span>';
            const res = await db.saveDbConfig(pass, dbName, user);
            if (res.connected) {
                statusMsg.innerHTML = '<span style="color:#10b981; font-weight:600;">Connected to PostgreSQL. Syncing records...</span>';
                setTimeout(() => {
                    closeModal();
                    this.updateDbStatus({ connected: true, status: res });
                    this.renderSidebarNav();
                    this.refreshCurrentView();
                    showToast('Connected to PostgreSQL: ' + (res.database || 'Manufacturing System'));
                }, 1000);
            } else {
                statusMsg.innerHTML = `<span style="color:#ef4444; font-weight:600;">Connection failed: ${res.error || 'Check password'}</span>`;
            }
        });
    }

    bindEvents() {
        // Theme Switcher
        const themeBtn = document.getElementById('theme-toggle-btn');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
                const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
                document.documentElement.setAttribute('data-theme', nextTheme);
                themeBtn.innerHTML = nextTheme === 'dark' ? Icons.sun : Icons.moon;
            });
        }

        // Global Quick Search
        const searchInput = document.getElementById('global-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.toLowerCase().trim();
                this.refreshCurrentView();
            });
        }

        // Reset Data action
        const resetBtn = document.getElementById('btn-reset-db');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (confirm('Reset all DBMS tables to default seed data?')) {
                    db.resetData();
                    showToast('Database reset to default seed records.');
                    this.refreshCurrentView();
                }
            });
        }

        // Quick New Record global button
        const quickAddBtn = document.getElementById('btn-quick-add');
        if (quickAddBtn) {
            quickAddBtn.addEventListener('click', () => {
                this.handleQuickAdd();
            });
        }
    }

    renderSidebarNav() {
        const navSections = [
            {
                title: 'Overview & Insights',
                items: [
                    { id: 'dashboard', label: 'Dashboard', icon: Icons.dashboard, count: null },
                    { id: 'analytics', label: 'Analytics', icon: Icons.analytics, count: null }
                ]
            },
            {
                title: 'Production Management',
                items: [
                    { id: 'products', label: 'Products', icon: Icons.products, count: () => db.data.products?.length },
                    { id: 'bill_of_materials', label: 'Bill of Materials', icon: Icons.bom, count: () => db.data.bill_of_materials?.length },
                    { id: 'production_orders', label: 'Production Orders', icon: Icons.orders, count: () => db.data.production_orders?.length },
                    { id: 'shopfloor_kanban', label: 'Order Pipeline', icon: Icons.kanban, count: () => (db.data.production_orders || []).filter(o => o.status === 'In Progress').length },
                    { id: 'production_logs', label: 'Shift Logs', icon: Icons.logs, count: () => db.data.production_logs?.length }
                ]
            },
            {
                title: 'Supply & Facilities',
                items: [
                    { id: 'raw_materials', label: 'Raw Materials', icon: Icons.rawMaterials, count: () => db.data.raw_materials?.length },
                    { id: 'work_centers', label: 'Work Centers', icon: Icons.workCenters, count: () => db.data.work_centers?.length },
                    { id: 'suppliers', label: 'Suppliers', icon: Icons.suppliers, count: () => db.data.suppliers?.length },
                    { id: 'customers', label: 'Customers', icon: Icons.customers, count: () => db.data.customers?.length }
                ]
            },
            {
                title: 'System Architecture',
                items: [
                    { id: 'er_diagram', label: 'Database Schema', icon: Icons.erDiagram, count: '8 Tables' }
                ]
            }
        ];

        const container = document.getElementById('sidebar-nav-container');
        if (!container) return;

        container.innerHTML = navSections.map(section => `
            <div class="nav-section-title">${section.title}</div>
            <ul class="nav-list">
                ${section.items.map(item => this.createNavItem(item)).join('')}
            </ul>
        `).join('<div style="height: 0.5rem;"></div>');

        // Bind clicks
        container.querySelectorAll('.nav-item-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.getAttribute('data-target');
                this.navigate(target);
            });
        });
    }

    createNavItem(item) {
        const countVal = typeof item.count === 'function' ? item.count() : item.count;
        const isActive = this.currentView === item.id;
        return `
            <li>
                <button class="nav-item-btn ${isActive ? 'active' : ''}" data-target="${item.id}">
                    ${item.icon}
                    <span>${item.label}</span>
                    ${countVal !== null && countVal !== undefined ? `<span class="nav-badge">${countVal}</span>` : ''}
                </button>
            </li>
        `;
    }

    navigate(viewId, params = {}) {
        this.currentView = viewId;
        this.renderSidebarNav();
        const main = document.getElementById('page-content');
        if (!main) return;

        window.scrollTo({ top: 0, behavior: 'smooth' });

        switch (viewId) {
            case 'dashboard':
                this.renderDashboard(main);
                break;
            case 'analytics':
                this.renderAnalyticsView(main);
                break;
            case 'products':
                this.renderProductsView(main);
                break;
            case 'bill_of_materials':
                if (params.prodId) this.selectedBOMProdId = params.prodId;
                this.renderBOMView(main);
                break;
            case 'production_orders':
                this.renderOrdersView(main);
                break;
            case 'shopfloor_kanban':
                this.renderKanbanView(main);
                break;
            case 'production_logs':
                this.renderLogsView(main);
                break;
            case 'raw_materials':
                this.renderRawMaterialsView(main);
                break;
            case 'work_centers':
                this.renderWorkCentersView(main);
                break;
            case 'suppliers':
                this.renderSuppliersView(main);
                break;
            case 'customers':
                this.renderCustomersView(main);
                break;
            case 'er_diagram':
                this.renderERDiagramView(main);
                break;
            default:
                this.renderDashboard(main);
        }
    }

    refreshCurrentView() {
        this.navigate(this.currentView);
    }

    // ==========================================
    // 1. DASHBOARD VIEW (Clean Executive Overview)
    // ==========================================
    renderDashboard(container) {
        const stats = db.getStats();
        const activeOrders = (db.data.production_orders || []).filter(o => o.status === 'In Progress');

        container.innerHTML = `
            <div class="page-header">
                <div>
                    <h1 class="page-title">Operations Dashboard</h1>
                    <p class="page-subtitle">Overview of production orders, inventory valuation, and facility status</p>
                </div>
                <div class="header-actions">
                    <button class="btn-primary" id="dash-create-order-btn">${Icons.plus} Schedule Order</button>
                    <button class="btn-secondary" id="dash-log-shift-btn">${Icons.logs} Log Shift</button>
                </div>
            </div>

            <!-- 4 Vibrant KPI Cards -->
            <div class="kpi-grid">
                <div class="kpi-card card-blue">
                    <div class="kpi-header">
                        <span class="kpi-title">Active Production</span>
                        <div class="kpi-icon">${Icons.orders}</div>
                    </div>
                    <div class="kpi-value">${stats.activeOrders} <span style="font-size: 0.95rem; font-weight: 500; color: var(--text-muted);">/ ${stats.totalOrders} Scheduled</span></div>
                    <div class="kpi-footer">
                        <span class="kpi-trend">● In Progress</span>
                    </div>
                </div>

                <div class="kpi-card card-emerald">
                    <div class="kpi-header">
                        <span class="kpi-title">Inventory Valuation</span>
                        <div class="kpi-icon">${Icons.rawMaterials}</div>
                    </div>
                    <div class="kpi-value">${formatCurrency(stats.totalInventoryValue)}</div>
                    <div class="kpi-footer">
                        <span class="kpi-trend">${stats.rawMaterialsCount} Materials Stocked</span>
                    </div>
                </div>

                <div class="kpi-card card-cyan">
                    <div class="kpi-header">
                        <span class="kpi-title">Work Centers Operational</span>
                        <div class="kpi-icon">${Icons.workCenters}</div>
                    </div>
                    <div class="kpi-value">${stats.activeWorkCenters} <span style="font-size: 0.95rem; font-weight: 500; color: var(--text-muted);">/ ${stats.totalWorkCenters} Online</span></div>
                    <div class="kpi-footer">
                        <span class="kpi-trend">Capacity Optimal</span>
                    </div>
                </div>

                <div class="kpi-card card-purple">
                    <div class="kpi-header">
                        <span class="kpi-title">Catalog Products</span>
                        <div class="kpi-icon">${Icons.products}</div>
                    </div>
                    <div class="kpi-value">${stats.productsCount}</div>
                    <div class="kpi-footer">
                        <span class="kpi-trend">Active BOM Recipes</span>
                    </div>
                </div>
            </div>

            <!-- Clean 2-Column Overview (Active Orders + Operations Launchpad) -->
            <div class="analytics-grid">
                <!-- Column 1: Ongoing Production Orders -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">${Icons.orders} Active Production Orders</h3>
                        <button class="btn-secondary" style="font-size: 0.75rem; padding: 0.35rem 0.75rem;" onclick="window.app.navigate('production_orders')">View All Orders &rarr;</button>
                    </div>
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Order ID</th>
                                    <th>Product</th>
                                    <th>Target</th>
                                    <th>Progress</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(db.data.production_orders || []).slice(0, 5).map(order => {
                                    const prod = (db.data.products || []).find(p => String(p.prod_id) === String(order.prod_id));
                                    const progress = db.getOrderProgress(order.order_id);
                                    return `
                                        <tr>
                                            <td><span class="pk-pill">${Icons.key} ${order.order_id}</span></td>
                                            <td><strong>${prod ? prod.prod_name : order.prod_id}</strong></td>
                                            <td>${order.target} pcs</td>
                                            <td style="min-width: 140px;">
                                                <div style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 4px;">
                                                    <span>${progress.totalCompleted} / ${order.target}</span>
                                                    <span>${progress.percentage}%</span>
                                                </div>
                                                <div class="progress-container">
                                                    <div class="progress-fill ${progress.percentage >= 100 ? 'success' : ''}" style="width: ${progress.percentage}%"></div>
                                                </div>
                                            </td>
                                            <td>${renderStatusBadge(order.status)}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Column 2: Operations Quick Launchpad -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">${Icons.dashboard} Quick Actions</h3>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 0.85rem;">
                        <div class="kanban-card" style="cursor: pointer;" onclick="window.app.navigate('analytics')">
                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                <div style="display: flex; align-items: center; gap: 0.6rem; font-weight: 600; color: var(--accent-primary);">
                                    ${Icons.analytics} Operations Analytics
                                </div>
                                <span style="font-size: 0.75rem; color: var(--text-muted);">&rarr;</span>
                            </div>
                            <div style="font-size: 0.78rem; color: var(--text-muted);">View line utilization, order fulfillment ratios & yield metrics</div>
                        </div>

                        <div class="kanban-card" style="cursor: pointer;" onclick="window.app.navigate('shopfloor_kanban')">
                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                <div style="display: flex; align-items: center; gap: 0.6rem; font-weight: 600; color: var(--accent-warning);">
                                    ${Icons.kanban} Production Pipeline
                                </div>
                                <span style="font-size: 0.75rem; color: var(--text-muted);">&rarr;</span>
                            </div>
                            <div style="font-size: 0.78rem; color: var(--text-muted);">Manage stages: Pending &rarr; In Progress &rarr; QC &rarr; Completed</div>
                        </div>

                        <div class="kanban-card" style="cursor: pointer;" onclick="window.app.navigate('bill_of_materials')">
                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                <div style="display: flex; align-items: center; gap: 0.6rem; font-weight: 600; color: var(--accent-secondary);">
                                    ${Icons.bom} Bill of Materials (BOM) Explorer
                                </div>
                                <span style="font-size: 0.75rem; color: var(--text-muted);">&rarr;</span>
                            </div>
                            <div style="font-size: 0.78rem; color: var(--text-muted);">Inspect recipe cost breakdowns and component margins</div>
                        </div>

                        <div class="kanban-card" style="cursor: pointer;" onclick="window.app.navigate('raw_materials')">
                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                <div style="display: flex; align-items: center; gap: 0.6rem; font-weight: 600; color: var(--accent-success);">
                                    ${Icons.rawMaterials} Raw Materials Inventory
                                </div>
                                <span style="font-size: 0.75rem; color: var(--text-muted);">&rarr;</span>
                            </div>
                            <div style="font-size: 0.78rem; color: var(--text-secondary);">${stats.lowStockMaterials > 0 ? `<span style="color: var(--status-danger-text); font-weight: 500;">${stats.lowStockMaterials} items below reorder threshold</span>` : 'Stock levels normal'}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('dash-create-order-btn').onclick = () => this.openOrderModal();
        document.getElementById('dash-log-shift-btn').onclick = () => this.openAddLogModal();
    }

    // ==========================================
    // 2. OPERATIONS ANALYTICS VIEW (NEW Dedicated Page)
    // ==========================================
    renderAnalyticsView(container) {
        const stats = db.getStats();
        const orders = db.data.production_orders || [];
        const logs = db.data.production_logs || [];
        const workCenters = db.data.work_centers || [];
        const materials = db.data.raw_materials || [];

        // Calculated Analytics
        const completedOrders = orders.filter(o => o.status === 'Completed').length;
        const inProgressOrders = orders.filter(o => o.status === 'In Progress').length;
        const qcOrders = orders.filter(o => o.status === 'Quality Check').length;
        const pendingOrders = orders.filter(o => o.status === 'Pending').length;
        const completionRate = orders.length > 0 ? Math.round((completedOrders / orders.length) * 100) : 0;

        const totalHours = logs.reduce((sum, l) => sum + Number(l.labour_hours || 0), 0);
        const totalUnits = logs.reduce((sum, l) => sum + Number(l.units_completed || 0), 0);
        const productivityRate = totalHours > 0 ? (totalUnits / totalHours).toFixed(1) : 0;

        const operationalWc = workCenters.filter(w => w.status === 'Operational').length;
        const plantUtilization = workCenters.length > 0 ? Math.round((operationalWc / workCenters.length) * 100) : 0;

        // Top materials by capital investment
        const sortedMaterials = [...materials].sort((a, b) => (b.stock * b.unit_cost) - (a.stock * a.unit_cost)).slice(0, 5);

        container.innerHTML = `
            <div class="page-header">
                <div>
                    <h1 class="page-title">Operations & Factory Analytics</h1>
                    <p class="page-subtitle">Real-time performance metrics, schedule fulfillment, work center utilization, and inventory allocation</p>
                </div>
                <div class="header-actions">
                    <button class="btn-secondary" onclick="window.print()">Print Report</button>
                    <button class="btn-primary" onclick="window.app.navigate('shopfloor_kanban')">Open Kanban &rarr;</button>
                </div>
            </div>

            <!-- 4 Vibrant Analytical Highlights -->
            <div class="kpi-grid">
                <div class="stat-metric-box metric-blue">
                    <span class="label">Schedule Fulfillment Rate</span>
                    <span class="val" style="color: var(--blue-base);">${completionRate}%</span>
                    <span style="font-size: 0.78rem; color: var(--text-muted);">${completedOrders} of ${orders.length} orders completed</span>
                </div>

                <div class="stat-metric-box metric-emerald">
                    <span class="label">Plant Machinery Utilization</span>
                    <span class="val" style="color: var(--emerald-base);">${plantUtilization}%</span>
                    <span style="font-size: 0.78rem; color: var(--text-muted);">${operationalWc} of ${workCenters.length} centers operational</span>
                </div>

                <div class="stat-metric-box metric-amber">
                    <span class="label">Shift Production Yield</span>
                    <span class="val" style="color: var(--amber-base);">${productivityRate} <span style="font-size: 0.9rem; font-weight: 500;">pcs/hr</span></span>
                    <span style="font-size: 0.78rem; color: var(--text-muted);">${totalUnits} units across ${totalHours} logged hours</span>
                </div>

                <div class="stat-metric-box metric-purple">
                    <span class="label">Total Raw Capital Invested</span>
                    <span class="val" style="color: var(--purple-base);">${formatCurrency(stats.totalInventoryValue)}</span>
                    <span style="font-size: 0.78rem; color: var(--text-muted);">${materials.length} material classes</span>
                </div>
            </div>

            <!-- 2-Column Analytics Breakdown -->
            <div class="analytics-grid">
                <!-- Left: Production Schedule Distribution -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Order Status Distribution</h3>
                        <span style="font-size: 0.78rem; color: var(--text-muted);">${orders.length} Total Orders</span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 1.25rem;">
                        <div>
                            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.35rem;">
                                <span>Completed Orders</span>
                                <span>${completedOrders} (${orders.length ? Math.round((completedOrders / orders.length) * 100) : 0}%)</span>
                            </div>
                            <div class="progress-container" style="height: 10px;">
                                <div class="progress-fill success" style="width: ${orders.length ? (completedOrders / orders.length) * 100 : 0}%;"></div>
                            </div>
                        </div>

                        <div>
                            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.35rem;">
                                <span>In Progress (Assembly)</span>
                                <span>${inProgressOrders} (${orders.length ? Math.round((inProgressOrders / orders.length) * 100) : 0}%)</span>
                            </div>
                            <div class="progress-container" style="height: 10px;">
                                <div class="progress-fill" style="width: ${orders.length ? (inProgressOrders / orders.length) * 100 : 0}%;"></div>
                            </div>
                        </div>

                        <div>
                            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.35rem;">
                                <span>Quality Inspection (QC)</span>
                                <span>${qcOrders} (${orders.length ? Math.round((qcOrders / orders.length) * 100) : 0}%)</span>
                            </div>
                            <div class="progress-container" style="height: 10px;">
                                <div class="progress-fill" style="background: var(--accent-purple); width: ${orders.length ? (qcOrders / orders.length) * 100 : 0}%;"></div>
                            </div>
                        </div>

                        <div>
                            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.35rem;">
                                <span>Pending Scheduling</span>
                                <span>${pendingOrders} (${orders.length ? Math.round((pendingOrders / orders.length) * 100) : 0}%)</span>
                            </div>
                            <div class="progress-container" style="height: 10px;">
                                <div class="progress-fill" style="background: var(--accent-warning); width: ${orders.length ? (pendingOrders / orders.length) * 100 : 0}%;"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Right: Top Material Investments -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Material Inventory by Value</h3>
                        <button class="btn-secondary" style="font-size: 0.75rem; padding: 0.35rem 0.75rem;" onclick="window.app.navigate('raw_materials')">Inventory &rarr;</button>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 0.85rem;">
                        ${sortedMaterials.map(m => {
                            const val = m.stock * m.unit_cost;
                            const pct = stats.totalInventoryValue > 0 ? Math.round((val / stats.totalInventoryValue) * 100) : 0;
                            return `
                                <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                                    <div style="display: flex; justify-content: space-between; font-size: 0.85rem;">
                                        <strong>${m.material_name}</strong>
                                        <span style="font-weight: 700; color: var(--accent-primary);">${formatCurrency(val)} (${pct}%)</span>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted);">
                                        <span>Stock: ${m.stock} units</span>
                                        <span>Cost: ${formatCurrency(m.unit_cost)}/unit</span>
                                    </div>
                                </div>
                            `;
                        }).join('<hr style="border: 0; border-top: 1px solid var(--border-color); margin: 0.2rem 0;">')}
                    </div>
                </div>
            </div>
        `;
    }

    // ==========================================
    // 3. PRODUCTS CATALOG VIEW (Clean Dedicated Page)
    // ==========================================
    renderProductsView(container) {
        let items = db.data.products || [];
        if (this.searchQuery) {
            items = items.filter(p =>
                String(p.prod_id || '').toLowerCase().includes(this.searchQuery) ||
                String(p.prod_name || '').toLowerCase().includes(this.searchQuery)
            );
        }

        container.innerHTML = `
            <div class="page-header">
                <div>
                    <h1 class="page-title">Products Catalog</h1>
                    <p class="page-subtitle">Entity: <code>Products(prod_id, prod_name, unit_price, stock, centre_id)</code></p>
                </div>
                <div class="header-actions">
                    <button class="btn-primary" id="btn-add-product">${Icons.plus} Add New Product</button>
                </div>
            </div>

            <div class="toolbar-container">
                <div class="filter-group">
                    <span style="font-size: 0.85rem; color: var(--text-muted);">Total Products: <strong>${items.length}</strong></span>
                </div>
                <div>
                    <button class="btn-secondary" style="font-size: 0.8rem;" id="btn-export-products">Export CSV</button>
                </div>
            </div>

            <div class="card" style="padding: 0;">
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Product ID (PK)</th>
                                <th>Product Name</th>
                                <th>Unit Selling Price</th>
                                <th>Finished Stock</th>
                                <th>Work Center (FK)</th>
                                <th>Recipe & Materials</th>
                                <th style="text-align: right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.length === 0 ? `<tr><td colspan="7" style="text-align:center; padding: 2rem; color: var(--text-muted);">No products found matching your search.</td></tr>` :
                            items.map(p => {
                                const wc = (db.data.work_centers || []).find(w => String(w.centre_id) === String(p.centre_id));
                                const bomList = db.getProductBOM(p.prod_id);
                                const totalBOMCost = bomList.reduce((sum, b) => sum + Number(b.money), 0);

                                return `
                                    <tr>
                                        <td><span class="pk-pill">${Icons.key} ${p.prod_id}</span></td>
                                        <td><strong>${p.prod_name}</strong></td>
                                        <td><span style="color: var(--accent-success); font-weight: 600;">${formatCurrency(p.unit_price)}</span></td>
                                        <td>
                                            <span style="font-weight: 600; color: ${p.stock < 30 ? 'var(--accent-danger)' : 'inherit'};">
                                                ${p.stock} units
                                            </span>
                                        </td>
                                        <td>
                                            ${p.centre_id ? `
                                                <span class="fk-pill" title="${wc ? wc.centre_name : ''}">${Icons.link} ${p.centre_id}</span>
                                                <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 4px;">(${wc ? wc.centre_name : 'N/A'})</span>
                                            ` : '<span style="color: var(--text-subtle);">None</span>'}
                                        </td>
                                        <td>
                                            <button class="btn-secondary" style="font-size: 0.75rem; padding: 0.25rem 0.6rem;" onclick="window.app.navigate('bill_of_materials', { prodId: '${p.prod_id}' })">
                                                ${Icons.bom} ${bomList.length} Components (${formatCurrency(totalBOMCost)}) &rarr;
                                            </button>
                                        </td>
                                        <td style="text-align: right;">
                                            <div class="action-btns" style="justify-content: flex-end;">
                                                <button class="action-btn" title="Edit Product" onclick="window.app.openProductModal('${p.prod_id}')">${Icons.edit}</button>
                                                <button class="action-btn delete" title="Delete Product" onclick="window.app.deleteProduct('${p.prod_id}')">${Icons.delete}</button>
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        document.getElementById('btn-add-product').onclick = () => this.openProductModal();
        document.getElementById('btn-export-products').onclick = () => this.exportEntityCSV('products');
    }

    // ==========================================
    // 4. BILL OF MATERIALS (BOM) - Dedicated Explorer & Recipe Hub
    // ==========================================
    renderBOMView(container) {
        const products = db.data.products || [];
        if (!this.selectedBOMProdId && products.length > 0) {
            this.selectedBOMProdId = products[0].prod_id;
        }

        const selectedProd = products.find(p => String(p.prod_id) === String(this.selectedBOMProdId));
        const bomItems = selectedProd ? db.getProductBOM(selectedProd.prod_id) : [];
        const totalMaterialCost = bomItems.reduce((sum, b) => sum + Number(b.money), 0);
        const sellingPrice = selectedProd ? Number(selectedProd.unit_price) : 0;
        const grossMargin = sellingPrice - totalMaterialCost;
        const marginPct = sellingPrice > 0 ? ((grossMargin / sellingPrice) * 100).toFixed(1) : 0;

        let allBOM = db.data.bill_of_materials || [];
        if (this.searchQuery) {
            allBOM = allBOM.filter(b =>
                String(b.bom_id || '').toLowerCase().includes(this.searchQuery) ||
                String(b.prod_id || '').toLowerCase().includes(this.searchQuery) ||
                String(b.material_id || '').toLowerCase().includes(this.searchQuery)
            );
        }

        container.innerHTML = `
            <div class="page-header">
                <div>
                    <h1 class="page-title">Bill of Materials (BOM) Explorer</h1>
                    <p class="page-subtitle">Entity: <code>Bill_of_Material(bom_id, prod_id, material_id, money)</code></p>
                </div>
                <div class="header-actions">
                    <button class="btn-primary" id="btn-add-bom">${Icons.plus} Add BOM Association</button>
                </div>
            </div>

            <!-- Part 1: Interactive Product Recipe Analyzer -->
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">${Icons.bom} Product Recipe Cost Breakdown</h3>
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">Select Product:</span>
                        <select class="form-control" style="font-size: 0.85rem; padding: 0.35rem 0.75rem;" id="bom-product-selector">
                            ${products.map(p => `
                                <option value="${p.prod_id}" ${String(p.prod_id) === String(this.selectedBOMProdId) ? 'selected' : ''}>
                                    ${p.prod_id} - ${p.prod_name}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                </div>

                <!-- Financial Metrics Strip -->
                <div class="kpi-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
                    <div class="stat-metric-box">
                        <span class="label">Unit Selling Price</span>
                        <span class="val" style="color: var(--accent-success);">${formatCurrency(sellingPrice)}</span>
                    </div>
                    <div class="stat-metric-box">
                        <span class="label">Total Material Cost</span>
                        <span class="val" style="color: var(--accent-primary);">${formatCurrency(totalMaterialCost)}</span>
                    </div>
                    <div class="stat-metric-box">
                        <span class="label">Gross Profit Margin</span>
                        <span class="val" style="color: ${grossMargin >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)'};">${formatCurrency(grossMargin)}</span>
                        <span style="font-size: 0.75rem; color: var(--text-muted);">${marginPct}% margin</span>
                    </div>
                    <div class="stat-metric-box">
                        <span class="label">Component Materials</span>
                        <span class="val" style="color: var(--accent-purple);">${bomItems.length}</span>
                        <span style="font-size: 0.75rem; color: var(--text-muted);">Required raw materials</span>
                    </div>
                </div>

                <!-- Active Recipe Table -->
                <div class="table-responsive" style="margin-top: 0.5rem;">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>BOM ID</th>
                                <th>Material Name (FK)</th>
                                <th>Allocated Cost / Material</th>
                                <th>In-Stock Quantity</th>
                                <th style="text-align: right;">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${bomItems.length === 0 ? `<tr><td colspan="5" style="text-align:center; padding: 1.5rem; color: var(--text-muted);">No raw materials configured for this product yet.</td></tr>` :
                            bomItems.map(b => `
                                <tr>
                                    <td><span class="pk-pill">${Icons.key} ${b.bom_id}</span></td>
                                    <td>
                                        <strong>${b.material_name}</strong>
                                        <div><span class="fk-pill">${Icons.link} ${b.material_id}</span></div>
                                    </td>
                                    <td><strong style="color: var(--accent-primary);">${formatCurrency(b.money)}</strong></td>
                                    <td>${b.stock} units</td>
                                    <td style="text-align: right;">
                                        <button class="action-btn delete" title="Remove Component" onclick="window.app.deleteBOM('${b.bom_id}')">${Icons.delete}</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <div style="display: flex; justify-content: flex-end; margin-top: 0.5rem;">
                    <button class="btn-secondary" style="font-size: 0.8rem;" onclick="window.app.openBOMModal(null, '${this.selectedBOMProdId}')">
                        ${Icons.plus} Add Material to this Recipe
                    </button>
                </div>
            </div>

            <!-- Part 2: All BOM Specifications Master Table -->
            <div class="card" style="padding: 0; margin-top: 1rem;">
                <div class="card-header" style="padding: 1.25rem 1.5rem;">
                    <h3 class="card-title">BOM Specifications (${allBOM.length} total links)</h3>
                    <button class="btn-secondary" style="font-size: 0.8rem;" id="btn-export-bom">Export CSV</button>
                </div>
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>BOM ID (PK)</th>
                                <th>Product (FK: prod_id)</th>
                                <th>Raw Material (FK: material_id)</th>
                                <th>Allocated Money</th>
                                <th style="text-align: right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${allBOM.length === 0 ? `<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">No BOM records found.</td></tr>` :
                            allBOM.map(b => {
                                const prod = products.find(p => String(p.prod_id) === String(b.prod_id));
                                const mat = (db.data.raw_materials || []).find(m => String(m.material_id) === String(b.material_id));
                                return `
                                    <tr>
                                        <td><span class="pk-pill">${Icons.key} ${b.bom_id}</span></td>
                                        <td>
                                            <strong>${prod ? prod.prod_name : b.prod_id}</strong>
                                            <div><span class="fk-pill">${Icons.link} ${b.prod_id}</span></div>
                                        </td>
                                        <td>
                                            <strong>${mat ? mat.material_name : b.material_id}</strong>
                                            <div><span class="fk-pill">${Icons.link} ${b.material_id}</span></div>
                                        </td>
                                        <td><strong style="color: var(--accent-primary);">${formatCurrency(b.money)}</strong></td>
                                        <td style="text-align: right;">
                                            <div class="action-btns" style="justify-content: flex-end;">
                                                <button class="action-btn" title="Edit BOM Entry" onclick="window.app.openBOMModal('${b.bom_id}')">${Icons.edit}</button>
                                                <button class="action-btn delete" title="Delete BOM Entry" onclick="window.app.deleteBOM('${b.bom_id}')">${Icons.delete}</button>
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        document.getElementById('bom-product-selector').onchange = (e) => {
            this.selectedBOMProdId = e.target.value;
            this.renderBOMView(container);
        };
        document.getElementById('btn-add-bom').onclick = () => this.openBOMModal();
        document.getElementById('btn-export-bom').onclick = () => this.exportEntityCSV('bill_of_materials');
    }

    // ==========================================
    // 5. PRODUCTION ORDERS TABLE VIEW
    // ==========================================
    renderOrdersView(container) {
        let items = db.data.production_orders || [];

        if (this.orderStatusFilter !== 'ALL') {
            items = items.filter(o => o.status === this.orderStatusFilter);
        }

        if (this.searchQuery) {
            items = items.filter(o =>
                String(o.order_id || '').toLowerCase().includes(this.searchQuery) ||
                String(o.prod_id || '').toLowerCase().includes(this.searchQuery) ||
                String(o.status || '').toLowerCase().includes(this.searchQuery)
            );
        }

        container.innerHTML = `
            <div class="page-header">
                <div>
                    <h1 class="page-title">Production Orders Schedule</h1>
                    <p class="page-subtitle">Entity: <code>Production_Orders(order_id, prod_id, target, start_date, completion_date, status)</code></p>
                </div>
                <div class="header-actions">
                    <button class="btn-secondary" onclick="window.app.navigate('shopfloor_kanban')">${Icons.kanban} Open Kanban Board</button>
                    <button class="btn-primary" id="btn-add-order">${Icons.plus} Schedule New Order</button>
                </div>
            </div>

            <!-- Clean Filter Toolbar with Status Pills -->
            <div class="toolbar-container">
                <div class="filter-pills">
                    <button class="filter-pill-btn ${this.orderStatusFilter === 'ALL' ? 'active' : ''}" onclick="window.app.setOrderStatusFilter('ALL')">All Orders (${db.data.production_orders?.length || 0})</button>
                    <button class="filter-pill-btn ${this.orderStatusFilter === 'Pending' ? 'active' : ''}" onclick="window.app.setOrderStatusFilter('Pending')">Pending</button>
                    <button class="filter-pill-btn ${this.orderStatusFilter === 'In Progress' ? 'active' : ''}" onclick="window.app.setOrderStatusFilter('In Progress')">In Progress</button>
                    <button class="filter-pill-btn ${this.orderStatusFilter === 'Quality Check' ? 'active' : ''}" onclick="window.app.setOrderStatusFilter('Quality Check')">Quality Check</button>
                    <button class="filter-pill-btn ${this.orderStatusFilter === 'Completed' ? 'active' : ''}" onclick="window.app.setOrderStatusFilter('Completed')">Completed</button>
                </div>
                <div>
                    <button class="btn-secondary" style="font-size: 0.8rem;" id="btn-export-orders">Export CSV</button>
                </div>
            </div>

            <div class="card" style="padding: 0;">
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Order ID (PK)</th>
                                <th>Scheduled Product (FK: prod_id)</th>
                                <th>Target Units</th>
                                <th>Start Date</th>
                                <th>Target Completion</th>
                                <th>Production Progress</th>
                                <th>Status</th>
                                <th style="text-align: right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.length === 0 ? `<tr><td colspan="8" style="text-align:center; padding: 2rem; color: var(--text-muted);">No production orders found matching the filter.</td></tr>` :
                            items.map(o => {
                                const prod = (db.data.products || []).find(p => String(p.prod_id) === String(o.prod_id));
                                const progress = db.getOrderProgress(o.order_id);
                                return `
                                    <tr>
                                        <td><span class="pk-pill">${Icons.key} ${o.order_id}</span></td>
                                        <td>
                                            <strong>${prod ? prod.prod_name : o.prod_id}</strong>
                                            <div><span class="fk-pill">${Icons.link} ${o.prod_id}</span></div>
                                        </td>
                                        <td><strong>${o.target}</strong> units</td>
                                        <td>${o.start_date}</td>
                                        <td>${o.completion_date || '<span style="color: var(--text-subtle);">Ongoing</span>'}</td>
                                        <td style="min-width: 150px;">
                                            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 4px;">
                                                <span>${progress.totalCompleted} / ${o.target} units</span>
                                                <span>${progress.percentage}%</span>
                                            </div>
                                            <div class="progress-container">
                                                <div class="progress-fill ${progress.percentage >= 100 ? 'success' : ''}" style="width: ${progress.percentage}%"></div>
                                            </div>
                                        </td>
                                        <td>
                                            <select class="form-control" style="padding: 0.2rem 0.5rem; font-size: 0.78rem;" onchange="window.app.updateOrderStatus('${o.order_id}', this.value)">
                                                <option value="Pending" ${o.status === 'Pending' ? 'selected' : ''}>Pending</option>
                                                <option value="In Progress" ${o.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                                                <option value="Quality Check" ${o.status === 'Quality Check' ? 'selected' : ''}>Quality Check</option>
                                                <option value="Completed" ${o.status === 'Completed' ? 'selected' : ''}>Completed</option>
                                                <option value="Cancelled" ${o.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                                            </select>
                                        </td>
                                        <td style="text-align: right;">
                                            <div class="action-btns" style="justify-content: flex-end;">
                                                <button class="action-btn" title="Add Shift Log" onclick="window.app.openAddLogModal('${o.order_id}')">${Icons.plus}</button>
                                                <button class="action-btn" title="Edit Order" onclick="window.app.openOrderModal('${o.order_id}')">${Icons.edit}</button>
                                                <button class="action-btn delete" title="Delete Order" onclick="window.app.deleteOrder('${o.order_id}')">${Icons.delete}</button>
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        document.getElementById('btn-add-order').onclick = () => this.openOrderModal();
        document.getElementById('btn-export-orders').onclick = () => this.exportEntityCSV('production_orders');
    }

    setOrderStatusFilter(filter) {
        this.orderStatusFilter = filter;
        const main = document.getElementById('page-content');
        if (main) this.renderOrdersView(main);
    }

    // ==========================================
    // 6. SHOPFLOOR KANBAN BOARD (NEW Dedicated Page)
    // ==========================================
    renderKanbanView(container) {
        const orders = db.data.production_orders || [];
        const stages = [
            { id: 'Pending', label: 'Pending', next: 'In Progress', nextLabel: 'Start Assembly →' },
            { id: 'In Progress', label: 'Assembly', next: 'Quality Check', nextLabel: 'Send to QC →' },
            { id: 'Quality Check', label: 'Quality Inspection', next: 'Completed', nextLabel: 'Complete' },
            { id: 'Completed', label: 'Completed', next: null, nextLabel: null }
        ];

        container.innerHTML = `
            <div class="page-header">
                <div>
                    <h1 class="page-title">Production Pipeline</h1>
                    <p class="page-subtitle">Visual workflow board tracking orders through Pending, Assembly, Inspection, and Final Completion</p>
                </div>
                <div class="header-actions">
                    <button class="btn-secondary" onclick="window.app.navigate('production_orders')">Table View</button>
                    <button class="btn-primary" onclick="window.app.openOrderModal()">${Icons.plus} Schedule Order</button>
                </div>
            </div>

            <div class="kanban-board">
                ${stages.map(stage => {
                    const stageOrders = orders.filter(o => o.status === stage.id);
                    return `
                        <div class="kanban-column">
                            <div class="kanban-column-header">
                                <span>${stage.label}</span>
                                <span class="nav-badge">${stageOrders.length}</span>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 0.85rem; flex: 1;">
                                ${stageOrders.length === 0 ? `<div style="text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 2rem 0;">No orders in this stage</div>` :
                                stageOrders.map(o => {
                                    const prod = (db.data.products || []).find(p => String(p.prod_id) === String(o.prod_id));
                                    const progress = db.getOrderProgress(o.order_id);
                                    return `
                                        <div class="kanban-card">
                                            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                                <span class="pk-pill">${Icons.key} ${o.order_id}</span>
                                                <span style="font-size: 0.72rem; color: var(--text-muted);">${o.start_date}</span>
                                            </div>
                                            <div style="font-weight: 700; font-size: 0.92rem; margin-top: 0.2rem;">
                                                ${prod ? prod.prod_name : o.prod_id}
                                            </div>
                                            <div style="font-size: 0.78rem; color: var(--text-muted);">
                                                Target: <strong>${o.target} units</strong>
                                            </div>
                                            <div>
                                                <div style="display: flex; justify-content: space-between; font-size: 0.72rem; margin-bottom: 3px;">
                                                    <span>Done: ${progress.totalCompleted}</span>
                                                    <span>${progress.percentage}%</span>
                                                </div>
                                                <div class="progress-container" style="height: 6px;">
                                                    <div class="progress-fill ${progress.percentage >= 100 ? 'success' : ''}" style="width: ${progress.percentage}%"></div>
                                                </div>
                                            </div>
                                            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--border-color);">
                                                <button class="btn-secondary" style="font-size: 0.72rem; padding: 0.2rem 0.5rem;" onclick="window.app.openAddLogModal('${o.order_id}')">
                                                    + Log Shift
                                                </button>
                                                ${stage.next ? `
                                                    <button class="btn-primary" style="font-size: 0.72rem; padding: 0.2rem 0.6rem;" onclick="window.app.updateOrderStatus('${o.order_id}', '${stage.next}')">
                                                        ${stage.nextLabel}
                                                    </button>
                                                ` : `<span style="font-size: 0.72rem; color: var(--accent-success); font-weight: 700;">Done</span>`}
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    // ==========================================
    // 7. SHIFT PRODUCTION LOGS VIEW
    // ==========================================
    renderLogsView(container) {
        let items = db.data.production_logs || [];
        if (this.searchQuery) {
            items = items.filter(l =>
                String(l.log_id || '').toLowerCase().includes(this.searchQuery) ||
                String(l.order_id || '').toLowerCase().includes(this.searchQuery)
            );
        }

        const totalHours = items.reduce((sum, l) => sum + Number(l.labour_hours || 0), 0);
        const totalUnits = items.reduce((sum, l) => sum + Number(l.units_completed || 0), 0);
        const avgYield = totalHours > 0 ? (totalUnits / totalHours).toFixed(1) : 0;

        container.innerHTML = `
            <div class="page-header">
                <div>
                    <h1 class="page-title">Shift Production Logs</h1>
                    <p class="page-subtitle">Entity: <code>Production_Logs(log_id, order_id, labour_hours, units_completed, updated_at)</code></p>
                </div>
                <div class="header-actions">
                    <button class="btn-primary" id="btn-add-log">${Icons.plus} Record Shift Output</button>
                </div>
            </div>

            <!-- Summary KPI Strip -->
            <div class="kpi-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
                <div class="stat-metric-box">
                    <span class="label">Total Labour Hours</span>
                    <span class="val" style="color: var(--accent-warning);">${totalHours.toFixed(1)} <span style="font-size: 0.9rem; font-weight: 500;">hrs</span></span>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">Across all shifts</span>
                </div>
                <div class="stat-metric-box">
                    <span class="label">Total Units Completed</span>
                    <span class="val" style="color: var(--accent-success);">${totalUnits} <span style="font-size: 0.9rem; font-weight: 500;">pcs</span></span>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">Inspected output</span>
                </div>
                <div class="stat-metric-box">
                    <span class="label">Average Productivity</span>
                    <span class="val" style="color: var(--accent-primary);">${avgYield} <span style="font-size: 0.9rem; font-weight: 500;">pcs/hr</span></span>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">Production throughput</span>
                </div>
                <div class="stat-metric-box">
                    <span class="label">Total Shift Entries</span>
                    <span class="val" style="color: var(--accent-purple);">${items.length}</span>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">Recorded shift logs</span>
                </div>
            </div>

            <div class="toolbar-container" style="margin-top: 1rem;">
                <div class="filter-group">
                    <span style="font-size: 0.85rem; color: var(--text-muted);">Showing <strong>${items.length}</strong> shift entries</span>
                </div>
                <div>
                    <button class="btn-secondary" style="font-size: 0.8rem;" id="btn-export-logs">Export CSV</button>
                </div>
            </div>

            <div class="card" style="padding: 0;">
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Log ID (PK)</th>
                                <th>Order ID (FK)</th>
                                <th>Product Details</th>
                                <th>Shift Labour Hours</th>
                                <th>Units Completed</th>
                                <th>Recorded Timestamp</th>
                                <th style="text-align: right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.length === 0 ? `<tr><td colspan="7" style="text-align:center; padding: 2rem; color: var(--text-muted);">No shift logs found.</td></tr>` :
                            items.map(l => {
                                const order = (db.data.production_orders || []).find(o => String(o.order_id) === String(l.order_id));
                                const prod = order ? (db.data.products || []).find(p => String(p.prod_id) === String(order.prod_id)) : null;
                                return `
                                    <tr>
                                        <td><span class="pk-pill">${Icons.key} ${l.log_id}</span></td>
                                        <td>
                                            <span class="fk-pill">${Icons.link} ${l.order_id}</span>
                                        </td>
                                        <td>
                                            <strong>${prod ? prod.prod_name : 'Unknown Product'}</strong>
                                        </td>
                                        <td><strong style="color: var(--accent-warning);">${l.labour_hours} hrs</strong></td>
                                        <td><strong style="color: var(--accent-success);">${l.units_completed} pcs</strong></td>
                                        <td style="font-size: 0.8rem; color: var(--text-muted);">${l.updated_at || 'Just now'}</td>
                                        <td style="text-align: right;">
                                            <div class="action-btns" style="justify-content: flex-end;">
                                                <button class="action-btn" title="Edit Log" onclick="window.app.openAddLogModal('${l.order_id}', '${l.log_id}')">${Icons.edit}</button>
                                                <button class="action-btn delete" title="Delete Log" onclick="window.app.deleteLog('${l.log_id}')">${Icons.delete}</button>
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        document.getElementById('btn-add-log').onclick = () => this.openAddLogModal();
        document.getElementById('btn-export-logs').onclick = () => this.exportEntityCSV('production_logs');
    }

    // ==========================================
    // 8. RAW MATERIALS INVENTORY VIEW
    // ==========================================
    renderRawMaterialsView(container) {
        let items = db.data.raw_materials || [];
        if (this.searchQuery) {
            items = items.filter(m =>
                String(m.material_id || '').toLowerCase().includes(this.searchQuery) ||
                String(m.material_name || '').toLowerCase().includes(this.searchQuery)
            );
        }

        const totalValuation = items.reduce((sum, m) => sum + (Number(m.stock) * Number(m.unit_cost)), 0);
        const lowStockCount = items.filter(m => Number(m.stock) < 300).length;

        container.innerHTML = `
            <div class="page-header">
                <div>
                    <h1 class="page-title">Raw Materials Inventory</h1>
                    <p class="page-subtitle">Entity: <code>Raw_Material(material_id, material_name, stock, unit_cost, supp_id)</code></p>
                </div>
                <div class="header-actions">
                    <button class="btn-primary" id="btn-add-material">${Icons.plus} Add Raw Material</button>
                </div>
            </div>

            <!-- Low Stock Banner -->
            ${lowStockCount > 0 ? `
                <div class="alert-banner">
                    <span><strong>Notice:</strong> ${lowStockCount} raw materials are currently below the safe reserve threshold (< 300 units).</span>
                    <button class="btn-secondary" style="font-size: 0.75rem; padding: 0.25rem 0.6rem;" onclick="window.app.navigate('suppliers')">Contact Suppliers &rarr;</button>
                </div>
            ` : ''}

            <!-- KPI Strip -->
            <div class="kpi-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
                <div class="stat-metric-box">
                    <span class="label">Total Raw Inventory Value</span>
                    <span class="val" style="color: var(--accent-success);">${formatCurrency(totalValuation)}</span>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">Current warehouse assets</span>
                </div>
                <div class="stat-metric-box">
                    <span class="label">Material SKU Count</span>
                    <span class="val" style="color: var(--accent-primary);">${items.length}</span>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">Cataloged items</span>
                </div>
                <div class="stat-metric-box">
                    <span class="label">Low Stock Alerts</span>
                    <span class="val" style="color: ${lowStockCount > 0 ? 'var(--accent-danger)' : 'var(--accent-success)'};">${lowStockCount}</span>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">${lowStockCount > 0 ? 'Action recommended' : 'All stocks sufficient'}</span>
                </div>
            </div>

            <div class="toolbar-container" style="margin-top: 1rem;">
                <div class="filter-group">
                    <span style="font-size: 0.85rem; color: var(--text-muted);">Active Materials: <strong>${items.length}</strong></span>
                </div>
                <div>
                    <button class="btn-secondary" style="font-size: 0.8rem;" id="btn-export-materials">Export CSV</button>
                </div>
            </div>

            <div class="card" style="padding: 0;">
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Material ID (PK)</th>
                                <th>Material Name</th>
                                <th>Current Stock</th>
                                <th>Unit Cost</th>
                                <th>Total Value</th>
                                <th>Supplier (FK: supp_id)</th>
                                <th style="text-align: right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.length === 0 ? `<tr><td colspan="7" style="text-align:center; padding: 2rem; color: var(--text-muted);">No materials found.</td></tr>` :
                            items.map(m => {
                                const supp = (db.data.suppliers || []).find(s => String(s.supp_id) === String(m.supp_id));
                                const isLowStock = Number(m.stock) < 300;
                                return `
                                    <tr>
                                        <td><span class="pk-pill">${Icons.key} ${m.material_id}</span></td>
                                        <td><strong>${m.material_name}</strong></td>
                                        <td>
                                            <span style="display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 600;">
                                                <strong style="color: ${isLowStock ? 'var(--accent-danger)' : 'var(--accent-success)'};">${m.stock}</strong> units
                                                ${isLowStock ? '<span style="font-size: 0.7rem; background: #fee2e2; color: #b91c1c; padding: 1px 5px; border-radius: 4px;">Low</span>' : ''}
                                            </span>
                                        </td>
                                        <td>${formatCurrency(m.unit_cost)}</td>
                                        <td><strong style="color: var(--accent-primary);">${formatCurrency(m.stock * m.unit_cost)}</strong></td>
                                        <td>
                                            ${m.supp_id ? `
                                                <span class="fk-pill" title="${supp ? supp.company_name : ''}">${Icons.link} ${m.supp_id}</span>
                                                <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 4px;">(${supp ? supp.company_name : 'N/A'})</span>
                                            ` : '<span style="color: var(--text-subtle);">None</span>'}
                                        </td>
                                        <td style="text-align: right;">
                                            <div class="action-btns" style="justify-content: flex-end;">
                                                <button class="action-btn" title="Edit Material" onclick="window.app.openMaterialModal('${m.material_id}')">${Icons.edit}</button>
                                                <button class="action-btn delete" title="Delete Material" onclick="window.app.deleteMaterial('${m.material_id}')">${Icons.delete}</button>
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        document.getElementById('btn-add-material').onclick = () => this.openMaterialModal();
        document.getElementById('btn-export-materials').onclick = () => this.exportEntityCSV('raw_materials');
    }

    // ==========================================
    // 9. WORK CENTERS VIEW
    // ==========================================
    renderWorkCentersView(container) {
        let items = db.data.work_centers || [];

        if (this.wcStatusFilter !== 'ALL') {
            items = items.filter(w => w.status === this.wcStatusFilter);
        }

        if (this.searchQuery) {
            items = items.filter(w =>
                String(w.centre_id || '').toLowerCase().includes(this.searchQuery) ||
                String(w.centre_name || '').toLowerCase().includes(this.searchQuery) ||
                String(w.location || '').toLowerCase().includes(this.searchQuery)
            );
        }

        const operationalCount = (db.data.work_centers || []).filter(w => w.status === 'Operational').length;

        container.innerHTML = `
            <div class="page-header">
                <div>
                    <h1 class="page-title">Work Centers & Machinery</h1>
                    <p class="page-subtitle">Entity: <code>Work_Center(centre_id, centre_name, hourly_rate, status, location)</code></p>
                </div>
                <div class="header-actions">
                    <button class="btn-primary" id="btn-add-wc">${Icons.plus} Add Work Center</button>
                </div>
            </div>

            <!-- Filter Pills -->
            <div class="toolbar-container">
                <div class="filter-pills">
                    <button class="filter-pill-btn ${this.wcStatusFilter === 'ALL' ? 'active' : ''}" onclick="window.app.setWCStatusFilter('ALL')">All Centers (${db.data.work_centers?.length || 0})</button>
                    <button class="filter-pill-btn ${this.wcStatusFilter === 'Operational' ? 'active' : ''}" onclick="window.app.setWCStatusFilter('Operational')">Operational (${operationalCount})</button>
                    <button class="filter-pill-btn ${this.wcStatusFilter === 'Maintenance' ? 'active' : ''}" onclick="window.app.setWCStatusFilter('Maintenance')">Maintenance</button>
                    <button class="filter-pill-btn ${this.wcStatusFilter === 'Idle' ? 'active' : ''}" onclick="window.app.setWCStatusFilter('Idle')">Idle</button>
                </div>
                <div>
                    <button class="btn-secondary" style="font-size: 0.8rem;" id="btn-export-wc">Export CSV</button>
                </div>
            </div>

            <div class="card" style="padding: 0;">
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Center ID (PK)</th>
                                <th>Work Center Name</th>
                                <th>Hourly Operating Rate</th>
                                <th>Machine Status</th>
                                <th>Plant Floor Location</th>
                                <th>Assigned Products</th>
                                <th style="text-align: right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.length === 0 ? `<tr><td colspan="7" style="text-align:center; padding: 2rem; color: var(--text-muted);">No work centers found.</td></tr>` :
                            items.map(w => {
                                const assignedProducts = (db.data.products || []).filter(p => String(p.centre_id) === String(w.centre_id));
                                return `
                                    <tr>
                                        <td><span class="pk-pill">${Icons.key} ${w.centre_id}</span></td>
                                        <td><strong>${w.centre_name}</strong></td>
                                        <td><strong style="color: var(--accent-warning);">${formatCurrency(w.hourly_rate)}/hr</strong></td>
                                        <td>${renderStatusBadge(w.status)}</td>
                                        <td>${w.location}</td>
                                        <td>
                                            <span class="nav-badge" style="background: var(--bg-tertiary); color: var(--text-main);">
                                                ${assignedProducts.length} Products
                                            </span>
                                        </td>
                                        <td style="text-align: right;">
                                            <div class="action-btns" style="justify-content: flex-end;">
                                                <button class="action-btn" title="Edit Center" onclick="window.app.openWorkCenterModal('${w.centre_id}')">${Icons.edit}</button>
                                                <button class="action-btn delete" title="Delete Center" onclick="window.app.deleteWorkCenter('${w.centre_id}')">${Icons.delete}</button>
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        document.getElementById('btn-add-wc').onclick = () => this.openWorkCenterModal();
        document.getElementById('btn-export-wc').onclick = () => this.exportEntityCSV('work_centers');
    }

    setWCStatusFilter(filter) {
        this.wcStatusFilter = filter;
        const main = document.getElementById('page-content');
        if (main) this.renderWorkCentersView(main);
    }

    // ==========================================
    // 10. SUPPLIERS VIEW
    // ==========================================
    renderSuppliersView(container) {
        let items = db.data.suppliers || [];
        if (this.searchQuery) {
            items = items.filter(s =>
                String(s.supp_id || '').toLowerCase().includes(this.searchQuery) ||
                String(s.company_name || '').toLowerCase().includes(this.searchQuery) ||
                String(s.address || '').toLowerCase().includes(this.searchQuery)
            );
        }

        container.innerHTML = `
            <div class="page-header">
                <div>
                    <h1 class="page-title">Suppliers Directory</h1>
                    <p class="page-subtitle">Entity: <code>Suppliers(supp_id, company_name, phone, address)</code></p>
                </div>
                <div class="header-actions">
                    <button class="btn-primary" id="btn-add-supplier">${Icons.plus} Add New Supplier</button>
                </div>
            </div>

            <div class="toolbar-container">
                <div class="filter-group">
                    <span style="font-size: 0.85rem; color: var(--text-muted);">Verified Suppliers: <strong>${items.length}</strong></span>
                </div>
                <div>
                    <button class="btn-secondary" style="font-size: 0.8rem;" id="btn-export-suppliers">Export CSV</button>
                </div>
            </div>

            <div class="card" style="padding: 0;">
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Supplier ID (PK)</th>
                                <th>Company Name</th>
                                <th>Contact Phone</th>
                                <th>Facility Address</th>
                                <th>Supplied Materials</th>
                                <th style="text-align: right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.length === 0 ? `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--text-muted);">No suppliers found.</td></tr>` :
                            items.map(s => {
                                const mats = db.getSupplierMaterials(s.supp_id);
                                return `
                                    <tr>
                                        <td><span class="pk-pill">${Icons.key} ${s.supp_id}</span></td>
                                        <td><strong>${s.company_name}</strong></td>
                                        <td>${s.phone}</td>
                                        <td>${s.address}</td>
                                        <td>
                                            <span class="nav-badge" style="background: var(--bg-tertiary); color: var(--text-main);">
                                                ${mats.length} Raw Materials
                                            </span>
                                        </td>
                                        <td style="text-align: right;">
                                            <div class="action-btns" style="justify-content: flex-end;">
                                                <button class="action-btn" title="Edit Supplier" onclick="window.app.openSupplierModal('${s.supp_id}')">${Icons.edit}</button>
                                                <button class="action-btn delete" title="Delete Supplier" onclick="window.app.deleteSupplier('${s.supp_id}')">${Icons.delete}</button>
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        document.getElementById('btn-add-supplier').onclick = () => this.openSupplierModal();
        document.getElementById('btn-export-suppliers').onclick = () => this.exportEntityCSV('suppliers');
    }

    // ==========================================
    // 11. CUSTOMERS VIEW
    // ==========================================
    renderCustomersView(container) {
        let items = db.data.customers || [];
        if (this.searchQuery) {
            items = items.filter(c =>
                String(c.cust_id || '').toLowerCase().includes(this.searchQuery) ||
                String(c.cust_name || '').toLowerCase().includes(this.searchQuery) ||
                String(c.email || '').toLowerCase().includes(this.searchQuery)
            );
        }

        container.innerHTML = `
            <div class="page-header">
                <div>
                    <h1 class="page-title">Customer Accounts</h1>
                    <p class="page-subtitle">Entity: <code>Customers(cust_id, cust_name, phone_no, email, address)</code></p>
                </div>
                <div class="header-actions">
                    <button class="btn-primary" id="btn-add-customer">${Icons.plus} Add New Customer</button>
                </div>
            </div>

            <div class="toolbar-container">
                <div class="filter-group">
                    <span style="font-size: 0.85rem; color: var(--text-muted);">Active Client Accounts: <strong>${items.length}</strong></span>
                </div>
                <div>
                    <button class="btn-secondary" style="font-size: 0.8rem;" id="btn-export-customers">Export CSV</button>
                </div>
            </div>

            <div class="card" style="padding: 0;">
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Customer ID (PK)</th>
                                <th>Customer Name</th>
                                <th>Phone Number</th>
                                <th>Email Address</th>
                                <th>Shipping Address</th>
                                <th style="text-align: right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.length === 0 ? `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--text-muted);">No customer accounts found.</td></tr>` :
                            items.map(c => `
                                <tr>
                                    <td><span class="pk-pill">${Icons.key} ${c.cust_id}</span></td>
                                    <td><strong>${c.cust_name}</strong></td>
                                    <td>${c.phone_no}</td>
                                    <td><a href="mailto:${c.email}" style="color: var(--accent-primary); text-decoration: none;">${c.email}</a></td>
                                    <td>${c.address}</td>
                                    <td style="text-align: right;">
                                        <div class="action-btns" style="justify-content: flex-end;">
                                            <button class="action-btn" title="Edit Customer" onclick="window.app.openCustomerModal('${c.cust_id}')">${Icons.edit}</button>
                                            <button class="action-btn delete" title="Delete Customer" onclick="window.app.deleteCustomer('${c.cust_id}')">${Icons.delete}</button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        document.getElementById('btn-add-customer').onclick = () => this.openCustomerModal();
        document.getElementById('btn-export-customers').onclick = () => this.exportEntityCSV('customers');
    }

    // ==========================================
    // 12. RELATIONAL ER DIAGRAM VIEW
    // ==========================================
    renderERDiagramView(container) {
        container.innerHTML = `
            <div class="page-header">
                <div>
                    <h1 class="page-title">Relational ER Diagram Architecture</h1>
                    <p class="page-subtitle">Visual blueprint of all 8 database entities, Primary Keys (PK), Foreign Keys (FK), and Cardinalities</p>
                </div>
            </div>

            <!-- Interactive Schema Grid -->
            <div class="er-canvas-grid">
                <!-- 1. Customers -->
                <div class="er-entity-node">
                    <div class="er-node-header" style="background-color: #1e40af;">
                        <span>Customers</span>
                        <span style="font-size: 0.7rem; background: rgba(0,0,0,0.25); padding: 2px 6px; border-radius: 4px;">4 attributes</span>
                    </div>
                    <div class="er-node-body">
                        <div class="er-attr-row">
                            <span class="pk-pill">${Icons.key} cust_id</span>
                            <span style="color: var(--text-subtle);">VARCHAR(20) PK</span>
                        </div>
                        <div class="er-attr-row"><span>cust_name</span><span style="color: var(--text-subtle);">VARCHAR(100)</span></div>
                        <div class="er-attr-row"><span>phone_no</span><span style="color: var(--text-subtle);">VARCHAR(20)</span></div>
                        <div class="er-attr-row"><span>email</span><span style="color: var(--text-subtle);">VARCHAR(100)</span></div>
                        <div class="er-attr-row"><span>address</span><span style="color: var(--text-subtle);">TEXT</span></div>
                        <div class="er-relation-badge">Master Customer Entity</div>
                    </div>
                </div>

                <!-- 2. Suppliers -->
                <div class="er-entity-node">
                    <div class="er-node-header" style="background-color: #334155;">
                        <span>Suppliers</span>
                        <span style="font-size: 0.7rem; background: rgba(0,0,0,0.25); padding: 2px 6px; border-radius: 4px;">3 attributes</span>
                    </div>
                    <div class="er-node-body">
                        <div class="er-attr-row">
                            <span class="pk-pill">${Icons.key} supp_id</span>
                            <span style="color: var(--text-subtle);">VARCHAR(20) PK</span>
                        </div>
                        <div class="er-attr-row"><span>company_name</span><span style="color: var(--text-subtle);">VARCHAR(100)</span></div>
                        <div class="er-attr-row"><span>phone</span><span style="color: var(--text-subtle);">VARCHAR(20)</span></div>
                        <div class="er-attr-row"><span>address</span><span style="color: var(--text-subtle);">TEXT</span></div>
                        <div class="er-relation-badge">1 : N with Raw_Material</div>
                    </div>
                </div>

                <!-- 3. Raw Material -->
                <div class="er-entity-node">
                    <div class="er-node-header" style="background-color: #0d9488;">
                        <span>Raw_Material</span>
                        <span style="font-size: 0.7rem; background: rgba(0,0,0,0.25); padding: 2px 6px; border-radius: 4px;">5 attributes</span>
                    </div>
                    <div class="er-node-body">
                        <div class="er-attr-row">
                            <span class="pk-pill">${Icons.key} material_id</span>
                            <span style="color: var(--text-subtle);">VARCHAR(20) PK</span>
                        </div>
                        <div class="er-attr-row"><span>material_name</span><span style="color: var(--text-subtle);">VARCHAR(100)</span></div>
                        <div class="er-attr-row"><span>stock</span><span style="color: var(--text-subtle);">INT</span></div>
                        <div class="er-attr-row"><span>unit_cost</span><span style="color: var(--text-subtle);">DECIMAL(10,2)</span></div>
                        <div class="er-attr-row">
                            <span class="fk-pill">${Icons.link} supp_id</span>
                            <span style="color: var(--text-subtle);">FK &rarr; Suppliers</span>
                        </div>
                        <div class="er-relation-badge">Used in Bill_of_Material (1:N)</div>
                    </div>
                </div>

                <!-- 4. Work Center -->
                <div class="er-entity-node">
                    <div class="er-node-header" style="background-color: #0284c7;">
                        <span>Work_Center</span>
                        <span style="font-size: 0.7rem; background: rgba(0,0,0,0.25); padding: 2px 6px; border-radius: 4px;">4 attributes</span>
                    </div>
                    <div class="er-node-body">
                        <div class="er-attr-row">
                            <span class="pk-pill">${Icons.key} centre_id</span>
                            <span style="color: var(--text-subtle);">VARCHAR(20) PK</span>
                        </div>
                        <div class="er-attr-row"><span>centre_name</span><span style="color: var(--text-subtle);">VARCHAR(100)</span></div>
                        <div class="er-attr-row"><span>hourly_rate</span><span style="color: var(--text-subtle);">DECIMAL(10,2)</span></div>
                        <div class="er-attr-row"><span>status</span><span style="color: var(--text-subtle);">ENUM</span></div>
                        <div class="er-attr-row"><span>location</span><span style="color: var(--text-subtle);">VARCHAR(100)</span></div>
                        <div class="er-relation-badge">1 : N with Products</div>
                    </div>
                </div>

                <!-- 5. Products -->
                <div class="er-entity-node">
                    <div class="er-node-header" style="background-color: #4338ca;">
                        <span>Products</span>
                        <span style="font-size: 0.7rem; background: rgba(0,0,0,0.25); padding: 2px 6px; border-radius: 4px;">5 attributes</span>
                    </div>
                    <div class="er-node-body">
                        <div class="er-attr-row">
                            <span class="pk-pill">${Icons.key} prod_id</span>
                            <span style="color: var(--text-subtle);">VARCHAR(20) PK</span>
                        </div>
                        <div class="er-attr-row"><span>prod_name</span><span style="color: var(--text-subtle);">VARCHAR(100)</span></div>
                        <div class="er-attr-row"><span>unit_price</span><span style="color: var(--text-subtle);">DECIMAL(10,2)</span></div>
                        <div class="er-attr-row"><span>stock</span><span style="color: var(--text-subtle);">INT</span></div>
                        <div class="er-attr-row">
                            <span class="fk-pill">${Icons.link} centre_id</span>
                            <span style="color: var(--text-subtle);">FK &rarr; Work_Center</span>
                        </div>
                        <div class="er-relation-badge">Parent for Orders & BOM</div>
                    </div>
                </div>

                <!-- 6. Bill of Material -->
                <div class="er-entity-node">
                    <div class="er-node-header" style="background-color: #475569;">
                        <span>Bill_of_Material</span>
                        <span style="font-size: 0.7rem; background: rgba(0,0,0,0.25); padding: 2px 6px; border-radius: 4px;">4 attributes</span>
                    </div>
                    <div class="er-node-body">
                        <div class="er-attr-row">
                            <span class="pk-pill">${Icons.key} bom_id</span>
                            <span style="color: var(--text-subtle);">VARCHAR(20) PK</span>
                        </div>
                        <div class="er-attr-row">
                            <span class="fk-pill">${Icons.link} prod_id</span>
                            <span style="color: var(--text-subtle);">FK &rarr; Products</span>
                        </div>
                        <div class="er-attr-row">
                            <span class="fk-pill">${Icons.link} material_id</span>
                            <span style="color: var(--text-subtle);">FK &rarr; Raw_Material</span>
                        </div>
                        <div class="er-attr-row"><span>money</span><span style="color: var(--text-subtle);">DECIMAL(10,2)</span></div>
                        <div class="er-relation-badge">Bridge: Products &harr; Materials</div>
                    </div>
                </div>

                <!-- 7. Production Orders -->
                <div class="er-entity-node">
                    <div class="er-node-header" style="background-color: #2563eb;">
                        <span>Production_Orders</span>
                        <span style="font-size: 0.7rem; background: rgba(0,0,0,0.25); padding: 2px 6px; border-radius: 4px;">6 attributes</span>
                    </div>
                    <div class="er-node-body">
                        <div class="er-attr-row">
                            <span class="pk-pill">${Icons.key} order_id</span>
                            <span style="color: var(--text-subtle);">VARCHAR(20) PK</span>
                        </div>
                        <div class="er-attr-row">
                            <span class="fk-pill">${Icons.link} prod_id</span>
                            <span style="color: var(--text-subtle);">FK &rarr; Products</span>
                        </div>
                        <div class="er-attr-row"><span>target</span><span style="color: var(--text-subtle);">INT</span></div>
                        <div class="er-attr-row"><span>start_date</span><span style="color: var(--text-subtle);">DATE</span></div>
                        <div class="er-attr-row"><span>completion_date</span><span style="color: var(--text-subtle);">DATE</span></div>
                        <div class="er-attr-row"><span>status</span><span style="color: var(--text-subtle);">ENUM</span></div>
                        <div class="er-relation-badge">1 : N with Production_Logs</div>
                    </div>
                </div>

                <!-- 8. Production Logs -->
                <div class="er-entity-node">
                    <div class="er-node-header" style="background-color: #0f766e;">
                        <span>Production_Logs</span>
                        <span style="font-size: 0.7rem; background: rgba(0,0,0,0.25); padding: 2px 6px; border-radius: 4px;">5 attributes</span>
                    </div>
                    <div class="er-node-body">
                        <div class="er-attr-row">
                            <span class="pk-pill">${Icons.key} log_id</span>
                            <span style="color: var(--text-subtle);">VARCHAR(20) PK</span>
                        </div>
                        <div class="er-attr-row">
                            <span class="fk-pill">${Icons.link} order_id</span>
                            <span style="color: var(--text-subtle);">FK &rarr; Production_Orders</span>
                        </div>
                        <div class="er-attr-row"><span>labour_hours</span><span style="color: var(--text-subtle);">DECIMAL(6,2)</span></div>
                        <div class="er-attr-row"><span>units_completed</span><span style="color: var(--text-subtle);">INT</span></div>
                        <div class="er-attr-row"><span>updated_at</span><span style="color: var(--text-subtle);">TIMESTAMP</span></div>
                        <div class="er-relation-badge">Child of Production_Orders</div>
                    </div>
                </div>
            </div>
        `;
    }

    // ==========================================
    // MODALS & CRUD OPERATIONS
    // ==========================================
    openProductModal(prodId = null) {
        const isEdit = !!prodId;
        const item = isEdit ? (db.data.products || []).find(p => String(p.prod_id) === String(prodId)) : null;
        const workCenters = db.data.work_centers || [];

        const bodyHTML = `
            <div class="form-group">
                <label>Product ID (Primary Key) *</label>
                <input type="text" class="form-control" id="form-prod-id" value="${item ? item.prod_id : 'PROD-' + (Math.floor(100 + Math.random() * 900))}" ${isEdit ? 'readonly style="opacity: 0.7;"' : ''} required />
                <span class="form-helper">Unique identifier (e.g. PROD-101)</span>
            </div>
            <div class="form-group">
                <label>Product Name *</label>
                <input type="text" class="form-control" id="form-prod-name" value="${item ? item.prod_name : ''}" placeholder="e.g. High-Torque Brushless Motor" required />
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Unit Selling Price ($) *</label>
                    <input type="number" step="0.01" class="form-control" id="form-prod-price" value="${item ? item.unit_price : '99.00'}" required />
                </div>
                <div class="form-group">
                    <label>Initial / Current Stock *</label>
                    <input type="number" class="form-control" id="form-prod-stock" value="${item ? item.stock : '50'}" required />
                </div>
            </div>
            <div class="form-group">
                <label>Assigned Work Center (Foreign Key: centre_id)</label>
                <select class="form-control" id="form-prod-centre">
                    <option value="">-- None / General Assembly --</option>
                    ${workCenters.map(wc => `
                        <option value="${wc.centre_id}" ${item && item.centre_id === wc.centre_id ? 'selected' : ''}>${wc.centre_id} - ${wc.centre_name} (${wc.location})</option>
                    `).join('')}
                </select>
            </div>
        `;

        openModal(isEdit ? 'Edit Product' : 'Add New Product', bodyHTML, () => {
            const id = document.getElementById('form-prod-id').value.trim();
            const name = document.getElementById('form-prod-name').value.trim();
            const price = parseFloat(document.getElementById('form-prod-price').value) || 0;
            const stock = parseInt(document.getElementById('form-prod-stock').value, 10) || 0;
            const centre_id = document.getElementById('form-prod-centre').value;

            if (!id || !name) {
                alert('Please enter Product ID and Name');
                return false;
            }

            const record = { prod_id: id, prod_name: name, unit_price: price, stock, centre_id };
            if (isEdit) {
                db.update('products', 'prod_id', id, record);
                showToast(`Product ${id} updated successfully!`);
            } else {
                db.create('products', record);
                showToast(`Product ${id} created successfully!`);
            }
            this.refreshCurrentView();
            return true;
        });
    }

    deleteProduct(prodId) {
        if (confirm(`Are you sure you want to delete Product ${prodId}? Associated BOM links will be affected.`)) {
            db.delete('products', 'prod_id', prodId);
            showToast(`Product ${prodId} removed.`, 'warning');
            this.refreshCurrentView();
        }
    }

    openBOMModal(bomId = null, presetProdId = null) {
        const isEdit = !!bomId;
        const item = isEdit ? (db.data.bill_of_materials || []).find(b => String(b.bom_id) === String(bomId)) : null;
        const products = db.data.products || [];
        const materials = db.data.raw_materials || [];

        const bodyHTML = `
            <div class="form-group">
                <label>BOM Entry ID (Primary Key) *</label>
                <input type="text" class="form-control" id="form-bom-id" value="${item ? item.bom_id : 'BOM-' + (Math.floor(200 + Math.random() * 800))}" ${isEdit ? 'readonly style="opacity: 0.7;"' : ''} required />
            </div>
            <div class="form-group">
                <label>Finished Product (Foreign Key: prod_id) *</label>
                <select class="form-control" id="form-bom-prod" required>
                    <option value="">-- Select Product --</option>
                    ${products.map(p => `
                        <option value="${p.prod_id}" ${(item && item.prod_id === p.prod_id) || (!item && (presetProdId || this.selectedBOMProdId) === p.prod_id) ? 'selected' : ''}>${p.prod_id} - ${p.prod_name}</option>
                    `).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Raw Material (Foreign Key: material_id) *</label>
                <select class="form-control" id="form-bom-mat" required>
                    <option value="">-- Select Material --</option>
                    ${materials.map(m => `
                        <option value="${m.material_id}" ${item && item.material_id === m.material_id ? 'selected' : ''}>${m.material_id} - ${m.material_name} (Unit Cost: $${m.unit_cost})</option>
                    `).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Cost / Money Allocation ($) *</label>
                <input type="number" step="0.01" class="form-control" id="form-bom-money" value="${item ? item.money : '25.00'}" required />
                <span class="form-helper">Total raw material cost required per finished product unit</span>
            </div>
        `;

        openModal(isEdit ? 'Edit BOM Entry' : 'Add BOM Component Entry', bodyHTML, () => {
            const id = document.getElementById('form-bom-id').value.trim();
            const prod_id = document.getElementById('form-bom-prod').value;
            const material_id = document.getElementById('form-bom-mat').value;
            const money = parseFloat(document.getElementById('form-bom-money').value) || 0;

            if (!id || !prod_id || !material_id) {
                alert('Please select Product and Material');
                return false;
            }

            const record = { bom_id: id, prod_id, material_id, money };
            if (isEdit) {
                db.update('bill_of_materials', 'bom_id', id, record);
                showToast(`BOM entry ${id} updated.`);
            } else {
                db.create('bill_of_materials', record);
                showToast(`BOM entry ${id} created.`);
            }
            this.refreshCurrentView();
            return true;
        });
    }

    deleteBOM(bomId) {
        if (confirm(`Delete BOM record ${bomId}?`)) {
            db.delete('bill_of_materials', 'bom_id', bomId);
            showToast(`BOM record ${bomId} removed.`, 'warning');
            this.refreshCurrentView();
        }
    }

    openOrderModal(orderId = null) {
        const isEdit = !!orderId;
        const item = isEdit ? (db.data.production_orders || []).find(o => String(o.order_id) === String(orderId)) : null;
        const products = db.data.products || [];
        const today = new Date().toISOString().split('T')[0];

        const bodyHTML = `
            <div class="form-group">
                <label>Order ID (Primary Key) *</label>
                <input type="text" class="form-control" id="form-ord-id" value="${item ? item.order_id : 'ORD-' + (Math.floor(900 + Math.random() * 100))}" ${isEdit ? 'readonly style="opacity: 0.7;"' : ''} required />
            </div>
            <div class="form-group">
                <label>Product to Manufacture (Foreign Key: prod_id) *</label>
                <select class="form-control" id="form-ord-prod" required>
                    <option value="">-- Select Target Product --</option>
                    ${products.map(p => `
                        <option value="${p.prod_id}" ${item && item.prod_id === p.prod_id ? 'selected' : ''}>${p.prod_id} - ${p.prod_name}</option>
                    `).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Production Target Quantity (Units) *</label>
                <input type="number" class="form-control" id="form-ord-target" value="${item ? item.target : '100'}" required />
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Start Date *</label>
                    <input type="date" class="form-control" id="form-ord-start" value="${item ? item.start_date : today}" required />
                </div>
                <div class="form-group">
                    <label>Target Completion Date</label>
                    <input type="date" class="form-control" id="form-ord-end" value="${item ? item.completion_date : ''}" />
                </div>
            </div>
            <div class="form-group">
                <label>Status</label>
                <select class="form-control" id="form-ord-status">
                    <option value="Pending" ${item && item.status === 'Pending' ? 'selected' : ''}>Pending</option>
                    <option value="In Progress" ${item && item.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                    <option value="Quality Check" ${item && item.status === 'Quality Check' ? 'selected' : ''}>Quality Check</option>
                    <option value="Completed" ${item && item.status === 'Completed' ? 'selected' : ''}>Completed</option>
                    <option value="Cancelled" ${item && item.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                </select>
            </div>
        `;

        openModal(isEdit ? 'Edit Production Order' : 'Schedule New Production Order', bodyHTML, () => {
            const id = document.getElementById('form-ord-id').value.trim();
            const prod_id = document.getElementById('form-ord-prod').value;
            const target = parseInt(document.getElementById('form-ord-target').value, 10) || 0;
            const start_date = document.getElementById('form-ord-start').value;
            const completion_date = document.getElementById('form-ord-end').value;
            const status = document.getElementById('form-ord-status').value;

            if (!id || !prod_id || !target || !start_date) {
                alert('Please fill all required fields');
                return false;
            }

            const record = { order_id: id, prod_id, target, start_date, completion_date, status };
            if (isEdit) {
                db.update('production_orders', 'order_id', id, record);
                showToast(`Order ${id} updated.`);
            } else {
                db.create('production_orders', record);
                showToast(`Order ${id} scheduled successfully!`);
            }
            this.refreshCurrentView();
            return true;
        });
    }

    updateOrderStatus(orderId, nextStatus) {
        const order = (db.data.production_orders || []).find(o => String(o.order_id) === String(orderId));
        if (order) {
            order.status = nextStatus;
            if (nextStatus === 'Completed' && !order.completion_date) {
                order.completion_date = new Date().toISOString().split('T')[0];
            }
            db.update('production_orders', 'order_id', orderId, order);
            showToast(`Order ${orderId} moved to ${nextStatus}`);
            this.refreshCurrentView();
        }
    }

    deleteOrder(orderId) {
        if (confirm(`Cancel and delete order ${orderId}? Linked production logs will also be removed.`)) {
            db.delete('production_orders', 'order_id', orderId);
            showToast(`Order ${orderId} removed.`, 'warning');
            this.refreshCurrentView();
        }
    }

    openAddLogModal(presetOrderId = null, logId = null) {
        const isEdit = !!logId;
        const item = isEdit ? (db.data.production_logs || []).find(l => String(l.log_id) === String(logId)) : null;
        const orders = db.data.production_orders || [];

        const bodyHTML = `
            <div class="form-group">
                <label>Production Log ID (Primary Key) *</label>
                <input type="text" class="form-control" id="form-log-id" value="${item ? item.log_id : 'LOG-' + (Math.floor(500 + Math.random() * 500))}" ${isEdit ? 'readonly style="opacity: 0.7;"' : ''} required />
            </div>
            <div class="form-group">
                <label>Production Order (Foreign Key: order_id) *</label>
                <select class="form-control" id="form-log-order" required>
                    <option value="">-- Select Order --</option>
                    ${orders.map(o => {
                        const prod = (db.data.products || []).find(p => String(p.prod_id) === String(o.prod_id));
                        const isSelected = (item && item.order_id === o.order_id) || (!item && presetOrderId === o.order_id);
                        return `<option value="${o.order_id}" ${isSelected ? 'selected' : ''}>${o.order_id} - ${prod ? prod.prod_name : o.prod_id} (Target: ${o.target} units)</option>`;
                    }).join('')}
                </select>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Shift Labour Hours (Hours) *</label>
                    <input type="number" step="0.5" class="form-control" id="form-log-hours" value="${item ? item.labour_hours : '8.0'}" required />
                </div>
                <div class="form-group">
                    <label>Units Completed this Shift *</label>
                    <input type="number" class="form-control" id="form-log-units" value="${item ? item.units_completed : '25'}" required />
                </div>
            </div>
        `;

        openModal(isEdit ? 'Edit Shift Production Log' : 'Record Shift Production Log', bodyHTML, () => {
            const id = document.getElementById('form-log-id').value.trim();
            const order_id = document.getElementById('form-log-order').value;
            const labour_hours = parseFloat(document.getElementById('form-log-hours').value) || 0;
            const units_completed = parseInt(document.getElementById('form-log-units').value, 10) || 0;

            if (!id || !order_id) {
                alert('Please fill all required fields');
                return false;
            }

            const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
            const record = { log_id: id, order_id, labour_hours, units_completed, updated_at: now };

            if (isEdit) {
                db.update('production_logs', 'log_id', id, record);
                showToast(`Log ${id} updated.`);
            } else {
                db.create('production_logs', record);
                showToast(`Shift log ${id} recorded successfully!`);
            }
            this.refreshCurrentView();
            return true;
        });
    }

    deleteLog(logId) {
        if (confirm(`Delete shift log ${logId}?`)) {
            db.delete('production_logs', 'log_id', logId);
            showToast(`Log ${logId} removed.`, 'warning');
            this.refreshCurrentView();
        }
    }

    openMaterialModal(matId = null) {
        const isEdit = !!matId;
        const item = isEdit ? (db.data.raw_materials || []).find(m => String(m.material_id) === String(matId)) : null;
        const suppliers = db.data.suppliers || [];

        const bodyHTML = `
            <div class="form-group">
                <label>Material ID (Primary Key) *</label>
                <input type="text" class="form-control" id="form-mat-id" value="${item ? item.material_id : 'MAT-' + (Math.floor(100 + Math.random() * 900))}" ${isEdit ? 'readonly style="opacity: 0.7;"' : ''} required />
            </div>
            <div class="form-group">
                <label>Material Name *</label>
                <input type="text" class="form-control" id="form-mat-name" value="${item ? item.material_name : ''}" placeholder="e.g. Copper Wire Spool" required />
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Current Stock (Quantity) *</label>
                    <input type="number" class="form-control" id="form-mat-stock" value="${item ? item.stock : '200'}" required />
                </div>
                <div class="form-group">
                    <label>Unit Cost ($) *</label>
                    <input type="number" step="0.01" class="form-control" id="form-mat-cost" value="${item ? item.unit_cost : '15.00'}" required />
                </div>
            </div>
            <div class="form-group">
                <label>Primary Supplier (Foreign Key: supp_id)</label>
                <select class="form-control" id="form-mat-supp">
                    <option value="">-- None / Spot Market --</option>
                    ${suppliers.map(s => `
                        <option value="${s.supp_id}" ${item && item.supp_id === s.supp_id ? 'selected' : ''}>${s.supp_id} - ${s.company_name}</option>
                    `).join('')}
                </select>
            </div>
        `;

        openModal(isEdit ? 'Edit Raw Material' : 'Add New Raw Material', bodyHTML, () => {
            const id = document.getElementById('form-mat-id').value.trim();
            const name = document.getElementById('form-mat-name').value.trim();
            const stock = parseInt(document.getElementById('form-mat-stock').value, 10) || 0;
            const unit_cost = parseFloat(document.getElementById('form-mat-cost').value) || 0;
            const supp_id = document.getElementById('form-mat-supp').value;

            if (!id || !name) {
                alert('Please enter Material ID and Name');
                return false;
            }

            const record = { material_id: id, material_name: name, stock, unit_cost, supp_id };
            if (isEdit) {
                db.update('raw_materials', 'material_id', id, record);
                showToast(`Material ${id} updated.`);
            } else {
                db.create('raw_materials', record);
                showToast(`Material ${id} added to inventory.`);
            }
            this.refreshCurrentView();
            return true;
        });
    }

    deleteMaterial(matId) {
        if (confirm(`Delete raw material ${matId}? Associated BOM links will be affected.`)) {
            db.delete('raw_materials', 'material_id', matId);
            showToast(`Material ${matId} removed.`, 'warning');
            this.refreshCurrentView();
        }
    }

    openWorkCenterModal(wcId = null) {
        const isEdit = !!wcId;
        const item = isEdit ? (db.data.work_centers || []).find(w => String(w.centre_id) === String(wcId)) : null;

        const bodyHTML = `
            <div class="form-group">
                <label>Work Center ID (Primary Key) *</label>
                <input type="text" class="form-control" id="form-wc-id" value="${item ? item.centre_id : 'WC-' + (Math.floor(10 + Math.random() * 90))}" ${isEdit ? 'readonly style="opacity: 0.7;"' : ''} required />
            </div>
            <div class="form-group">
                <label>Center Name *</label>
                <input type="text" class="form-control" id="form-wc-name" value="${item ? item.centre_name : ''}" placeholder="e.g. CNC Milling Station Alpha" required />
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Hourly Machine Rate ($/hr) *</label>
                    <input type="number" step="0.5" class="form-control" id="form-wc-rate" value="${item ? item.hourly_rate : '75.00'}" required />
                </div>
                <div class="form-group">
                    <label>Operational Status *</label>
                    <select class="form-control" id="form-wc-status">
                        <option value="Operational" ${item && item.status === 'Operational' ? 'selected' : ''}>Operational</option>
                        <option value="Maintenance" ${item && item.status === 'Maintenance' ? 'selected' : ''}>Maintenance</option>
                        <option value="Idle" ${item && item.status === 'Idle' ? 'selected' : ''}>Idle</option>
                        <option value="Offline" ${item && item.status === 'Offline' ? 'selected' : ''}>Offline</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>Plant Location *</label>
                <input type="text" class="form-control" id="form-wc-loc" value="${item ? item.location : ''}" placeholder="e.g. Building B - Bay 4" required />
            </div>
        `;

        openModal(isEdit ? 'Edit Work Center' : 'Add New Work Center', bodyHTML, () => {
            const id = document.getElementById('form-wc-id').value.trim();
            const name = document.getElementById('form-wc-name').value.trim();
            const rate = parseFloat(document.getElementById('form-wc-rate').value) || 0;
            const status = document.getElementById('form-wc-status').value;
            const location = document.getElementById('form-wc-loc').value.trim();

            if (!id || !name || !location) {
                alert('Please enter all required fields');
                return false;
            }

            const record = { centre_id: id, centre_name: name, hourly_rate: rate, status, location };
            if (isEdit) {
                db.update('work_centers', 'centre_id', id, record);
                showToast(`Work Center ${id} updated.`);
            } else {
                db.create('work_centers', record);
                showToast(`Work Center ${id} added.`);
            }
            this.refreshCurrentView();
            return true;
        });
    }

    deleteWorkCenter(wcId) {
        if (confirm(`Delete Work Center ${wcId}? Products linked to this centre will lose their reference.`)) {
            db.delete('work_centers', 'centre_id', wcId);
            showToast(`Work Center ${wcId} removed.`, 'warning');
            this.refreshCurrentView();
        }
    }

    openSupplierModal(suppId = null) {
        const isEdit = !!suppId;
        const item = isEdit ? (db.data.suppliers || []).find(s => String(s.supp_id) === String(suppId)) : null;

        const bodyHTML = `
            <div class="form-group">
                <label>Supplier ID (Primary Key) *</label>
                <input type="text" class="form-control" id="form-supp-id" value="${item ? item.supp_id : 'SUPP-' + (Math.floor(100 + Math.random() * 900))}" ${isEdit ? 'readonly style="opacity: 0.7;"' : ''} required />
            </div>
            <div class="form-group">
                <label>Company Name *</label>
                <input type="text" class="form-control" id="form-supp-name" value="${item ? item.company_name : ''}" placeholder="e.g. Global Alloys Corp" required />
            </div>
            <div class="form-group">
                <label>Phone Number *</label>
                <input type="text" class="form-control" id="form-supp-phone" value="${item ? item.phone : ''}" placeholder="+1 (555) 234-5678" required />
            </div>
            <div class="form-group">
                <label>Facility Address *</label>
                <textarea class="form-control" id="form-supp-address" rows="2" required>${item ? item.address : ''}</textarea>
            </div>
        `;

        openModal(isEdit ? 'Edit Supplier' : 'Add New Supplier', bodyHTML, () => {
            const id = document.getElementById('form-supp-id').value.trim();
            const name = document.getElementById('form-supp-name').value.trim();
            const phone = document.getElementById('form-supp-phone').value.trim();
            const address = document.getElementById('form-supp-address').value.trim();

            if (!id || !name || !phone) {
                alert('Please enter all required fields');
                return false;
            }

            const record = { supp_id: id, company_name: name, phone, address };
            if (isEdit) {
                db.update('suppliers', 'supp_id', id, record);
                showToast(`Supplier ${id} updated.`);
            } else {
                db.create('suppliers', record);
                showToast(`Supplier ${id} added successfully!`);
            }
            this.refreshCurrentView();
            return true;
        });
    }

    deleteSupplier(suppId) {
        if (confirm(`Delete supplier ${suppId}? Materials supplied by them will become unassigned.`)) {
            db.delete('suppliers', 'supp_id', suppId);
            showToast(`Supplier ${suppId} removed.`, 'warning');
            this.refreshCurrentView();
        }
    }

    openCustomerModal(custId = null) {
        const isEdit = !!custId;
        const item = isEdit ? (db.data.customers || []).find(c => String(c.cust_id) === String(custId)) : null;

        const bodyHTML = `
            <div class="form-group">
                <label>Customer ID (Primary Key) *</label>
                <input type="text" class="form-control" id="form-cust-id" value="${item ? item.cust_id : 'CUST-' + (Math.floor(100 + Math.random() * 900))}" ${isEdit ? 'readonly style="opacity: 0.7;"' : ''} required />
            </div>
            <div class="form-group">
                <label>Customer Name *</label>
                <input type="text" class="form-control" id="form-cust-name" value="${item ? item.cust_name : ''}" placeholder="e.g. Apex Industrial Systems" required />
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Phone Number *</label>
                    <input type="text" class="form-control" id="form-cust-phone" value="${item ? item.phone_no : ''}" placeholder="+1 (555) 789-0123" required />
                </div>
                <div class="form-group">
                    <label>Email Address *</label>
                    <input type="email" class="form-control" id="form-cust-email" value="${item ? item.email : ''}" placeholder="contact@apexsystems.com" required />
                </div>
            </div>
            <div class="form-group">
                <label>Billing & Delivery Address *</label>
                <textarea class="form-control" id="form-cust-address" rows="2" required>${item ? item.address : ''}</textarea>
            </div>
        `;

        openModal(isEdit ? 'Edit Customer' : 'Add New Customer', bodyHTML, () => {
            const id = document.getElementById('form-cust-id').value.trim();
            const name = document.getElementById('form-cust-name').value.trim();
            const phone = document.getElementById('form-cust-phone').value.trim();
            const email = document.getElementById('form-cust-email').value.trim();
            const address = document.getElementById('form-cust-address').value.trim();

            if (!id || !name || !email) {
                alert('Please enter all required fields');
                return false;
            }

            const record = { cust_id: id, cust_name: name, phone_no: phone, email, address };
            if (isEdit) {
                db.update('customers', 'cust_id', id, record);
                showToast(`Customer ${id} updated.`);
            } else {
                db.create('customers', record);
                showToast(`Customer ${id} added successfully!`);
            }
            this.refreshCurrentView();
            return true;
        });
    }

    deleteCustomer(custId) {
        if (confirm(`Delete customer account ${custId}?`)) {
            db.delete('customers', 'cust_id', custId);
            showToast(`Customer ${custId} removed.`, 'warning');
            this.refreshCurrentView();
        }
    }

    // ==========================================
    // UTILITIES: CSV EXPORT & QUICK ADD
    // ==========================================
    exportEntityCSV(entityKey) {
        const items = db.data[entityKey] || [];
        if (items.length === 0) {
            showToast('No records to export', 'warning');
            return;
        }
        const headers = Object.keys(items[0]);
        const rows = items.map(obj => headers.map(h => `"${String(obj[h] || '').replace(/"/g, '""')}"`).join(','));
        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `${entityKey}_export.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        showToast(`Exported ${entityKey}.csv`);
    }

    handleQuickAdd() {
        const modalHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                <button class="btn-secondary" style="padding: 1rem; justify-content: center;" onclick="closeModal(); window.app.openProductModal();">
                    ${Icons.products} Product
                </button>
                <button class="btn-secondary" style="padding: 1rem; justify-content: center;" onclick="closeModal(); window.app.openOrderModal();">
                    ${Icons.orders} Production Order
                </button>
                <button class="btn-secondary" style="padding: 1rem; justify-content: center;" onclick="closeModal(); window.app.openAddLogModal();">
                    ${Icons.logs} Production Shift Log
                </button>
                <button class="btn-secondary" style="padding: 1rem; justify-content: center;" onclick="closeModal(); window.app.openMaterialModal();">
                    ${Icons.rawMaterials} Raw Material
                </button>
                <button class="btn-secondary" style="padding: 1rem; justify-content: center;" onclick="closeModal(); window.app.openBOMModal();">
                    ${Icons.bom} BOM Entry
                </button>
                <button class="btn-secondary" style="padding: 1rem; justify-content: center;" onclick="closeModal(); window.app.openWorkCenterModal();">
                    ${Icons.workCenters} Work Center
                </button>
                <button class="btn-secondary" style="padding: 1rem; justify-content: center;" onclick="closeModal(); window.app.openSupplierModal();">
                    ${Icons.suppliers} Supplier
                </button>
                <button class="btn-secondary" style="padding: 1rem; justify-content: center;" onclick="closeModal(); window.app.openCustomerModal();">
                    ${Icons.customers} Customer
                </button>
            </div>
        `;
        openModal('Quick Create Record', modalHTML);
    }
}

// Instantiate global app
window.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
