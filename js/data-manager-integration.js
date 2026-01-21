// ============================================================================
// DATA MANAGER INTEGRATION - App Rilievo v5.75
// ============================================================================
// Questo file SOSTITUISCE le funzioni updatePosition, updateProduct, updateMisura
// dell'app rilievo per usare DATA_MANAGER come core, mantenendo la logica specifica.
//
// INSTALLAZIONE:
// 1. Carica data-manager.js PRIMA di questo file
// 2. Carica questo file DOPO app.js (sovrascrive le funzioni)
//
// <script src=".../data-manager.js"></script>
// <script src="js/app.js"></script>
// <script src="js/data-manager-integration.js"></script>  <!-- QUESTO FILE -->
// ============================================================================

const DM_INTEGRATION_VERSION = '1.0.0';

console.log(`🔗 Data Manager Integration v${DM_INTEGRATION_VERSION} - Caricamento...`);

// Verifica dipendenze
if (typeof DATA_MANAGER === 'undefined') {
    console.error('❌ DATA_MANAGER non trovato! Carica data-manager.js PRIMA di questo file.');
} else {
    console.log(`✅ DATA_MANAGER v${DATA_MANAGER.VERSION} trovato`);
}

// ============================================================================
// OVERRIDE: updatePosition
// ============================================================================

window.updatePosition = (projectId, posId, field, value) => {
    markUserTyping(); // Track digitazione per sync silenzioso
    
    const project = state.projects.find(p => p.id === projectId);
    if (!project) return;
    
    // 🆕 Usa DATA_MANAGER per la logica di base (include sync quantità)
    const success = DATA_MANAGER.updatePosition(project, posId, field, value);
    
    if (success) {
        // ✅ FIX UI: Rimuovi bordo rosso quando compili ambiente
        if (field === 'ambiente' && value && value.trim() !== '') {
            const selectEl = document.getElementById(`ambiente-select-${posId}`);
            const inputEl = document.getElementById(`ambiente-input-${posId}`);
            
            if (selectEl) {
                selectEl.classList.remove('border-red-500', 'bg-red-50');
                selectEl.classList.add('border-gray-300');
            }
            if (inputEl) {
                inputEl.classList.remove('border-red-500', 'bg-red-50');
                inputEl.classList.add('border-gray-300');
            }
        }
        
        saveState();
    }
    
    console.log(`✅ updatePosition (via DATA_MANAGER): ${posId}.${field} = ${value}`);
};

// ============================================================================
// OVERRIDE: updateMisura
// ============================================================================

window.updateMisura = (projectId, posId, field, value) => {
    markUserTyping();
    
    const project = state.projects.find(p => p.id === projectId);
    if (!project) return;
    
    // 🆕 Usa DATA_MANAGER
    DATA_MANAGER.updateMisura(project, posId, field, value);
    saveState();
    
    console.log(`✅ updateMisura (via DATA_MANAGER): ${posId}.misure.${field} = ${value}`);
};

// ============================================================================
// OVERRIDE: updateMisuraWithValidation
// ============================================================================

window.updateMisuraWithValidation = (projectId, posId, field, value) => {
    markUserTyping();
    
    const project = state.projects.find(p => p.id === projectId);
    if (!project) return;
    
    // 🆕 Usa DATA_MANAGER (include gestione validationOverrides)
    DATA_MANAGER.updateMisuraWithValidation(project, posId, field, value);
    
    // Logica specifica app: Ricalcola BRM per tutti i prodotti della posizione
    const pos = DATA_MANAGER.findPosition(project, posId);
    if (pos && typeof ricalcolaBRMPerPosizione === 'function') {
        ricalcolaBRMPerPosizione(project, pos);
    }
    
    render();
};

// ============================================================================
// OVERRIDE: updateProduct (COMPLESSO - mantiene logica BRM specifica)
// ============================================================================

// Salva riferimento alla funzione originale se esiste
const _originalUpdateProduct = typeof updateProduct === 'function' ? updateProduct : null;

