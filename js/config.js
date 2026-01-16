// ═══════════════════════════════════════════════════════════════════════════════
// ⚙️ CONFIGURAZIONE APP OPENPORTE
// ═══════════════════════════════════════════════════════════════════════════════

// State Management
let state = {
    screen: 'list',
    projects: [],
    currentProject: null,
    currentPosition: null,
    setupStep: 1,
    showRiepilogoRilievi: false,  // Per mostrare il riepilogo rilievi
    sincronizzazioneVerificata: false,  // Flag per verifica sincronizzazione (1 volta per sessione)
    projectMenuOpen: false,  // ✅ FASE 021: Menu laterale aperto/chiuso
    configMenuExpanded: false,  // ✅ FASE 021: Submenu Config espanso/collassato
    mainMenuOpen: false,  // ✅ FASE 023: Menu principale applicazione
    showNewProjectModal: false,  // 🆕 v5.722: Modal nuovo progetto
    // 📦 FASE 027K: GitHub Sync
    github: {
        connected: false,
        token: null,
        lastSyncTime: null,
        syncStatus: 'disconnected', // disconnected|synced|syncing|error
        autoSyncEnabled: true,
        autoBackupEnabled: true,
        syncNotifications: true
    }
};

// ⚙️ VERSIONE APP - UNICO PUNTO DA MODIFICARE
const APP_VERSION = '5.746';
const APP_VERSION_NOTE = '🪟 Click Zip: serveClickZip + Quantità';

// 📦 GitHub Configuration
// 📦 FASE 027K: Configurazione GitHub Sync
const GITHUB_CONFIG = {
    enabled: true,
    owner: 'Openporte2025',
    repo: 'dati-cantieri',
    projectsPath: 'progetti',  // ⚡ FIX: Path cartella progetti
    branch: 'main',
    token: '', // Caricato da localStorage
    lastSync: null,
    autoSyncInterval: 5 * 60 * 1000  // 5 minuti
};

let syncInterval = null;  // Timer per sync automatica

// ═══════════════════════════════════════════════════════════════════════════════
// SISTEMA INDICATORI COMPLETAMENTO
// ═══════════════════════════════════════════════════════════════════════════════
const CompletionSystem = {
    checkProjectData(project) {
        return !!(project.name && project.client);
    },
    checkClientData(project) {
        const c = project.clientData || {};
        return !!(c.nome || c.cognome || c.telefono);
    },
    checkProducts(project) {
        const p = project.prodotti || {};
        return Object.values(p).some(v => v === true);
    },
    checkCaratteristicheMuro(project) {
        const m = project.caratteristicheMuro || {};
        return Object.values(m).some(v => v && v !== '');
    },
    checkConfigInfissi(project) {
        if (!project.prodotti?.infissi) return null;
        const c = project.configInfissi || {};
        return !!(c.azienda || c.telaio);
    },
    checkConfigPersiane(project) {
        if (!project.prodotti?.persiane) return null;
        const c = project.configPersiane || {};
        return !!(c.azienda || c.modello);
    },
    checkConfigTapparelle(project) {
        if (!project.prodotti?.tapparelle) return null;
        const c = project.configTapparelle || {};
        return !!(c.azienda || c.tipo);
    },
    checkConfigZanzariere(project) {
        if (!project.prodotti?.zanzariere) return null;
        const c = project.configZanzariere || {};
        return !!(c.azienda || c.modelloF);
    },
    checkConfigCassonetti(project) {
        if (!project.prodotti?.cassonetti) return null;
        const c = project.configCassonetti || {};
        return !!(c.tipo || c.azienda);
    },
    checkRilieviGlobali(project) {
        const rilievi = [
            project.rilievoInfissi,
            project.rilievoPersiane,
            project.rilievoTapparelle,
            project.rilievoZanzariere,
            project.rilievoCassonetti
        ].filter(r => r && (r.materiale || r.togliere || r.smaltimento));
        return rilievi.length > 0;
    },
    checkBRMGlobali(project) {
        const brm = [
            project.brmConfigInfissi,
            project.brmConfigPersiane,
            project.brmConfigTapparelle,
            project.brmConfigZanzariere,
            project.brmConfigCassonetti
        ].filter(b => b && (b.misuraBaseL || b.misuraBaseH));
        return brm.length > 0;
    },
    getOverallCompletion(project) {
        if (!project) return 0;
        const checks = [
            this.checkProjectData(project),
            this.checkClientData(project),
            this.checkProducts(project),
            this.checkCaratteristicheMuro(project),
            this.checkConfigInfissi(project),
            this.checkConfigPersiane(project),
            this.checkConfigTapparelle(project),
            this.checkConfigZanzariere(project),
            this.checkConfigCassonetti(project),
            this.checkRilieviGlobali(project),
            this.checkBRMGlobali(project)
        ].filter(v => v !== null);
        const completed = checks.filter(v => v === true).length;
        return checks.length > 0 ? Math.round((completed / checks.length) * 100) : 0;
    },
    getIcon(isComplete) {
        if (isComplete === null) return '';
        return isComplete ? '✅' : '⭕';
    },
    getBadgeHTML(isComplete) {
        if (isComplete === null) return '';
        const icon = this.getIcon(isComplete);
        const className = isComplete ? 'complete' : 'incomplete';
        return `<span class="completion-badge ${className}">${icon}</span>`;
    },
    getProgressBar(percentage) {
        const color = percentage === 100 ? '#10b981' : 
                     percentage >= 75 ? '#3b82f6' :
                     percentage >= 50 ? '#f59e0b' : '#ef4444';
        return `
            <div class="progress-bar" style="background: #e5e7eb; border-radius: 10px; height: 6px; overflow: hidden; margin: 5px 0;">
                <div style="width: ${percentage}%; height: 100%; background: ${color}; transition: width 0.3s;"></div>
            </div>
            <div style="font-size: 0.75rem; color: #6b7280; text-align: right;">${percentage}%</div>
        `;
    }
};

console.log('✅ config.js caricato - APP_VERSION: ' + APP_VERSION);
