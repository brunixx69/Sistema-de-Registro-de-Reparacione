/**
 * RepairTrack Enterprise SaaS - Robust Logic Layer
 * Features: View Routing, Theme Engine, Persistent Serial Generator, Toast System, Adaptive Mobile UX, Real-time Dashboard
 */

const APP_CONFIG = {
    RECORDS_KEY: 'enterprise_repairs_v1',
    COUNTER_KEY: 'enterprise_serial_v1',
    THEME_KEY: 'enterprise_theme_v1',
    PREFIX: 'REP',
    MOBILE_BREAKPOINT: 768
};

// --- Core State Storage ---
const storage = {
    get: (key) => JSON.parse(localStorage.getItem(key)),
    set: (key, val) => localStorage.setItem(key, JSON.stringify(val))
};

class RepairApp {
    constructor() {
        this.records = storage.get(APP_CONFIG.RECORDS_KEY) || [];
        this.currentView = 'dashboard';
        this.theme = storage.get(APP_CONFIG.THEME_KEY) || 'light';
        this.currentEditId = null;

        this.init();
    }

    init() {
        this.applyTheme();
        this.setupNavigation();
        this.setupForm();
        this.setupSearch();
        this.render();

        // UI Globals
        document.getElementById('close-edit-overlay').onclick = () => this.toggleEditOverlay(false);
        document.getElementById('cancel-edit-btn').onclick = () => this.toggleEditOverlay(false);
        document.getElementById('theme-toggle').onclick = () => this.toggleTheme();

        // Responsive Listener
        window.addEventListener('resize', () => this.render());
    }