window.updateProduct = function(projectId, posId, productType, field, value) {
    markUserTyping();
    
    const project = state.projects.find(p => p.id === projectId);
    if (!project) return;
    
    const pos = DATA_MANAGER.findPosition(project, posId);
    if (!pos || !pos[productType]) return;
    
    // ========================================================================
    // FASE 1: Applica aggiornamento base via DATA_MANAGER
    // Include: sync colori PVC, auto tipoInfissoAssociato, auto cerniere
    // ========================================================================
    DATA_MANAGER.applyProductUpdate(pos, productType, field, value);
    
    // ========================================================================
    // FASE 2: Logica SPECIFICA App Rilievo (non in DATA_MANAGER)
    // ========================================================================
    
    // --- INFISSI: Logica tagliTelaio ---
    if (productType === 'infisso' && field === 'tagliTelaio') {
        if (typeof getPosizioniTagli === 'function') {
            const posizioniTagli = getPosizioniTagli(value);
            if (project.configInfissi?.codTagliValues?.length === posizioniTagli.length) {
                pos.infisso.codTagliValues = [...project.configInfissi.codTagliValues];
            } else {
                pos.infisso.codTagliValues = new Array(posizioniTagli.length).fill('');
            }
        }
    }
    
    // --- INFISSI: Ricalcolo BRM quando cambia tipo ---
    if (productType === 'infisso' && field === 'tipo') {
        if (typeof calculateBRM === 'function') {
            const inf = pos.infisso;
            const brmConfig = inf.brmPersonalizzato || project.brmConfigInfissi;
            const brm = calculateBRM(project, pos, pos.misure, brmConfig, value);
            inf.BRM_L = brm.L;
            inf.BRM_H = brm.H;
            
            // Ricalcola anche zanzariera se presente
            if (pos.zanzariera) {
                const zan = pos.zanzariera;
                const zanConfig = zan.brmPersonalizzato || project.brmConfigZanzariere;
                const zanBrm = calculateBRM(project, pos, pos.misure, zanConfig, value);
                zan.BRM_L = zanBrm.L;
                zan.BRM_H = zanBrm.H;
            }
        }
    }
    
    // --- INFISSI: Ricalcolo BRM quando cambia tipoInfissoAssociato ---
    if (productType === 'infisso' && field === 'tipoInfissoAssociato') {
        if (typeof calculateBRM === 'function') {
            const inf = pos.infisso;
            const tipoPerBRM = value === 'PF' ? 'PF' : 'F';
            const brmConfig = inf.brmPersonalizzato || project.brmConfigInfissi;
            const brm = calculateBRM(project, pos, pos.misure, brmConfig, tipoPerBRM);
            inf.BRM_L = brm.L;
            inf.BRM_H = brm.H;
            console.log(`🔄 Ricalcolato BRM infisso per tipoInfissoAssociato=${value}`);
        }
        render();
    }
    
    // --- CASSONETTI: Ricalcolo BRM quando cambiano misure ---
    const misureCassonetto = ['LS', 'SRSX', 'ZSX', 'SRDX', 'ZDX', 'HCASS', 'B', 'C', 'BSuperiore'];
    if (productType === 'cassonetto' && misureCassonetto.includes(field)) {
        if (typeof calculateBRM === 'function') {
            const cas = pos.cassonetto;
            const brmConfig = cas.brmPersonalizzato || project.brmConfigCassonetti;
            const brm = calculateBRM(project, pos, cas, brmConfig);
            cas.BRM_L = brm.L;
            cas.BRM_H = brm.H;
        }
    }
    
    // --- PVC/PVC: Render immediato per sync colori ---
    if (productType === 'infisso' && (field === 'coloreInt' || field === 'coloreEst')) {
        const inf = pos.infisso;
        if (inf.finituraInt === 'pvc' && inf.finituraEst === 'pvc') {
            saveState();
            render();
            return; // Evita doppio save/render
        }
    }
    
    // ========================================================================
    // FASE 3: Salvataggio e Render condizionale
    // ========================================================================
    saveState();
    
    // Render solo quando necessario per aggiornare UI
    const needsRender = [
        // Tipo infisso/persiana: aggiorna radio tipoInfissoAssociato
        (productType === 'infisso' || productType === 'persiana') && field === 'tipo',
        // Fissaggio persiane: mostra/nascondi telai
        productType === 'persiana' && field === 'fissaggio',
        // Ferramenta: aggiorna preview codice
        productType === 'infisso' && ['ferramenta1', 'lato1', 'esecuzione1', 'azienda', 'codiceModello'].includes(field),
        // Tipo anta: mostra/nascondi sezione Anta Twin
        productType === 'infisso' && field === 'tipoAnta',
        // Tapparella: checkbox cosa serve
        productType === 'tapparella' && ['serveTapparella', 'serveMotore', 'serveAccessori'].includes(field)
    ].some(Boolean);
    
    if (needsRender) {
        render();
    }
    
    console.log(`✅ updateProduct (via DATA_MANAGER + logica specifica): ${posId}.${productType}.${field}`);
};

// ============================================================================
// HELPER: Verifica integrazione
// ============================================================================

window.checkDataManagerIntegration = function() {
    const checks = {
        'DATA_MANAGER disponibile': typeof DATA_MANAGER !== 'undefined',
        'DATA_MANAGER.VERSION': DATA_MANAGER?.VERSION || 'N/A',
        'updatePosition override': window.updatePosition.toString().includes('DATA_MANAGER'),
        'updateProduct override': window.updateProduct.toString().includes('DATA_MANAGER'),
        'updateMisura override': window.updateMisura.toString().includes('DATA_MANAGER'),
        'calculateBRM disponibile': typeof calculateBRM === 'function',
        'getPosizioniTagli disponibile': typeof getPosizioniTagli === 'function',
        'ricalcolaBRMPerPosizione disponibile': typeof ricalcolaBRMPerPosizione === 'function'
    };
    
    console.log('🔍 Verifica integrazione DATA_MANAGER:');
    console.table(checks);
    
    return checks;
};

// ============================================================================
// INIT
// ============================================================================

console.log(`✅ Data Manager Integration v${DM_INTEGRATION_VERSION} - Funzioni sostituite!`);
console.log('   📌 updatePosition → DATA_MANAGER.updatePosition()');
console.log('   📌 updateProduct → DATA_MANAGER.applyProductUpdate() + logica BRM');
console.log('   📌 updateMisura → DATA_MANAGER.updateMisura()');
console.log('   💡 Esegui checkDataManagerIntegration() per verificare');
