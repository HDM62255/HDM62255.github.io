/**
 * Módulo de Calendario Personalizado "Antigravity"
 * Soporta: Selección individual, Rango (Shift+Click), Múltiple (Ctrl/Cmd+Click)
 */

export class CalendarWidget {
    constructor(options = {}) {
        this.selectedDates = new Set(); // Stores 'DD/MM/YYYY' strings
        this.currentMonth = new Date().getMonth();
        this.currentYear = new Date().getFullYear();
        this.container = null;
        this.config = Object.assign({
            onSelect: (dates) => console.log('Selected:', dates),
            initialDates: [],
            isStatic: false, // true for User View (injected), false for Global (overlay)
            overlayTarget: null, // Element to position over if isStatic is false
            singleMode: false // New option to force single selection
        }, options);

        // Load initial dates
        if (this.config.initialDates) {
            this.config.initialDates.forEach(d => this.selectedDates.add(d));
        }

        this.lastClickedDate = null; // For range selection
    }

    mount(parentElement) {
        // Create widget container
        this.container = document.createElement('div');
        this.container.className = `calendar-widget ${this.config.isStatic ? 'calendar-static' : 'calendar-overlay'}`;

        // If overlay, positioning logic is handled by caller or CSS, but we ensure it's absolute
        // Render initial state
        this._render();

        // Append to DOM
        parentElement.appendChild(this.container);

        // Click outside listener for overlay mode
        if (!this.config.isStatic) {
            this._boundClickOutside = this._handleClickOutside.bind(this);
            setTimeout(() => { // Defer to avoid immediate closing if click trigger
                document.addEventListener('click', this._boundClickOutside);
            }, 50);
        }
    }

    destroy() {
        if (this.container) {
            this.container.remove();
        }
        if (this._boundClickOutside) {
            document.removeEventListener('click', this._boundClickOutside);
        }
    }

    _handleClickOutside(e) {
        if (this.container && !this.container.contains(e.target) &&
            (!this.config.overlayTarget || !this.config.overlayTarget.contains(e.target))) {
            this.config.onSelect(Array.from(this.selectedDates)); // Confirm on close? Or just close
            // Optional: destroy on outside click if desired, or let parent handle
            // For now, we assume parent might want to keep it open or destroy it.
            // Let's just notify? Actually usually overlays close.
            // But if we want to confirm selection, we might keep it until "Apply".
            // Let's assume "Apply" button is the main way to confirm, or auto-apply?
            // Requirement says "Selection... allows choice".
            // Let's rely on standard UI: click outside -> close (maybe not applying if no button clicked, or auto applying).
            // Let's AUTO APPLY when closing? No, safer to have Apply button.
        }
    }

    _render() {
        this.container.innerHTML = '';

        // Header
        const header = document.createElement('div');
        header.className = 'calendar-header';

        const prevBtn = document.createElement('button');
        prevBtn.className = 'calendar-nav-btn';
        prevBtn.innerHTML = '<i class="bi bi-chevron-left"></i>';
        prevBtn.onclick = () => this._changeMonth(-1);

        const title = document.createElement('div');
        title.className = 'calendar-title';
        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        title.innerText = `${monthNames[this.currentMonth]} ${this.currentYear}`;

        const nextBtn = document.createElement('button');
        nextBtn.className = 'calendar-nav-btn';
        nextBtn.innerHTML = '<i class="bi bi-chevron-right"></i>';
        nextBtn.onclick = () => this._changeMonth(1);

        header.append(prevBtn, title, nextBtn);
        this.container.appendChild(header);

        // Grid Headers (Mo, Tu, ...)
        const grid = document.createElement('div');
        grid.className = 'calendar-grid';
        const daysShort = ["L", "M", "X", "J", "V", "S", "D"];
        daysShort.forEach(d => {
            const el = document.createElement('div');
            el.className = 'calendar-day-header';
            el.innerText = d;
            grid.appendChild(el);
        });

        // Days
        const firstDayOfMonth = new Date(this.currentYear, this.currentMonth, 1).getDay(); // 0=Sun, 1=Mon
        // Adjust for Monday start: Mon=0, ..., Sun=6
        let startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

        const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();

        // Empty slots
        for (let i = 0; i < startOffset; i++) {
            const empty = document.createElement('div');
            empty.className = 'calendar-day empty';
            grid.appendChild(empty);
        }

        // Days
        const today = new Date();
        const isTodayMonth = today.getMonth() === this.currentMonth && today.getFullYear() === this.currentYear;

        for (let d = 1; d <= daysInMonth; d++) {
            const dayEl = document.createElement('div');
            dayEl.className = 'calendar-day';
            dayEl.innerText = d;

            // Generate Key DD/MM/YYYY with leading zeros
            const key = `${String(d).padStart(2, '0')}/${String(this.currentMonth + 1).padStart(2, '0')}/${this.currentYear}`;

            if (this.selectedDates.has(key)) {
                dayEl.classList.add('selected');
            }

            if (isTodayMonth && d === today.getDate()) {
                dayEl.classList.add('today');
            }

            dayEl.onclick = (e) => this._handleDayClick(e, key, d);
            grid.appendChild(dayEl);
        }

        this.container.appendChild(grid);

        // Footer
        const footer = document.createElement('div');
        footer.className = 'calendar-footer';

        const info = document.createElement('span');
        info.className = 'calendar-info';
        info.innerText = `${this.selectedDates.size} días seleccionados`;

        const applyBtn = document.createElement('button');
        applyBtn.className = 'calendar-apply-btn';
        applyBtn.innerText = 'Aplicar';
        applyBtn.onclick = () => {
            this.config.onSelect(Array.from(this.selectedDates).sort());
            this.destroy();
        }

        footer.append(info, applyBtn);
        this.container.appendChild(footer);
    }

    _changeMonth(delta) {
        this.currentMonth += delta;
        if (this.currentMonth > 11) { this.currentMonth = 0; this.currentYear++; }
        if (this.currentMonth < 0) { this.currentMonth = 11; this.currentYear--; }
        this._render();
    }

    _handleDayClick(e, dateKey, dayNum) {
        if (!this.config.singleMode && (e.ctrlKey || e.metaKey)) {
            // Toggle
            if (this.selectedDates.has(dateKey)) {
                this.selectedDates.delete(dateKey);
            } else {
                this.selectedDates.add(dateKey);
            }
            this.lastClickedDate = dateKey;
        } else if (!this.config.singleMode && e.shiftKey && this.lastClickedDate) {
            // Range
            this._selectRange(this.lastClickedDate, dateKey);
        } else {
            // Single select (clears others)
            // Default behavior or forced by singleMode
            this.selectedDates.clear();
            this.selectedDates.add(dateKey);
            this.lastClickedDate = dateKey;
        }
        this._render();
    }

    _selectRange(startKey, endKey) {
        // Parse 'DD/MM/YYYY'
        const parse = (k) => {
            const p = k.split('/');
            return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
        };
        const d1 = parse(startKey);
        const d2 = parse(endKey);

        const start = d1 < d2 ? d1 : d2;
        const end = d1 < d2 ? d2 : d1;

        // Iterate and add
        const current = new Date(start);
        while (current <= end) {
            const k = `${String(current.getDate()).padStart(2, '0')}/${String(current.getMonth() + 1).padStart(2, '0')}/${current.getFullYear()}`;
            this.selectedDates.add(k);
            current.setDate(current.getDate() + 1);
        }
    }
}