    // --- Toast System ---
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '✅',
            error: '❌',
            info: 'ℹ️',
            warning: '⚠️'
        };

        toast.innerHTML = `
            <span>${icons[type] || '🔔'}</span>
            <span>${message}</span>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('fade-out');
            toast.addEventListener('animationend', () => toast.remove());
        }, 3000);
    }

    // --- Navigation (SPA Logic) ---
    setupNavigation() {
        const allNavLinks = document.querySelectorAll('.nav-link, .mobile-nav-link');
        allNavLinks.forEach(link => {
            link.addEventListener('click', () => {
                const view = link.dataset.view;
                if (view) this.switchView(view);
            });
        });

        document.getElementById('header-new-btn').onclick = () => this.switchView('new-order');
        document.getElementById('view-all-history').onclick = () => this.switchView('history');
    }

    switchView(viewId) {
        this.currentView = viewId;

        document.querySelectorAll('.view-item').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(l => l.classList.remove('active'));

        const targetView = document.getElementById(`view-${viewId}`);
        const targetLinks = document.querySelectorAll(`[data-view="${viewId}"]`);

        if (targetView) targetView.classList.add('active');
        targetLinks.forEach(l => l.classList.add('active'));

        const titles = {
            'dashboard': 'Panel Principal',
            'new-order': 'Nueva Orden',
            'history': 'Historial',
            'settings': 'Ajustes'
        };
        document.getElementById('view-title').innerText = titles[viewId] || 'RepairTrack';

        this.render();
    }

    // --- Theme Management ---
    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.theme);
        storage.set(APP_CONFIG.THEME_KEY, this.theme);
    }

    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        this.applyTheme();
        this.showToast(`Modo ${this.theme === 'light' ? 'Claro' : 'Oscuro'} activado`, 'info');
    }

    // --- Data Management ---
    generateSerial() {
        let counter = storage.get(APP_CONFIG.COUNTER_KEY) || 0;
        counter++;
        storage.set(APP_CONFIG.COUNTER_KEY, counter);

        const year = new Date().getFullYear();
        return `${APP_CONFIG.PREFIX}-${year}-${String(counter).padStart(3, '0')}`;
    }

    setupForm() {
        const form = document.getElementById('main-repair-form');
        const editForm = document.getElementById('edit-repair-form');
        const imgInput = document.getElementById('f-image');
        const imgPreview = document.getElementById('form-img-preview');

        imgInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    imgPreview.innerHTML = `<img src="${ev.target.result}" style="width:100%; height:150px; object-fit:cover; border-radius:8px">`;
                };
                reader.readAsDataURL(file);
            }
        };

        form.onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const file = imgInput.files[0];
            let base64 = null;
            if (file) {
                base64 = await new Promise(r => {
                    const reader = new FileReader();
                    reader.onload = (ev) => r(ev.target.result);
                    reader.readAsDataURL(file);
                });
            }

            const newRecord = {
                id: this.generateSerial(),
                customer: formData.get('customer'),
                phone: formData.get('phone'),
                device: formData.get('device'),
                report: formData.get('report'),
                diagnosis: '',
                status: formData.get('status'),
                image: base64,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            this.records.unshift(newRecord);
            this.saveAndSync();
            this.showToast(`Orden ${newRecord.id} creada`, 'success');
            form.reset();
            imgPreview.innerHTML = '<span>📷 Subir fotografía</span>';
            this.switchView('dashboard');
        };

        editForm.onsubmit = (e) => {
            e.preventDefault();
            this.updateOrder();
        };

        document.getElementById('delete-order-btn').onclick = () => this.deleteOrder();
        document.getElementById('form-reset-btn').onclick = () => this.switchView('dashboard');
    }

    setupSearch() {
        document.getElementById('global-search').oninput = (e) => {
            this.render(e.target.value);
        };
    }

    // --- CRUD Actions ---
    prepareEdit(id) {
        const rec = this.records.find(r => r.id === id);
        if (!rec) return;

        this.currentEditId = id;
        document.getElementById('edit-id-title').innerText = id;
        document.getElementById('e-customer').value = rec.customer;
        document.getElementById('e-device').value = rec.device;
        document.getElementById('e-report').value = rec.report;
        document.getElementById('e-diagnosis').value = rec.diagnosis || '';
        document.getElementById('e-status').value = rec.status;

        this.toggleEditOverlay(true);
    }

    updateOrder() {
        const index = this.records.findIndex(r => r.id === this.currentEditId);
        if (index === -1) return;

        this.records[index] = {
            ...this.records[index],
            customer: document.getElementById('e-customer').value,
            device: document.getElementById('e-device').value,
            report: document.getElementById('e-report').value,
            diagnosis: document.getElementById('e-diagnosis').value,
            status: document.getElementById('e-status').value,
            updatedAt: new Date().toISOString()
        };

        this.saveAndSync();
        this.toggleEditOverlay(false);
        this.showToast('Actualizado', 'success');
    }

    deleteOrder() {
        const id = this.currentEditId;
        if (confirm(`⚠️ Eliminar ${id}?`)) {
            this.records = this.records.filter(r => r.id !== id);
            this.saveAndSync();
            this.toggleEditOverlay(false);
            this.showToast('Eliminado', 'warning');
        }
    }

    saveAndSync() {
        storage.set(APP_CONFIG.RECORDS_KEY, this.records);
        this.render();
    }

    toggleEditOverlay(show) {
        document.getElementById('edit-overlay').classList.toggle('hidden', !show);
    }

    // --- Dashboard Logic ---
    updateDashboard() {
        const stats = this.records.reduce((acc, rec) => {
            acc.total++;
            if (rec.status === 'pending') acc.pending++;
            else if (rec.status === 'process') acc.process++;
            else if (rec.status === 'ready') acc.ready++;
            return acc;
        }, { total: 0, pending: 0, process: 0, ready: 0 });

        this.animateNumber('stat-total', stats.total);
        this.animateNumber('stat-pending', stats.pending);
        this.animateNumber('stat-process', stats.process);
        this.animateNumber('stat-ready', stats.ready);
    }

    animateNumber(id, endValue) {
        const el = document.getElementById(id);
        if (!el) return;

        const startValue = parseInt(el.innerText) || 0;
        if (startValue === endValue) return;

        const duration = 800;
        let startTime = null;

        const step = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            const current = Math.floor(progress * (endValue - startValue) + startValue);
            el.innerText = current;
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };

        window.requestAnimationFrame(step);
    }

    // --- Adaptive Rendering Logic ---
    render(filter = '') {
        const isMobile = window.innerWidth <= APP_CONFIG.MOBILE_BREAKPOINT;

        // Update Stats
        this.updateDashboard();

        const container = document.getElementById('dashboard-table-body');
        const emptyState = document.getElementById('dashboard-empty');

        const filtered = this.records.filter(r =>
            r.id.toLowerCase().includes(filter.toLowerCase()) ||
            r.customer.toLowerCase().includes(filter.toLowerCase()) ||
            r.device.toLowerCase().includes(filter.toLowerCase())
        );

        if (filtered.length === 0) {
            if (emptyState) emptyState.classList.remove('hidden');
            if (container) container.innerHTML = '';
            return;
        }

        if (emptyState) emptyState.classList.add('hidden');

        if (isMobile) {
            this.renderCards(filtered);
        } else {
            this.renderTable(filtered);
        }
    }

    renderTable(records) {
        const tableBody = document.getElementById('dashboard-table-body');
        if (!tableBody) return;

        tableBody.style.display = 'table-row-group';

        const table = document.querySelector('.enterprise-table');
        if (table) table.style.display = 'table';

        if (document.getElementById('mobile-card-grid')) {
            document.getElementById('mobile-card-grid').remove();
        }

        tableBody.innerHTML = '';
        records.forEach(rec => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong style="color:var(--brand-primary)">${rec.id}</strong></td>
                <td>${rec.customer}</td>
                <td>${rec.device}</td>
                <td><span class="badge badge-${rec.status}">${this.formatStatus(rec.status)}</span></td>
                <td>${new Date(rec.createdAt).toLocaleDateString()}</td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="app.prepareEdit('${rec.id}')">Gestionar</button>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    }

    renderCards(records) {
        const table = document.querySelector('.enterprise-table');
        if (table) table.style.display = 'none';

        let cardContainer = document.getElementById('mobile-card-grid');
        if (!cardContainer) {
            cardContainer = document.createElement('div');
            cardContainer.id = 'mobile-card-grid';
            cardContainer.className = 'mobile-card-grid';
            if (table) table.parentNode.appendChild(cardContainer);
        }

        cardContainer.innerHTML = '';
        records.forEach(rec => {
            const card = document.createElement('div');
            card.className = 'mobile-repair-card';
            card.onclick = () => this.prepareEdit(rec.id);
            card.innerHTML = `
                <div class="card-header-row">
                    <span class="card-id">${rec.id}</span>
                    <span class="badge badge-${rec.status}">${this.formatStatus(rec.status)}</span>
                </div>
                <div class="card-main-info">
                    <span class="card-label">Cliente</span>
                    <span class="card-val">${rec.customer}</span>
                </div>
                <div class="card-main-info">
                    <span class="card-label">Equipo</span>
                    <span class="card-val">${rec.device}</span>
                </div>
                <div class="card-footer-row">
                    <span style="font-size:0.75rem; color:var(--text-muted)">📅 ${new Date(rec.createdAt).toLocaleDateString()}</span>
                    <span style="color:var(--brand-primary); font-size:0.8rem; font-weight:700">Gestionar ›</span>
                </div>
            `;
            cardContainer.appendChild(card);
        });
    }

    formatStatus(status) {
        const map = { pending: 'Pendiente', process: 'Diagnóstico', ready: 'Listo' };
        return map[status] || status;
    }
}

// Global Bootstrap
window.app = new RepairApp();
