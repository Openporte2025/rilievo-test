// 🦟 v8.66: Zanzariera clickabile + lista progetti sidebar rimossa + blocco-progetti con header (06 FEB 2026)
// 🏗️ v8.65: F5 persistence progetto + opzioni-prodotti.js integrato (05 FEB 2026)
// 🏗️ v8.64: Catalogo immagini portoncini FIN-Door inline (05 FEB 2026)
// 🏗️ v8.63: Fix portoncino preventivo - typeof check + try-catch + stub fallback (04 FEB 2026)
// 🏗️ v8.61: Fix lettura stato progetto da GitHub (preventivo/ordine/annullato) (04 FEB 2026)
// 🏗️ v8.60: Fix grata persa in conversione GitHub (positions vs posizioni) (03 FEB 2026)
// 🏗️ v8.63: Fix portoncino preventivo + F5 persistence blocco/vista (05 FEB 2026)
// Helper calcolo prezzi estratti in finstral-module.js (shared-database)
// ============================================================================
// DASHBOARD_VERSION e DASHBOARD_DATE → dichiarati in config.js (unica fonte)
// ============================================================================
// STATO APPLICAZIONE
// ============================================================================
let appState = {
    currentBlocco: 'generale',
    rilievoData: null,
    lastImport: null
};

// ============================================================================
// DIPENDENZE SHARED (prodotti-config.js):
//   getQta(), hasQta(), PRODOTTI_CONFIG, prodottoPresente(),
//   getProdottoData(), getQtaProdotto(), countAllProducts()
// Storico versioni → REGISTRO-AGGIORNAMENTI.md
// ============================================================================

/**
 * Chiude il modale preventivo se aperto
 * Chiamata da switchBlocco() per evitare conflitti UI
 */
function chiudiPreventivo() {
    // Cerca e chiudi eventuali modali preventivo aperti
    const modals = document.querySelectorAll('.modal-preventivo, #preventivoModal, #modalPreventivo');
    modals.forEach(modal => {
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('active', 'show');
        }
    });
    
    // Chiudi anche eventuali overlay
    const overlays = document.querySelectorAll('.modal-overlay, .preventivo-overlay');
    overlays.forEach(ov => {
        if (ov) ov.style.display = 'none';
    });
}

/**
 * Aggiorna visualizzazione versione dashboard
 * Chiamata dopo caricamento per mostrare versione corrente
 */
function updateDashboardVersion() {
    const versionEl = document.getElementById('dashboardVersion');
    if (versionEl && typeof DASHBOARD_VERSION !== 'undefined') {
        versionEl.textContent = `v${DASHBOARD_VERSION}`;
    }
}

// ============================================================================
// ============================================================================
// NORMALIZZAZIONE DATI - Garantisce .quantita e .qta uniformi
// ============================================================================
function normalizzaProdotto(prodotto) {
    if (!prodotto) return null;
    const qta = getQta(prodotto) || 1; // getQta() da prodotti-config.js
    prodotto.quantita = qta;
    prodotto.qta = qta;
    return prodotto;
}

/** Normalizza tutte le posizioni di un progetto */
function normalizzaProgettoCompleto(progetto) {
    if (!progetto) return progetto;
    
    const posizioni = progetto.posizioni || progetto.positions || [];
    
    posizioni.forEach(pos => {
        // Normalizza tutti i prodotti da PRODOTTI_CONFIG
        PRODOTTI_CONFIG.forEach(cfg => {
            if (pos[cfg.key]) pos[cfg.key] = normalizzaProdotto(pos[cfg.key]);
        });
        // Legacy: normalizza ingresso (container blindata/portoncino)
        if (pos.ingresso) pos.ingresso = normalizzaProdotto(pos.ingresso);
    });
    
    progetto.posizioni = posizioni;
    console.log(`✅ Normalizzate ${posizioni.length} posizioni`);
    return progetto;
}

// ============================================================================
// NAVIGAZIONE TRA BLOCCHI
// ============================================================================
function switchBlocco(bloccoName) {
    // ✅ FIX: Chiudi modale preventivo se aperta
    chiudiPreventivo();
    
    // Aggiorna stato
    appState.currentBlocco = bloccoName;
    // v8.63: Persisti per F5
    try { sessionStorage.setItem('dash_blocco', bloccoName); } catch(e) {}

    // Nascondi tutti i blocchi
    document.querySelectorAll('.blocco').forEach(b => b.classList.remove('active'));
    // Mostra blocco selezionato
    document.getElementById(`blocco-${bloccoName}`).classList.add('active');

    // Aggiorna pulsanti nav
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    
    // ✅ CORRETTO: Trova il bottone corretto in base al bloccoName
    const targetButton = document.querySelector(`.nav-btn.blocco-${bloccoName}`);
    if (targetButton) {
        targetButton.classList.add('active');
    }

    console.log(`✅ Switched to: ${bloccoName}`);
}

// ============================================================================
// FILE SELECTION
// ============================================================================
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        handleFile(file);
    }
}

// ============================================================================
// PROCESSAMENTO FILE JSON
// ============================================================================
function handleFile(file) {
    console.log('═══════════════════════════════════════');
    console.log('🔥 HANDLE FILE CALLED!');
    console.log(`📁 Name: ${file.name}`);
    console.log(`📊 Size: ${file.size} bytes`);
    console.log(`📋 Type: ${file.type}`);
    console.log('═══════════════════════════════════════');

    // Verifica sia JSON
    if (!file.name.endsWith('.json')) {
        console.error('❌ Not a JSON file');
        showAlert('error', '❌ Errore: Seleziona un file JSON valido');
        return;
    }

    console.log('✅ File is JSON');
    showAlert('info', `📂 Caricamento: ${file.name}...`);

    // 🆕 v8.509: Usa JSON_MANAGER se disponibile
    if (typeof JSON_MANAGER !== 'undefined') {
        console.log('📦 Using JSON_MANAGER for import...');
        JSON_MANAGER.uploadJSON(file, { source: 'dashboard-import' })
            .then(jsonData => {
                console.log('✅ JSON parsed via JSON_MANAGER');
                
                // Valida con JSON_MANAGER
                const validation = JSON_MANAGER.validateJSON(jsonData);
                if (validation.warnings.length > 0) {
                    console.warn('⚠️ Import warnings:', validation.warnings);
                }
                
                processRilievoData(jsonData, file.name);
            })
            .catch(error => {
                console.error('❌ JSON_MANAGER parse error:', error);
                // Fallback a metodo legacy
                console.log('🔄 Fallback to legacy import...');
                handleFileLegacy(file);
            });
        return;
    }

    // Fallback legacy
    handleFileLegacy(file);
}

// 🔄 Import legacy (fallback)
function handleFileLegacy(file) {
    const reader = new FileReader();

    reader.onload = function(e) {
        console.log('📖 FileReader onload triggered (legacy)');
        console.log(`📏 Content length: ${e.target.result.length} chars`);
        
        try {
            const jsonData = JSON.parse(e.target.result);
            console.log('✅ JSON parsed successfully');
            console.log('📋 JSON keys:', Object.keys(jsonData));
            
            // ⚠️ FIX: Carica i dati SEMPRE, anche se validazione fallisce
            // Il wizard si occuperà di completare i dati mancanti
            console.log('⚙️ Caricamento dati (validazione permissiva)...');
            processRilievoData(jsonData, file.name);
            
            // Valida per warnings (non bloccante)
            if (!validateRilievoJSON(jsonData)) {
                console.warn('⚠️ Validazione ha trovato problemi (non bloccanti)');
            }
        } catch (error) {
            console.error('❌ Parse error:', error);
            showAlert('error', `❌ Errore parsing JSON: ${error.message}`);
        }
    };

    reader.onerror = function() {
        console.error('❌ FileReader error');
        showAlert('error', '❌ Errore lettura file');
    };

    console.log('📖 Starting FileReader...');
    reader.readAsText(file);
}

// ============================================================================
// CONVERSIONE AUTOMATICA FORMATI JSON
// ============================================================================
function convertProjectsFormat(data) {
    console.log('🔄 AUTO-CONVERSION: Checking JSON format...');
    
    // FORMATO 0: JSON da GitHub (formato app-rilievo-027K-FIXED con project.rilievoInfissi)
    if (data.project && data.project.rilievoInfissi) {
        console.log('☁️ Detected: GITHUB format (app-rilievo-027K sync)');
        console.log(`   Found ${data.project.rilievoInfissi.length} posizioni in rilievoInfissi`);
        
        // Converti project.rilievoInfissi -> positions per processarlo come singolo progetto
        const githubProject = {
            id: data.id,
            name: data.projectName,
            client: data.customerName || data.projectName,
            positions: data.project.rilievoInfissi || [],
            clientData: {
                telefono: data.customerPhone || '',
                email: data.customerEmail || '',
                via: data.customerAddress || ''
            },
            createdAt: data.metadata?.createdAt || new Date().toISOString()
        };
        
        console.log(`   Converting GitHub format to standard...`);
        console.log(`   Project: "${githubProject.name}" with ${githubProject.positions.length} positions`);
        
        // Riusa la conversione formato singolo progetto
        return convertProjectsFormat({ projects: [githubProject] });
    }
    
    // FORMATO 1: JSON con "projects" array (formato app-rilievo multi-progetto)
    if (data.projects && Array.isArray(data.projects)) {
        console.log('📦 Detected: PROJECTS format (multi-project export)');
        console.log(`   Found ${data.projects.length} projects in file`);
        
        // Trova il primo progetto con posizioni non vuote
        const project = data.projects.find(p => p.positions && p.positions.length > 0);
        
        if (!project) {
            console.error('❌ No projects with positions found!');
            console.error('   All projects have empty positions arrays');
            return null;
        }
        
        console.log(`   Using project: "${project.name || project.client}" (${project.positions.length} positions)`);
        
        // Converti nel formato atteso dal dashboard
        const converted = {
            commessa_id: project.id || 'unknown',
            versione: data.version || '1.0',
            data_rilievo: project.createdAt || new Date().toISOString(),
            nome_ricerca: project.name || project.client,
            
            // ✅ FALLBACK: Preserva campi root per compatibilità v4.17
            name: project.name || '',
            client: project.client || '',
            clientData: project.clientData || {},
            
            // CLIENTE: converti da clientData (per retrocompatibilità)
            cliente: {
                nome: project.client || 'Cliente Sconosciuto',
                progetto: project.name || '',
                piano: project.clientData?.piano || '',
                indirizzo: project.clientData?.via || '',
                citta: project.clientData?.citta || '',
                telefono: project.clientData?.telefono || '',
                email: project.clientData?.email || ''
            },
            
            // NOTE PROGETTO
            note_progetto: project.note || '',
            
            // CARATTERISTICHE MURO GLOBALI
            caratteristiche_muro_globali: {
                telaio_larghezza: project.caratteristicheMuro?.telaioLarghezza || 0,
                telaio_altezza: project.caratteristicheMuro?.telaioProfondita || 0,
                falso_esistente: project.caratteristicheMuro?.falsoEsistente || 'no',
                spessore_falso: project.caratteristicheMuro?.spessoreFalso || 0,
                guida_tipo: project.caratteristicheMuro?.guidaEsistente === 'si' ? 'guida' : 'no',
                prof_muro_int: project.caratteristicheMuro?.profMuroInt || 0,
                prof_muro_est: project.caratteristicheMuro?.profMuroEst || 0,
                battuta_superiore_tapparella: project.caratteristicheMuro?.battutaSuperioreTapparella || 0
            },
            
            // POSIZIONI: converti da positions
            posizioni: (project.positions || []).map((pos, index) => {
                const converted_pos = {
                    id: pos.id || `P${String(index + 1).padStart(3, '0')}`,
                    nome: pos.name || `Posizione ${index + 1}`,
                    piano: pos.piano || '',
                    stanza: pos.ambiente || '',
                    ambiente: pos.ambiente || '',
                    // 🆕 v8.510: RIMOSSO pos.quantita - usa solo prodotto.qta
                    
                    // MISURE
                    misure: pos.misure || {},
                    
                    // PRODOTTI (converti da singular a oggetto con quantità)
                    infisso: pos.infisso ? {
                        quantita: getQta(pos.infisso) || 1,
                        tipo: pos.infisso.tipo || '',
                        apertura: pos.infisso.apertura || '',
                        azienda: pos.infisso.azienda || '',
                        brm: typeof getProductBRM !== 'undefined'
                            ? (function(){ const b = getProductBRM(pos.infisso, pos); return {L: b.L, H: b.H}; })()
                            : {
                            // 🔧 COMPATIBILITÀ: Supporta sia brm.L che BRM_L
                            L: pos.infisso.brm?.L || pos.infisso.BRM_L || 0,
                            H: pos.infisso.brm?.H || pos.infisso.BRM_H || 0
                        },
                        finitura_int: pos.infisso.finituraInt || '',
                        finitura_est: pos.infisso.finituraEst || '',
                        colore_int: pos.infisso.coloreInt || '',
                        colore_est: pos.infisso.coloreEst || ''
                    } : null,
                    
                    tapparella: pos.tapparella ? {
                        quantita: getQta(pos.tapparella) || 1,
                        azienda: pos.tapparella.azienda || '',
                        modello: pos.tapparella.modello || '',
                        tipologia: pos.tapparella.tipologia || '',
                        colore: pos.tapparella.colore || '',
                        colore_tipo: pos.tapparella.colore_tipo || 'tinta_unita',
                        guida: pos.tapparella.guida || '',
                        coloreGuida: pos.tapparella.coloreGuida || 'Argento',
                        manualeMot: pos.tapparella.manualeMot || 'Manuale',
                        motorizzazione: pos.tapparella.motorizzazione || (pos.tapparella.manualeMot === 'Motorizzata' ? 'si' : 'no'),
                        comando: pos.tapparella.comando || '',
                        motoreAzienda: pos.tapparella.motoreAzienda || '',
                        motoreModello: pos.tapparella.motoreModello || '',
                        sostEsistente: pos.tapparella.sostEsistente || '',
                        sostTipo: pos.tapparella.sostTipo || '',
                        accessoriDaSostituire: pos.tapparella.accessoriDaSostituire || {},
                        note: pos.tapparella.note || '',
                        brm: typeof getProductBRM !== 'undefined'
                            ? (function(){ const b = getProductBRM(pos.tapparella, pos); return {L: b.L, H: b.H}; })()
                            : {
                            L: parseInt(pos.tapparella.BRM_L) || parseInt(pos.tapparella.brm?.L) || 0,
                            H: parseInt(pos.tapparella.BRM_H) || parseInt(pos.tapparella.brm?.H) || 0
                        },
                        // 🆕 v7.82: Mantieni riferimenti originali per compatibilità
                        BRM_L: parseInt(pos.tapparella.BRM_L) || parseInt(pos.tapparella.brm?.L) || null,
                        BRM_H: parseInt(pos.tapparella.BRM_H) || parseInt(pos.tapparella.brm?.H) || null,
                        qta: String(getQta(pos.tapparella) || 1),
                        // 🆕 v7.995: Nuovi campi struttura motori
                        serveTapparella: pos.tapparella.serveTapparella !== false,
                        serveMotore: pos.tapparella.serveMotore || false,
                        serveAccessori: pos.tapparella.serveAccessori || false,
                        motoreModelloDefault: pos.tapparella.motoreModelloDefault || '',
                        motori: pos.tapparella.motori || []
                    } : null,
                    
                    cassonetto: pos.cassonetto ? {
                        quantita: getQta(pos.cassonetto) || 1,
                        tipo: pos.cassonetto.tipo || '',
                        azienda: pos.cassonetto.azienda || '',
                        // 🆕 v8.11: Aggiunti tutti i campi cassonetto
                        materialeCass: pos.cassonetto.materialeCass || '',
                        codiceCass: pos.cassonetto.codiceCass || '',
                        gruppoColoreCass: pos.cassonetto.gruppoColoreCass || '',
                        coloreCass: pos.cassonetto.coloreCass || '',
                        codiceIsolamento: pos.cassonetto.codiceIsolamento || '',
                        // Misure rilevate
                        LS: parseInt(pos.cassonetto.LS) || 0,
                        SRSX: parseInt(pos.cassonetto.SRSX) || 0,
                        SRDX: parseInt(pos.cassonetto.SRDX) || 0,
                        ZSX: parseInt(pos.cassonetto.ZSX) || 0,
                        ZSX_tipo: pos.cassonetto.ZSX_tipo || '',
                        ZDX: parseInt(pos.cassonetto.ZDX) || 0,
                        ZDX_tipo: pos.cassonetto.ZDX_tipo || '',
                        HCASS: parseInt(pos.cassonetto.HCASS) || 0,
                        B: parseInt(pos.cassonetto.B) || 0,
                        C: parseInt(pos.cassonetto.C) || 0,
                        BSuperiore: parseInt(pos.cassonetto.BSuperiore) || 0,
                        brm: typeof getProductBRM !== 'undefined'
                            ? (function(){ const b = getProductBRM(pos.cassonetto, pos); return {L: b.L, H: b.H, C: b.C, B: b.B}; })()
                            : {
                            L: parseInt(pos.cassonetto.BRM_L) || 0,
                            H: parseInt(pos.cassonetto.BRM_H) || parseInt(pos.cassonetto.HCASS) || 0,
                            C: parseInt(pos.cassonetto.BRM_C) || parseInt(pos.cassonetto.C) || 0,
                            B: parseInt(pos.cassonetto.BRM_B) || parseInt(pos.cassonetto.B) || 0
                        }
                    } : null,
                    
                    persiana: pos.persiana ? {
                        quantita: getQta(pos.persiana) || 1,
                        azienda: pos.persiana.azienda || '',
                        tipo: pos.persiana.tipo || '',
                        modello: pos.persiana.modello || '',
                        colore: pos.persiana.colorePersiana || pos.persiana.colore || '',
                        fissaggio: pos.persiana.fissaggio || '',
                        accessoriPersiana: pos.persiana.accessoriPersiana || null,
                        // 🔧 v8.54: BRM centralizzato con fallback
                        brm: typeof getProductBRM !== 'undefined'
                            ? (function(){ const b = getProductBRM(pos.persiana, pos); return {L: b.L, H: b.H}; })()
                            : { L: parseInt(pos.persiana.BRM_L) || parseInt(pos.persiana.brm?.L) || 0, H: parseInt(pos.persiana.BRM_H) || parseInt(pos.persiana.brm?.H) || 0 },
                        BRM_L: parseInt(pos.persiana.BRM_L) || parseInt(pos.persiana.brm?.L) || null,
                        BRM_H: parseInt(pos.persiana.BRM_H) || parseInt(pos.persiana.brm?.H) || null
                    } : null,
                    
                    zanzariera: pos.zanzariera ? {
                        quantita: getQta(pos.zanzariera) || 1,
                        // 🔧 v8.54: BRM centralizzato con fallback
                        brm: typeof getProductBRM !== 'undefined'
                            ? (function(){ const b = getProductBRM(pos.zanzariera, pos); return {L: b.L, H: b.H}; })()
                            : { L: parseInt(pos.zanzariera.BRM_L) || parseInt(pos.zanzariera.brm?.L) || 0, H: parseInt(pos.zanzariera.BRM_H) || parseInt(pos.zanzariera.brm?.H) || 0 },
                        BRM_L: parseInt(pos.zanzariera.BRM_L) || parseInt(pos.zanzariera.brm?.L) || null,
                        BRM_H: parseInt(pos.zanzariera.BRM_H) || parseInt(pos.zanzariera.brm?.H) || null
                    } : null,
                    
                    // 🪟 v8.43: CLICK ZIP GIBUS (schermature solari)
                    // 🪟 v8.489: Aggiunto serveClickZip e qta
                    clickZip: pos.clickZip && pos.clickZip.serveClickZip !== false ? {
                        azienda: 'GIBUS',
                        serveClickZip: pos.clickZip.serveClickZip !== false,  // 🆕 v8.489
                        qta: parseInt(pos.clickZip.qta) || 1,  // 🆕 v8.489
                        modello: pos.clickZip.modello || '',
                        larghezza: parseInt(pos.clickZip.larghezza) || 0,
                        altezza: parseInt(pos.clickZip.altezza) || 0,
                        tessuto: pos.clickZip.tessuto || '',
                        coloreStruttura: pos.clickZip.coloreStruttura || '',
                        prezzoListino: parseFloat(pos.clickZip.prezzoListino) || 0,
                        note: pos.clickZip.note || ''
                    } : null,
                    
                    // ☀️ v8.43: TENDE A BRACCI GIBUS (max 2 per posizione)
                    tendaBracci: pos.tendaBracci?.tende?.length > 0 ? {
                        azienda: 'GIBUS',
                        tende: (pos.tendaBracci.tende || []).map(t => ({
                            modello: t.modello || '',
                            larghezza: parseInt(t.larghezza) || 0,
                            sporgenza: parseInt(t.sporgenza) || 0,
                            tessuto: t.tessuto || '',
                            colore: t.colore || '',
                            prezzoListino: parseFloat(t.prezzoListino) || 0
                        }))
                    } : null,
                    
                    // 🔐 v7.98_04: INGRESSO (Porte Blindate/Portoncini)
                    // Supporta entrambi i formati: pos.ingresso.blindata (nuovo) e pos.blindata (legacy)
                    ingresso: (pos.ingresso || pos.blindata || pos.portoncino) ? {
                        tipo: pos.ingresso?.tipo || (pos.blindata ? 'blindata' : (pos.portoncino ? 'portoncino' : null)),
                        // BLINDATA OIKOS
                        blindata: (pos.ingresso?.blindata || pos.blindata) ? (() => {
                            const bld = pos.ingresso?.blindata || pos.blindata;
                            return {
                                LNP_L: bld.LNP_L || 0,
                                LNP_H: bld.LNP_H || 0,
                                luceCalcolata: bld.luceCalcolata || '',
                                azienda: bld.azienda || 'Oikos',
                                versione: bld.versione || 'E3',
                                tipoAnta: bld.tipoAnta || 'singola',
                                sensoApertura: bld.sensoApertura || '',
                                versoApertura: bld.versoApertura || '',
                                controtelaio: bld.controtelaio || 'si',
                                cilindro: bld.cilindro || 'BASIC',
                                coloreTelaio: bld.coloreTelaio || 'RAL8022',
                                acustica: bld.acustica || 'serie',
                                termica: bld.termica || 'serie',
                                kitAAV: bld.kitAAV || '',
                                rivestimentoInt: bld.rivestimentoInt || null,
                                rivestimentoEst: bld.rivestimentoEst || null,
                                imbotteEst: bld.imbotteEst || null,
                                imbotteEstAltezza: bld.imbotteEstAltezza || null,
                                imbotteEstLargh: bld.imbotteEstLargh || null,
                                imbotteEstEssenza: bld.imbotteEstEssenza || null,
                                corniciInt: bld.corniciInt || false,
                                corniciFermaPannello: bld.corniciFermaPannello || false,
                                vetro: bld.vetro || null,
                                sopraluce: bld.sopraluce || null,
                                fiancoluce: bld.fiancoluce || null
                            };
                        })() : null,
                        // PORTONCINO FINSTRAL
                        portoncino: (pos.ingresso?.portoncino || pos.portoncino) ? (pos.ingresso?.portoncino || pos.portoncino) : null
                    } : null,
                    
                    // 🔐 v7.98_04: ALIAS DI PRIMO LIVELLO per retrocompatibilità
                    // Il resto del codice accede a pos.blindata direttamente
                    blindata: (() => {
                        const bld = pos.ingresso?.blindata || pos.blindata;
                        if (!bld) return null;
                        return {
                            LNP_L: bld.LNP_L || 0,
                            LNP_H: bld.LNP_H || 0,
                            luceCalcolata: bld.luceCalcolata || '',
                            azienda: bld.azienda || 'Oikos',
                            versione: bld.versione || 'E3',
                            tipoAnta: bld.tipoAnta || 'singola',
                            sensoApertura: bld.sensoApertura || '',
                            versoApertura: bld.versoApertura || '',
                            controtelaio: bld.controtelaio || 'si',
                            cilindro: bld.cilindro || 'BASIC',
                            coloreTelaio: bld.coloreTelaio || 'RAL8022',
                            acustica: bld.acustica || 'serie',
                            termica: bld.termica || 'serie',
                            kitAAV: bld.kitAAV || '',
                            rivestimentoInt: bld.rivestimentoInt || null,
                            rivestimentoEst: bld.rivestimentoEst || null,
                            imbotteEst: bld.imbotteEst || null,
                            imbotteEstAltezza: bld.imbotteEstAltezza || null,
                            imbotteEstLargh: bld.imbotteEstLargh || null,
                            imbotteEstEssenza: bld.imbotteEstEssenza || null,
                            corniciInt: bld.corniciInt || false,
                            corniciFermaPannello: bld.corniciFermaPannello || false,
                            vetro: bld.vetro || null,
                            sopraluce: bld.sopraluce || null,
                            fiancoluce: bld.fiancoluce || null
                        };
                    })(),
                    
                    portoncino: (pos.ingresso?.portoncino || pos.portoncino) || null,
                    
                    // NOTE E RILIEVI - TUTTI I PRODOTTI
                    note: pos.note || '',
                    rilievo_preesistente: pos.rilievo || {},
                    rilievo_persiane: pos.rilievoPersiane || {},
                    rilievo_tapparelle: pos.rilievoTapparelle || {},
                    rilievo_zanzariere: pos.rilievoZanzariere || {},
                    rilievo_cassonetti: pos.rilievoCassonetti || {},
                    
                    // 🔒 v8.54: GRATA DI SICUREZZA
                    grata: pos.grata ? {
                        qta: String(getQta(pos.grata) || 1),
                        quantita: getQta(pos.grata) || 1,
                        azienda: pos.grata.azienda || 'Erreci',
                        linea: pos.grata.linea || '',
                        modello: pos.grata.modello || '',
                        tipoApertura: pos.grata.tipoApertura || '',
                        colore: pos.grata.colore || '',
                        tipoTelaio: pos.grata.tipoTelaio || 'A',
                        snodo: pos.grata.snodo || '400',
                        altezzaCilindro: pos.grata.altezzaCilindro || '600',
                        accessori: pos.grata.accessori || [],
                        brm: typeof getProductBRM !== 'undefined'
                            ? (function(){ const b = getProductBRM(pos.grata, pos); return {L: b.L, H: b.H}; })()
                            : { L: parseInt(pos.grata.BRM_L) || 0, H: parseInt(pos.grata.BRM_H) || 0 },
                        BRM_L: parseInt(pos.grata.BRM_L) || 0,
                        BRM_H: parseInt(pos.grata.BRM_H) || 0,
                        note: pos.grata.note || ''
                    } : null,
                    
                    // 🚪 v8.54: PORTA INTERNA (passthrough)
                    portaInterna: pos.portaInterna || null
                };
                
                return converted_pos;
            }),
            
            // TOTALI
            totali: {
                // 🆕 v8.55: Totali DINAMICI - usa presence check, non hasQta
                ...(() => {
                    const t = {};
                    t.n_posizioni = project.positions?.length || 0;
                    PRODOTTI_CONFIG.forEach(cfg => {
                        t['n_' + cfg.totaleKey] = (project.positions || []).filter(p => prodottoPresente(p, cfg)).reduce((sum, p) => sum + getQtaProdotto(p, cfg), 0);
                    });
                    t.n_ingressi = (project.positions || []).filter(p => p.ingresso || p.blindata || p.portoncino).length;
                    return t;
                })()
            }
        };
        
        console.log('✅ Conversion completed:');
        console.log(`   Cliente: ${converted.cliente.nome}`);
        console.log(`   Posizioni: ${converted.posizioni.length}`);
        console.log('═══════════════════════════════════════');
        
        return converted;
    }
    
    // FORMATO 2: JSON già nel formato corretto (con "posizioni")
    if (data.posizioni) {
        console.log('✅ Detected: STANDARD format (already compatible)');
        
        // 🔐 v7.98_04: Normalizza posizioni per estrarre blindata da ingresso
        data.posizioni = data.posizioni.map(pos => {
            // Se ha ingresso.blindata, copia in pos.blindata per retrocompatibilità
            if (pos.ingresso?.blindata && !pos.blindata) {
                console.log(`   🔐 Normalizing pos ${pos.id}: ingresso.blindata → blindata`);
                pos.blindata = pos.ingresso.blindata;
            }
            // Se ha ingresso.portoncino, copia in pos.portoncino
            // v8.63: check se pos.portoncino ha dati reali (BRM), non solo se esiste
            const ptcExist = pos.portoncino;
            const ptcIng = pos.ingresso?.portoncino;
            const hasPtcData = ptcExist && (parseInt(ptcExist.BRM_L) > 0 || parseInt(ptcExist.BRM_H) > 0 || ptcExist.tipoApertura);
            if (ptcIng && !hasPtcData) {
                console.log(`   🚪 Normalizing pos ${pos.id}: ingresso.portoncino → portoncino`);
                pos.portoncino = ptcIng;
            }
            return pos;
        });
        
        return data;
    }
    
    // FORMATO 3: JSON singolo progetto diretto (senza wrapper)
    if (data.positions && !data.projects) {
        console.log('📦 Detected: SINGLE PROJECT format');
        console.log('   Converting single project...');
        
        // Converti come se fosse projects[0]
        return convertProjectsFormat({ projects: [data] });
    }
    
    // ════════════════════════════════════════════════════════════════
    // FORMATO ODOO: JSON da integrazione CRM (con odoo_id, senza positions)
    // v8.498: Supporto progetti creati da Odoo
    // ════════════════════════════════════════════════════════════════
    if (data.odoo_id || data.odoo_customer) {
        console.log('🔗 Detected: ODOO format (CRM project)');
        console.log('   odoo_id:', data.odoo_id);
        console.log('   name:', data.name);
        
        // Usa DATA_MANAGER se disponibile per normalizzazione completa
        if (typeof DATA_MANAGER !== 'undefined' && DATA_MANAGER.normalizeProject) {
            console.log('   Using DATA_MANAGER.normalizeProject()...');
            const normalized = DATA_MANAGER.normalizeProject(data);
            
            // Se ora ha posizioni, è già nel formato corretto
            if (normalized.posizioni && Array.isArray(normalized.posizioni)) {
                console.log('✅ ODOO format normalized via DATA_MANAGER');
                return normalized;
            }
        }
        
        // Fallback: normalizzazione manuale se DATA_MANAGER non disponibile
        console.log('   Fallback: manual normalization...');
        const odooCustomer = data.odoo_customer || {};
        
        const normalized = {
            ...data,
            id: data.id || `ODOO-${data.odoo_id}`,
            nome_ricerca: data.name || odooCustomer.name || '',
            customerName: data.name || odooCustomer.name || '',
            client: data.name || odooCustomer.name || '',
            
            cliente: {
                nome: data.name || odooCustomer.name || '',
                indirizzo: odooCustomer.street || '',
                citta: odooCustomer.city || '',
                cap: odooCustomer.zip || '',
                telefono: odooCustomer.phone || odooCustomer.mobile || '',
                email: odooCustomer.email || ''
            },
            
            clientData: {
                nome: data.name || odooCustomer.name || '',
                telefono: odooCustomer.phone || odooCustomer.mobile || '',
                email: odooCustomer.email || '',
                indirizzo: odooCustomer.street || ''
            },
            
            positions: data.positions || [],
            posizioni: data.posizioni || data.positions || [],
            
            odoo_id: data.odoo_id,
            odoo_customer: odooCustomer
        };
        
        console.log('✅ ODOO format normalized (fallback)');
        console.log('   Cliente:', normalized.cliente.nome);
        console.log('   Posizioni:', normalized.posizioni.length);
        
        return normalized;
    }
    
    // FORMATO NON RICONOSCIUTO
    console.error('❌ Unknown JSON format');
    console.error('   Expected: "projects" array OR "posizioni" array OR "positions" array OR "odoo_id"');
    console.error('   Found keys:', Object.keys(data));
    return null;
}

// ============================================================================
// VALIDAZIONE JSON
// ============================================================================
function validateRilievoJSON(data) {
    console.log('═══════════════════════════════════════');
    console.log('🔍 VALIDATION STARTED');
    console.log('📋 JSON keys found:', Object.keys(data));
    console.log('═══════════════════════════════════════');
    
    // STEP 1: Prova conversione automatica
    const convertedData = convertProjectsFormat(data);
    if (!convertedData) {
        showAlert('error', '❌ Formato JSON non riconosciuto');
        return false;
    }
    
    // Sostituisci i dati con quelli convertiti
    Object.keys(data).forEach(key => delete data[key]);
    Object.assign(data, convertedData);

    // VALIDAZIONE MINIMA: serve solo "posizioni"
    if (!data.posizioni) {
        console.error('❌ Missing required field: "posizioni"');
        showAlert('error', '❌ Manca il campo "posizioni" nel JSON');
        return false;
    }

    if (!Array.isArray(data.posizioni)) {
        console.error('❌ Field "posizioni" must be an array');
        showAlert('error', '❌ Il campo "posizioni" deve essere un array');
        return false;
    }

    console.log(`✅ Found ${data.posizioni.length} posizioni`);

    // Cliente opzionale - usa default se manca
    if (!data.cliente) {
        console.warn('⚠️ Missing "cliente" - using default');
        data.cliente = { nome: 'Cliente Sconosciuto' };
    } else if (!data.cliente.nome) {
        console.warn('⚠️ Missing "cliente.nome" - using default');
        data.cliente.nome = 'Cliente Sconosciuto';
    }

    console.log('✅ VALIDATION PASSED!');
    console.log('═══════════════════════════════════════');
    return true;
}

// ============================================================================
// PROCESSAMENTO DATI RILIEVO
// ============================================================================
function processRilievoData(data, filename) {
    console.log('⚙️ Processing rilievo data...');
    
    // ✅ v8.60: Salva rawPositions PRIMA di qualsiasi manipolazione
    const rawPositions = window._githubProjectRef?.rawData?.positions;
    if (rawPositions) console.log(`📦 v8.60: rawPositions disponibili (${rawPositions.length} pos)`);
    
    // ✅ CONTROLLO SICUREZZA: Garantisci che posizioni sia un array
    if (!data.posizioni || !Array.isArray(data.posizioni)) {
        console.warn('⚠️ Dati senza campo posizioni valido, inizializzo array vuoto');
        data.posizioni = [];
    }

    // ⚠️ FIX CRITICO: Salva SEMPRE in currentData, indipendentemente dalla validazione
    // Questo permette al wizard di analizzare i dati e completarli
    window.currentData = data;
    console.log('✅ currentData salvato:', window.currentData);
    
    // 🆕 v8.508: Normalizza tutti i prodotti per avere 'quantita' uniforme
    window.currentData = normalizzaProgettoCompleto(window.currentData);
    
    // ✅ v8.60: SAFETY NET - Recupera prodotti persi durante conversione
    if (rawPositions && window.currentData.posizioni) {
        let recovered = 0;
        window.currentData.posizioni.forEach((pos, i) => {
            const rawPos = rawPositions[i];
            if (!rawPos) return;
            PRODOTTI_CONFIG.forEach(cfg => {
                const key = cfg.key;
                if (key === 'blindata' || key === 'portoncino') return;
                if (!pos[key] && rawPos[key]) {
                    const raw = rawPos[key];
                    pos[key] = { ...raw };
                    pos[key].quantita = parseInt(raw.qta || raw.quantita) || 1;
                    if (raw.qta) delete pos[key].qta;
                    recovered++;
                    console.log(`🔄 v8.60 Recovery: ${key} recuperato → pos ${i+1}`, raw);
                }
            });
        });
        if (recovered > 0) console.log(`✅ v8.60: Recuperati ${recovered} prodotti da rawData`);
    }
    
    // ✅ v8.58: Carica sconti override dal progetto
    if (typeof SCONTI_FORNITORI !== 'undefined') SCONTI_FORNITORI.loadFromProject();
    
    // ✅ v8.493: Imposta _githubProjectRef per permettere salvataggio su GitHub
    // Usa l'ID esistente dal JSON (commessa_id, id, o genera uno nuovo)
    const projectId = data.commessa_id || data.id || `proj-${Date.now()}`;
    const projectName = data.cliente?.nome || data.nome_ricerca || data.name || 'Progetto';
    
    window._githubProjectRef = {
        id: projectId,
        filename: `progetti/progetto-${projectId}.json`,
        nome: projectName,
        rawData: data
    };
    console.log('✅ v8.493: _githubProjectRef impostato per salvataggio GitHub:', window._githubProjectRef.id);
    // v8.65: Persisti progetto per F5
    try { sessionStorage.setItem('dash_project', projectId); } catch(e) {}
    
    // ✅ v8.493: Resetta flag per permettere ripristino config al primo render preventivo
    window._configPreventivoCarcato = false;
    
    // Salva nello stato - 🔧 v8.510: usa dati normalizzati
    appState.rilievoData = window.currentData;
    
    // Update menu status con nuovi dati
    if (window.CompletionTracker && menuStructure) {
        console.log('🔄 Updating menu status...');
        CompletionTracker.updateMenuStatus(menuStructure, data);
        // renderAdvancedMenu(); // Sidebar rimossa
        
        // Update badge completamento sui bottoni top nav
        updateTopNavBadges();
    }
    
    appState.lastImport = {
        filename: filename,
        timestamp: new Date().toISOString(),
        posizioni: window.currentData.posizioni.length
    };

    // Salva in localStorage - 🔧 v8.510: usa dati normalizzati
    saveToLocalStorage(window.currentData, filename);

    // Mostra successo
    showDataStatus(window.currentData);
    showAlert('success', `✅ Rilievo caricato con successo: ${window.currentData.posizioni.length} posizioni`);

    // Mostra contenuto
    document.getElementById('generalePlaceholder').style.display = 'none';
    document.getElementById('generaleContent').style.display = 'block';

    // 🔧 v8.510: USA window.currentData (normalizzato) invece di data (originale)
    const normalizedData = window.currentData;
    
    // Genera dashboard Blocco Generale
    generateKPIDashboard(normalizedData);
    populateFilters(normalizedData);
    generateTable(normalizedData);

    // Genera Vista Generale Blocco Ufficio
    renderVistaGeneraleUfficio(normalizedData);
    
    // Prepara dati per Vista Posizioni (renderizzata quando attivata)
    // I dati sono già in currentData, la vista si popolerà al click del submenu

    // ✅ NUOVO: Prepara viste Blocco Posa
    // Le viste si popoleranno quando l'utente passerà al Blocco Posa
    
    // ✅ SISTEMA PREVENTIVAZIONE: Abilita pulsanti
    const btnPreventivo = document.getElementById('btn-preventivo');
    if (btnPreventivo) {
        btnPreventivo.disabled = false;
        btnPreventivo.style.opacity = '1';
        btnPreventivo.style.cursor = 'pointer';
        console.log('✅ Pulsante Analisi Costi abilitato');
    }
    
    const btnConferma = document.getElementById('btn-conferma-cliente');
    if (btnConferma) {
        btnConferma.disabled = false;
        btnConferma.style.opacity = '1';
        btnConferma.style.cursor = 'pointer';
        console.log('✅ Pulsante Conferma Cliente abilitato');
    }

    // ✅ MENU DINAMICO v7.27: Aggiorna indicatori completamento
    aggiornaMenuIndicatori();
    
    // ✅ v7.73: Aggiorna config globale quando cambia il progetto
    projectData = data;
    renderConfigGlobale();
    initConfigMenu();
    console.log('⚙️ v7.73: Config globale aggiornata in processRilievoData');

    console.log('✅ Data processed and stored');
}

// ============================================================================
// ✅ MENU DINAMICO CON INDICATORI v7.27
// ============================================================================

/**
 * Calcola completamento Blocco GENERALE
 * Campi: cliente, telefono, indirizzo, citta, dataRilievo, tecnico
 */
function calcolaCompletamentoGenerale(data) {
    if (!data) return 0;
    
    let completati = 0;
    const totali = 6;
    
    if (data.cliente_nome && data.cliente_nome.trim()) completati++;
    if (data.cliente_telefono && data.cliente_telefono.trim()) completati++;
    if (data.cliente_indirizzo && data.cliente_indirizzo.trim()) completati++;
    if (data.cliente_citta && data.cliente_citta.trim()) completati++;
    if (data.data_rilievo && data.data_rilievo.trim()) completati++;
    if (data.tecnico_nome && data.tecnico_nome.trim()) completati++;
    
    return Math.round((completati / totali) * 100);
}

/**
 * Calcola completamento Blocco UFFICIO
 * Somma di tutti i campi configurazione prodotti
 */
function calcolaCompletamentoUfficio(data) {
    if (!data || !data.configurazioni) return 0;
    
    let completati = 0;
    let totali = 0;
    const config = data.configurazioni;
    
    // Configurazione Infissi (8 campi)
    if (config.infissi) {
        totali += 8;
        if (config.infissi.azienda) completati++;
        if (config.infissi.telaio) completati++;
        if (config.infissi.materialeTelaio) completati++;
        if (config.infissi.tipoAnta) completati++;
        if (config.infissi.vetro) completati++;
        if (config.infissi.coloreInterno) completati++;
        if (config.infissi.coloreEsterno) completati++;
        if (config.infissi.maniglia) completati++;
    }
    
    // Configurazione Persiane (5 campi)
    if (config.persiane) {
        totali += 5;
        if (config.persiane.azienda) completati++;
        if (config.persiane.tipo) completati++;
        if (config.persiane.colore) completati++;
        if (config.persiane.oscurante) completati++;
        if (config.persiane.automazione) completati++;
    }
    
    // Configurazione Tapparelle (4 campi)
    if (config.tapparelle) {
        totali += 4;
        if (config.tapparelle.azienda) completati++;
        if (config.tapparelle.tipo) completati++;
        if (config.tapparelle.colore) completati++;
        if (config.tapparelle.automazione) completati++;
    }
    
    // Configurazione Zanzariere (4 campi)
    if (config.zanzariere) {
        totali += 4;
        if (config.zanzariere.azienda) completati++;
        if (config.zanzariere.tipo) completati++;
        if (config.zanzariere.colore) completati++;
        if (config.zanzariere.rete) completati++;
    }
    
    // Configurazione Cassonetti (3 campi)
    if (config.cassonetti) {
        totali += 3;
        if (config.cassonetti.azienda) completati++;
        if (config.cassonetti.tipo) completati++;
        if (config.cassonetti.isolamento) completati++;
    }
    
    if (totali === 0) return 0;
    return Math.round((completati / totali) * 100);
}

/**
 * Calcola completamento Blocco POSA
 * Media completamento posizioni (5 prodotti per posizione)
 */
function calcolaCompletamentoPosa(data) {
    if (!data || !data.posizioni || data.posizioni.length === 0) {
        return 0;
    }
    
    let totaleCompletamento = 0;
    
    data.posizioni.forEach(pos => {
        let completatiPos = 0;
        const totaliPos = 5; // 5 prodotti
        
        // Infisso
        if (hasQta(pos.infisso)) completatiPos++;
        
        // Persiana
        if (hasQta(pos.persiana)) completatiPos++;
        
        // Tapparella
        if (hasQta(pos.tapparella)) completatiPos++;
        
        // Zanzariera
        if (hasQta(pos.zanzariera)) completatiPos++;
        
        // Cassonetto
        if (hasQta(pos.cassonetto)) completatiPos++;
        
        totaleCompletamento += (completatiPos / totaliPos) * 100;
    });
    
    return Math.round(totaleCompletamento / data.posizioni.length);
}

/**
 * Calcola completamento Blocco PREVENTIVO
 * 100% se ha almeno 1 posizione con prezzi, altrimenti 0%
 */
function calcolaCompletamentoPreventivo(data) {
    if (!data || !data.posizioni || data.posizioni.length === 0) {
        return 0;
    }
    
    let hasPrezzi = false;
    
    data.posizioni.forEach(pos => {
        // Verifica se almeno 1 prodotto ha prezzo > 0
        if (pos.infisso && pos.infisso.prezzo > 0) hasPrezzi = true;
        if (pos.persiana && pos.persiana.prezzo > 0) hasPrezzi = true;
        if (pos.tapparella && pos.tapparella.prezzo > 0) hasPrezzi = true;
        if (pos.zanzariera && pos.zanzariera.prezzo > 0) hasPrezzi = true;
        if (pos.cassonetto && pos.cassonetto.prezzo > 0) hasPrezzi = true;
    });
    
    return hasPrezzi ? 100 : 0;
}

/**
 * Restituisce colore in base a percentuale completamento
 */
function getColoreIndicatore(percentuale) {
    if (percentuale === 100) return '#4CAF50'; // Verde
    if (percentuale >= 50) return '#FFC107';   // Giallo
    if (percentuale > 0) return '#F44336';     // Rosso
    return '#9E9E9E';                           // Grigio
}

/**
 * Aggiorna indicatore percentuale su singolo bottone menu
 */
function aggiornaIndicatoreMenu(blocco, percentuale) {
    const btn = document.querySelector(`.nav-btn.blocco-${blocco}`);
    if (!btn) {
        console.warn(`⚠️ Bottone menu non trovato: blocco-${blocco}`);
        return;
    }
    
    // Trova/crea span indicatore
    let indicator = btn.querySelector('.indicator-percentage');
    if (!indicator) {
        indicator = document.createElement('span');
        indicator.className = 'indicator-percentage';
        btn.appendChild(indicator);
    }
    
    // Aggiorna testo e colore
    indicator.textContent = `${percentuale}%`;
    indicator.style.color = getColoreIndicatore(percentuale);
}

/**
 * Aggiorna TUTTI gli indicatori menu
 */
function aggiornaMenuIndicatori() {
    const data = window.currentData || appState.rilievoData;
    
    if (!data) {
        console.warn('⚠️ Nessun dato disponibile per aggiornare indicatori');
        return;
    }
    
    console.log('🔄 Aggiornamento indicatori menu...');
    
    // Calcola percentuali
    const percGenerale = calcolaCompletamentoGenerale(data);
    const percUfficio = calcolaCompletamentoUfficio(data);
    const percPreventivo = calcolaCompletamentoPreventivo(data);
    
    console.log(`   Generale: ${percGenerale}%`);
    console.log(`   Ufficio: ${percUfficio}%`);
    console.log(`   Preventivo: ${percPreventivo}%`);
    
    // Aggiorna UI
    aggiornaIndicatoreMenu('generale', percGenerale);
    aggiornaIndicatoreMenu('ufficio', percUfficio);
    aggiornaIndicatoreMenu('preventivo', percPreventivo);
    
    console.log('✅ Indicatori menu aggiornati');
}

/**
 * Calcola percentuale completamento di un blocco (media delle sottosezioni)
 */
function calcolaCompletamentoBlocco(bloccoKey) {
    if (!menuStructure || !menuStructure[bloccoKey]) {
        return 0;
    }
    
    const items = menuStructure[bloccoKey].items;
    if (!items || items.length === 0) {
        return 0;
    }
    
    // Somma percentuali di tutte le sottosezioni
    let somma = 0;
    let count = 0;
    
    items.forEach(item => {
        if (item.completamento !== undefined) {
            somma += item.completamento;
            count++;
        }
    });
    
    // Calcola media e arrotonda
    return count > 0 ? Math.round(somma / count) : 0;
}

/**
 * Aggiorna badge completamento sui bottoni top navigation
 */
function updateTopNavBadges() {
    if (!menuStructure) {
        console.warn('⚠️ menuStructure non disponibile per top nav badges');
        return;
    }
    
    // Array dei blocchi da processare
    const blocchi = [
        { key: 'ufficio', selector: '.nav-btn.blocco-ufficio' }
    ];
    
    blocchi.forEach(blocco => {
        // Calcola percentuale completamento blocco
        const percent = calcolaCompletamentoBlocco(blocco.key);
        
        // Trova bottone
        const btn = document.querySelector(blocco.selector);
        if (!btn) {
            console.warn(`⚠️ Bottone non trovato: ${blocco.selector}`);
            return;
        }
        
        // Rimuovi badge esistente se presente
        const oldBadge = btn.querySelector('.completion-badge');
        if (oldBadge) {
            oldBadge.remove();
        }
        
        // Crea e aggiungi nuovo badge
        const badge = document.createElement('span');
        badge.className = 'completion-badge';
        badge.textContent = `${percent}%`;
        
        // Aggiungi tooltip
        badge.title = `Completamento ${blocco.key}: ${percent}%`;
        
        btn.appendChild(badge);
        
        console.log(`✅ Badge aggiunto a ${blocco.key}: ${percent}%`);
    });
}

// ============================================================================
// GENERA KPI DASHBOARD
// ============================================================================
function generateKPIDashboard(data) {
    console.log('📊 Generating KPI dashboard...');

    const stats = calculateStatistics(data);
    
    const kpiHTML = `
        <div class="kpi-card">
            <div class="kpi-label">Posizioni Totali</div>
            <div class="kpi-value">${stats.totalePosizioni}</div>
            <div class="kpi-subtitle">nel progetto</div>
        </div>

        <div class="kpi-card green">
            <div class="kpi-label">Infissi</div>
            <div class="kpi-value">${stats.totaleInfissi}</div>
            <div class="kpi-subtitle">${stats.percentualeInfissi}% del totale</div>
        </div>

        <div class="kpi-card orange">
            <div class="kpi-label">Tapparelle</div>
            <div class="kpi-value">${stats.totaleTapparelle}</div>
            <div class="kpi-subtitle">${stats.percentualeTapparelle}% del totale</div>
        </div>

        <div class="kpi-card teal">
            <div class="kpi-label">Altri Prodotti</div>
            <div class="kpi-value">${stats.totaleAltri}</div>
            <div class="kpi-subtitle">Persiane, zanzariere, etc.</div>
        </div>

        <div class="kpi-card">
            <div class="kpi-label">Piani</div>
            <div class="kpi-value">${stats.numeroPiani}</div>
            <div class="kpi-subtitle">${stats.numeroStanze} stanze totali</div>
        </div>

        <div class="kpi-card green">
            <div class="kpi-label">Completamento</div>
            <div class="kpi-value">${stats.completamento}%</div>
            <div class="kpi-subtitle">Rilievo completo</div>
        </div>
    `;

    document.getElementById('kpiCards').innerHTML = kpiHTML;
    console.log('✅ KPI dashboard generated');
}

// ============================================================================
// ============================================================================
// CALCOLA STATISTICHE - v8.57: USA PRODOTTI_CONFIG (shared)
// ============================================================================
function calculateStatistics(data) {
    // Usa countAllProducts da prodotti-config.js
    const posizioni = data.posizioni || data.positions || [];
    const counts = countAllProducts(posizioni);
    const pianiSet = new Set();
    const stanzeSet = new Set();
    posizioni.forEach(pos => {
        if (pos.piano) pianiSet.add(pos.piano);
        if (pos.stanza) stanzeSet.add(pos.stanza);
    });

    // Retrocompatibilità: genera chiavi totaleXxx per KPI
    const totaleInfissi = counts.n_infissi || 0;
    const totaleTapparelle = counts.n_tapparelle || 0;
    const totalePersiane = counts.n_persiane || 0;
    const totaleZanzariere = counts.n_zanzariere || 0;
    const totaleCassonetti = counts.n_cassonetti || 0;
    const totaleAltri = totalePersiane + totaleZanzariere + totaleCassonetti;
    const totaleProdotti = Object.keys(counts).filter(k => k.startsWith('n_') && k !== 'n_posizioni').reduce((sum, k) => sum + counts[k], 0);

    return {
        totalePosizioni: posizioni.length, totaleInfissi, totaleTapparelle,
        totalePersiane, totaleZanzariere, totaleCassonetti, totaleAltri, totaleProdotti,
        ...counts, // Include tutti i contatori n_xxx
        percentualeInfissi: totaleProdotti > 0 ? Math.round((totaleInfissi / totaleProdotti) * 100) : 0,
        percentualeTapparelle: totaleProdotti > 0 ? Math.round((totaleTapparelle / totaleProdotti) * 100) : 0,
        numeroPiani: pianiSet.size, numeroStanze: stanzeSet.size, completamento: 100
    };
}

// ============================================================================
// POPOLA FILTRI
// ============================================================================
function populateFilters(data) {
    console.log('🔍 Populating filters...');

    const posizioni = data.posizioni || [];
    const pianiSet = new Set();
    const stanzeSet = new Set();
    const prodottiSet = new Set();

    posizioni.forEach(pos => {
        if (pos.piano) pianiSet.add(pos.piano);
        if (pos.stanza) stanzeSet.add(pos.stanza);

        // Raccogli tipi prodotti presenti
        if (hasQta(pos.infisso)) prodottiSet.add('Infisso');
        if (hasQta(pos.tapparella)) prodottiSet.add('Tapparella');
        if (hasQta(pos.persiana)) prodottiSet.add('Persiana');
        if (hasQta(pos.zanzariera)) prodottiSet.add('Zanzariera');
        if (hasQta(pos.cassonetto)) prodottiSet.add('Cassonetto');
    });

    // Popola select piano
    const filterPiano = document.getElementById('filterPiano');
    filterPiano.innerHTML = '<option value="">Tutti i piani</option>';
    Array.from(pianiSet).sort().forEach(piano => {
        filterPiano.innerHTML += `<option value="${piano}">${piano}</option>`;
    });

    // Popola select stanza
    const filterStanza = document.getElementById('filterStanza');
    filterStanza.innerHTML = '<option value="">Tutte le stanze</option>';
    Array.from(stanzeSet).sort().forEach(stanza => {
        filterStanza.innerHTML += `<option value="${stanza}">${stanza}</option>`;
    });

    // Popola select prodotto
    const filterProdotto = document.getElementById('filterProdotto');
    filterProdotto.innerHTML = '<option value="">Tutti i prodotti</option>';
    Array.from(prodottiSet).sort().forEach(prodotto => {
        filterProdotto.innerHTML += `<option value="${prodotto}">${prodotto}</option>`;
    });

    console.log('✅ Filters populated');
}

// ============================================================================
// GENERA TABELLA
// ============================================================================
let currentSortColumn = null;
let currentSortDirection = 'asc';

function generateTable(data, filteredPositions = null) {
    console.log('📋 Generating table...');

    const posizioni = filteredPositions || data.posizioni || [];

    if (posizioni.length === 0) {
        document.getElementById('tableContainer').innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔍</div>
                <div>Nessuna posizione trovata con i filtri selezionati</div>
            </div>
        `;
        return;
    }

    let tableHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th class="sortable" onclick="sortTable('id')">ID</th>
                    <th class="sortable" onclick="sortTable('piano')">Piano</th>
                    <th class="sortable" onclick="sortTable('stanza')">Stanza</th>
                    <th>Ambiente</th>
                    <th>Prodotti</th>
                    <th class="sortable" onclick="sortTable('dimensioni')">Dimensioni</th>
                    <th class="sortable" onclick="sortTable('quantita')">Qta</th>
                </tr>
            </thead>
            <tbody>
    `;

    posizioni.forEach(pos => {
        // 🆕 v8.55: Badge DINAMICI da PRODOTTI_CONFIG
        const prodotti = [];
        PRODOTTI_CONFIG.forEach(cfg => {
            if (prodottoPresente(pos, cfg)) {
                const n = getQtaProdotto(pos, cfg);
                prodotti.push(`<span class="product-badge ${cfg.totaleKey}" style="background: ${cfg.bg}; color: ${cfg.color}; border: 1px solid ${cfg.border};">${cfg.icon} ${cfg.label} x${n}</span>`);
            }
        });

        // Dimensioni
        const lvt = pos.misure?.LVT || '-';
        const hvt = pos.misure?.HVT || '-';
        const dimensioni = `${lvt} × ${hvt}`;

        tableHTML += `
            <tr>
                <td><strong>${pos.id || '-'}</strong></td>
                <td>${pos.piano || '-'}</td>
                <td>${pos.stanza || '-'}</td>
                <td>${pos.ambiente || pos.nome || '-'}</td>
                <td>${prodotti.join(' ')}</td>
                <td>${dimensioni}</td>
                <td>${PRODOTTI_CONFIG.reduce((s, c) => s + (prodottoPresente(pos, c) ? getQtaProdotto(pos, c) : 0), 0) || 1}</td>
            </tr>
        `;
    });

    tableHTML += `
            </tbody>
        </table>
    `;

    document.getElementById('tableContainer').innerHTML = tableHTML;
    console.log(`✅ Table generated with ${posizioni.length} rows`);
}

// ============================================================================
// ORDINAMENTO TABELLA
// ============================================================================
function sortTable(column) {
    if (!appState.rilievoData) return;

    console.log(`🔄 Sorting by: ${column}`);

    // Toggle direction se stessa colonna
    if (currentSortColumn === column) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortColumn = column;
        currentSortDirection = 'asc';
    }

    // Copia array per non modificare originale
    const sortedPositions = [...(appState.rilievoData.posizioni || [])];

    // Sort
    sortedPositions.sort((a, b) => {
        let valA, valB;

        switch (column) {
            case 'id':
                valA = a.id || '';
                valB = b.id || '';
                break;
            case 'piano':
                valA = a.piano || '';
                valB = b.piano || '';
                break;
            case 'stanza':
                valA = a.stanza || '';
                valB = b.stanza || '';
                break;
            case 'dimensioni':
                valA = (a.misure?.LVT || 0) * (a.misure?.HVT || 0);
                valB = (b.misure?.LVT || 0) * (b.misure?.HVT || 0);
                break;
            case 'quantita':
                valA = a.quantita || 1;
                valB = b.quantita || 1;
                break;
            default:
                return 0;
        }

        if (typeof valA === 'string') {
            return currentSortDirection === 'asc' 
                ? valA.localeCompare(valB)
                : valB.localeCompare(valA);
        } else {
            return currentSortDirection === 'asc'
                ? valA - valB
                : valB - valA;
        }
    });

    // Rigenera tabella con posizioni ordinate
    generateTable(appState.rilievoData, sortedPositions);

    // Aggiorna UI header
    document.querySelectorAll('.data-table th').forEach(th => {
        th.classList.remove('sorted-asc', 'sorted-desc');
    });
    const sortedTh = document.querySelector(`.data-table th[onclick="sortTable('${column}')"]`);
    if (sortedTh) {
        sortedTh.classList.add(`sorted-${currentSortDirection}`);
    }
}

// ============================================================================
// APPLICA FILTRI
// ============================================================================
function applyFilters() {
    if (!appState.rilievoData) return;

    console.log('🔍 Applying filters...');

    const filterPiano = document.getElementById('filterPiano').value;
    const filterStanza = document.getElementById('filterStanza').value;
    const filterProdotto = document.getElementById('filterProdotto').value;
    const searchText = document.getElementById('searchInput').value.toLowerCase();

    let filteredPositions = appState.rilievoData.posizioni || [];

    // Filtro piano
    if (filterPiano) {
        filteredPositions = filteredPositions.filter(pos => pos.piano === filterPiano);
    }

    // Filtro stanza
    if (filterStanza) {
        filteredPositions = filteredPositions.filter(pos => pos.stanza === filterStanza);
    }

    // Filtro prodotto
    if (filterProdotto) {
        filteredPositions = filteredPositions.filter(pos => {
            const hasProdotto = 
                (filterProdotto === 'Infisso' && hasQta(pos.infisso)) ||
                (filterProdotto === 'Tapparella' && hasQta(pos.tapparella)) ||
                (filterProdotto === 'Persiana' && hasQta(pos.persiana)) ||
                (filterProdotto === 'Zanzariera' && hasQta(pos.zanzariera)) ||
                (filterProdotto === 'Cassonetto' && hasQta(pos.cassonetto));
            return hasProdotto;
        });
    }

    // Ricerca testuale
    if (searchText) {
        filteredPositions = filteredPositions.filter(pos => {
            const searchableText = [
                pos.id,
                pos.nome,
                pos.piano,
                pos.stanza,
                pos.ambiente
            ].join(' ').toLowerCase();
            
            return searchableText.includes(searchText);
        });
    }

    console.log(`✅ Filtered: ${filteredPositions.length}/${appState.rilievoData.posizioni.length} posizioni`);
    generateTable(appState.rilievoData, filteredPositions);
}

// ============================================================================
// RESET FILTRI
// ============================================================================
function resetFilters() {
    document.getElementById('filterPiano').value = '';
    document.getElementById('filterStanza').value = '';
    document.getElementById('filterProdotto').value = '';
    document.getElementById('searchInput').value = '';
    
    if (appState.rilievoData) {
        generateTable(appState.rilievoData);
    }
    
    showAlert('info', '🔄 Filtri resettati');
}
function saveToLocalStorage(data, filename) {
    try {
        const storageData = {
            rilievo: data,
            metadata: {
                filename: filename,
                importDate: new Date().toISOString(),
                version: '6.1'
            }
        };

        localStorage.setItem('dashboard_rilievo_current', JSON.stringify(storageData));
        console.log('💾 Data saved to localStorage');
    } catch (error) {
        console.error('❌ localStorage save error:', error);
        showAlert('warning', '⚠️ Impossibile salvare in localStorage');
    }
}

function loadFromLocalStorage() {
    try {
        const stored = localStorage.getItem('dashboard_rilievo_current');
        if (stored) {
            const storageData = JSON.parse(stored);
            console.log('📂 Found data in localStorage');
            
            // Ripristina stato
            appState.rilievoData = storageData.rilievo;
            appState.lastImport = {
                filename: storageData.metadata.filename,
                timestamp: storageData.metadata.importDate,
                posizioni: storageData.rilievo.posizioni.length
            };

            // Mostra dati
            showDataStatus(storageData.rilievo);
            document.getElementById('generalePlaceholder').style.display = 'none';
            document.getElementById('generaleContent').style.display = 'block';

            // Rigenera dashboard
            generateKPIDashboard(storageData.rilievo);
            populateFilters(storageData.rilievo);
            generateTable(storageData.rilievo);

            showAlert('info', '📂 Rilievo precedente ripristinato da memoria');
        }
    } catch (error) {
        console.error('❌ localStorage load error:', error);
    }
}

// ============================================================================
// EXPORT CSV/EXCEL
// ============================================================================
function exportToCSV() {
    exportToExcel(); // Redirect to Excel export
}

/**
 * 📊 EXPORT EXCEL COMPLETO
 * Genera file Excel con fogli multipli: Generale, Posizioni, Infissi, Persiane, Tapparelle, Zanzariere, Cassonetti
 */
function exportToExcel() {
    if (!appState.rilievoData) {
        showAlert('warning', '⚠️ Nessun dato da esportare');
        return;
    }

    console.log('📊 Exporting to Excel with SheetJS...');

    const posizioni = appState.rilievoData.posizioni || [];
    const project = appState.rilievoData.project || {};
    
    // Crea workbook
    const wb = XLSX.utils.book_new();
    
    // ========== FOGLIO 1: GENERALE ==========
    const wsGenerale = XLSX.utils.aoa_to_sheet([
        ['PROGETTO', project.id || 'N/D'],
        ['Cliente', project.cliente?.nome || 'N/D'],
        ['Indirizzo', project.cliente?.indirizzo || 'N/D'],
        ['Telefono', project.cliente?.telefono || 'N/D'],
        ['Data Rilievo', project.dataRilievo || 'N/D'],
        [''],
        ['TOTALI PROGETTO'],
        ['Totale Posizioni', posizioni.length],
        ['Totale Infissi', posizioni.filter(p => hasQta(p.infisso)).reduce((sum, p) => sum + (getQta(p.infisso) || 0), 0)],
        ['Totale Persiane', posizioni.filter(p => hasQta(p.persiana)).reduce((sum, p) => sum + (getQta(p.persiana) || 0), 0)],
        ['Totale Tapparelle', posizioni.filter(p => hasQta(p.tapparella)).reduce((sum, p) => sum + (getQta(p.tapparella) || 0), 0)],
        ['Totale Zanzariere', posizioni.filter(p => hasQta(p.zanzariera)).reduce((sum, p) => sum + (getQta(p.zanzariera) || 0), 0)],
        ['Totale Cassonetti', posizioni.filter(p => hasQta(p.cassonetto)).reduce((sum, p) => sum + (getQta(p.cassonetto) || 0), 0)]
    ]);
    XLSX.utils.book_append_sheet(wb, wsGenerale, "Generale");
    
    // ========== FOGLIO 2: POSIZIONI ==========
    const posizioniData = [
        ['ID', 'Piano', 'Stanza', 'Ambiente', 'Quantità', 'L (mm)', 'H (mm)', 'Infisso', 'Persiana', 'Tapparella', 'Zanzariera', 'Cassonetto']
    ];
    posizioni.forEach(pos => {
        posizioniData.push([
            pos.id || '',
            pos.piano || '',
            pos.stanza || '',
            pos.ambiente || pos.nome || '',
            PRODOTTI_CONFIG.reduce((s, c) => s + (prodottoPresente(pos, c) ? getQtaProdotto(pos, c) : 0), 0) || 1,
            pos.L || '',
            pos.H || '',
            (hasQta(pos.infisso)) ? 'SI' : 'NO',
            (hasQta(pos.persiana)) ? 'SI' : 'NO',
            (hasQta(pos.tapparella)) ? 'SI' : 'NO',
            (hasQta(pos.zanzariera)) ? 'SI' : 'NO',
            (hasQta(pos.cassonetto)) ? 'SI' : 'NO'
        ]);
    });
    const wsPosizioni = XLSX.utils.aoa_to_sheet(posizioniData);
    XLSX.utils.book_append_sheet(wb, wsPosizioni, "Posizioni");
    
    // ========== FOGLIO 3: INFISSI ==========
    const infissiData = [
        ['Posizione', 'Ambiente', 'Qtà', 'L×H (mm)', 'Azienda', 'Telaio', 'Materiale', 'Tipo Anta', 'Vetro', 'Colore Int', 'Colore Est']
    ];
    posizioni.forEach(pos => {
        if (hasQta(pos.infisso)) {
            const inf = pos.infisso;
            infissiData.push([
                pos.id || '',
                pos.ambiente || pos.nome || '',
                inf.quantita || 1,
                `${pos.L || inf.brm?.L || 'N/D'}×${pos.H || inf.brm?.H || 'N/D'}`,
                inf.azienda || 'N/D',
                inf.telaio || 'N/D',
                inf.materiale_telaio || 'N/D',
                inf.tipo_anta || 'N/D',
                inf.vetro || 'N/D',
                inf.colore_int || 'N/D',
                inf.colore_est || 'N/D'
            ]);
        }
    });
    const wsInfissi = XLSX.utils.aoa_to_sheet(infissiData);
    XLSX.utils.book_append_sheet(wb, wsInfissi, "Infissi");
    
    // ========== FOGLIO 4: PERSIANE ==========
    const persianeData = [
        ['Posizione', 'Ambiente', 'Qtà', 'L×H (mm)', 'Azienda', 'Modello', 'Tipologia', 'Colore', 'Note']
    ];
    posizioni.forEach(pos => {
        if (hasQta(pos.persiana)) {
            const pers = pos.persiana;
            persianeData.push([
                pos.id || '',
                pos.ambiente || pos.nome || '',
                pers.quantita || 1,
                `${pers.brm?.L || pos.L || 'N/D'}×${pers.brm?.H || pos.H || 'N/D'}`,
                pers.azienda || 'N/D',
                pers.modello || 'N/D',
                pers.tipologia || 'N/D',
                pers.colore || 'N/D',
                pers.note || ''
            ]);
        }
    });
    const wsPersiane = XLSX.utils.aoa_to_sheet(persianeData);
    XLSX.utils.book_append_sheet(wb, wsPersiane, "Persiane");
    
    // ========== FOGLIO 5: TAPPARELLE ==========
    const tapparelleData = [
        ['Posizione', 'Ambiente', 'Qtà', 'L×H Foro (mm)', 'Azienda', 'Tipo', 'Colore', 'Automazione', 'Prezzo Unit.', 'Prezzo Tot.']
    ];
    posizioni.forEach(pos => {
        if (hasQta(pos.tapparella)) {
            const tapp = pos.tapparella;
            // Calcola prezzo se Plasticino
            let prezzoUnit = 'N/D';
            let prezzoTot = 'N/D';
            const aziendaLower = (tapp.azienda || '').toLowerCase();
            if (aziendaLower.includes('plasticino') || aziendaLower.includes('solar') || aziendaLower.includes('estella')) {
                const brmExcel = getProductBRM(tapp, pos);
                const L_cm = brmExcel.L || 0;
                const H_cm = brmExcel.H || 0;
                if (L_cm > 0 && H_cm > 0 && typeof calcolaPrezzoPLASTICINO !== 'undefined') {
                    const calc = calcolaPrezzoPLASTICINO(L_cm, H_cm);
                    prezzoUnit = '€' + calc.totale.toFixed(2);
                    prezzoTot = '€' + (calc.totale * (tapp.quantita || 1)).toFixed(2);
                }
            }
            tapparelleData.push([
                pos.id || '',
                pos.ambiente || pos.nome || '',
                tapp.quantita || 1,
                `${tapp.brm?.L || tapp.larghezza || pos.L || 'N/D'}×${tapp.brm?.H || tapp.altezza || pos.H || 'N/D'}`,
                tapp.azienda || 'N/D',
                tapp.tipo || 'N/D',
                tapp.colore || 'N/D',
                tapp.automazione || 'Manuale',
                prezzoUnit,
                prezzoTot
            ]);
        }
    });
    const wsTapparelle = XLSX.utils.aoa_to_sheet(tapparelleData);
    XLSX.utils.book_append_sheet(wb, wsTapparelle, "Tapparelle");
    
    // ========== FOGLIO 6: ZANZARIERE ==========
    const zanzariereData = [
        ['Posizione', 'Ambiente', 'Qtà', 'L×H (mm)', 'Azienda', 'Modello', 'Colore', 'Note']
    ];
    posizioni.forEach(pos => {
        if (hasQta(pos.zanzariera)) {
            const zanz = pos.zanzariera;
            zanzariereData.push([
                pos.id || '',
                pos.ambiente || pos.nome || '',
                zanz.quantita || 1,
                `${zanz.brm?.L || pos.L || 'N/D'}×${zanz.brm?.H || pos.H || 'N/D'}`,
                zanz.azienda || 'N/D',
                zanz.modello || 'N/D',
                zanz.colore || 'N/D',
                zanz.note || ''
            ]);
        }
    });
    const wsZanzariere = XLSX.utils.aoa_to_sheet(zanzariereData);
    XLSX.utils.book_append_sheet(wb, wsZanzariere, "Zanzariere");
    
    // ========== FOGLIO 7: CASSONETTI ==========
    const cassonettiData = [
        ['Posizione', 'Ambiente', 'Qtà', 'L×H (mm)', 'Azienda', 'Tipo', 'Note']
    ];
    posizioni.forEach(pos => {
        if (hasQta(pos.cassonetto)) {
            const cass = pos.cassonetto;
            cassonettiData.push([
                pos.id || '',
                pos.ambiente || pos.nome || '',
                cass.quantita || 1,
                `${cass.brm?.L || pos.L || 'N/D'}×${cass.brm?.H || pos.H || 'N/D'}`,
                cass.azienda || 'N/D',
                cass.tipo || 'N/D',
                cass.note || ''
            ]);
        }
    });
    const wsCassonetti = XLSX.utils.aoa_to_sheet(cassonettiData);
    XLSX.utils.book_append_sheet(wb, wsCassonetti, "Cassonetti");
    
    // ========== GENERA FILE EXCEL ==========
    const filename = `rilievo-${project.id || Date.now()}.xlsx`;
    XLSX.writeFile(wb, filename);
    
    showAlert('success', '✅ Excel esportato con successo');
    console.log('✅ Excel exported:', filename);
}

// ============================================================================
// EXPORT JSON
// ============================================================================
function exportToJSON() {
    if (!appState.rilievoData) {
        showAlert('warning', '⚠️ Nessun dato da esportare');
        return;
    }

    console.log('💾 Exporting to JSON...');

    // 🆕 v8.509: Usa JSON_MANAGER se disponibile
    if (typeof JSON_MANAGER !== 'undefined') {
        try {
            const result = JSON_MANAGER.downloadJSON(appState.rilievoData, {
                source: 'dashboard',
                filename: appState.lastImport?.filename 
                    ? `backup-${appState.lastImport.filename}` 
                    : `rilievo-${Date.now()}.json`
            });
            showAlert('success', `✅ JSON esportato: ${result.filename}`);
            console.log('✅ JSON exported via JSON_MANAGER');
            return;
        } catch (error) {
            console.warn('⚠️ JSON_MANAGER export failed, using legacy:', error);
        }
    }
    
    // Fallback legacy
    const dataStr = JSON.stringify(appState.rilievoData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    const filename = appState.lastImport?.filename || `rilievo-${Date.now()}.json`;
    link.download = `backup-${filename}`;
    link.click();
    
    URL.revokeObjectURL(url);
    showAlert('success', '✅ JSON esportato con successo');
    console.log('✅ JSON exported (legacy)');
}

// ============================================================================
// UI: MOSTRA STATO DATI
// ============================================================================
function showDataStatus(data) {
    const statusDiv = document.getElementById('dataStatus');
    
    // Estrai informazioni in modo sicuro da formati diversi
    const numPosizioni = data.posizioni?.length || 0;
    const nomeCliente = data.cliente?.nome || 
                       data.rilievo?.cliente?.nome || 
                       data.customerName || 
                       'N/D';
    const nomeProgetto = data.cliente?.progetto || 
                        data.rilievo?.meta?.id_rilievo || 
                        data.projectName || 
                        'Progetto';
    const dataRilievo = data.data_rilievo || 
                       data.rilievo?.meta?.data_creazione || 
                       data.metadata?.created || 
                       Date.now();
    
    const html = `
        <div class="status-badge success">
            ✅ ${numPosizioni} Posizioni
        </div>
        <div class="status-badge info">
            👤 ${nomeCliente}
        </div>
        <div class="status-badge info">
            📋 ${nomeProgetto}
        </div>
        <div class="status-badge info">
            📅 ${new Date(dataRilievo).toLocaleDateString('it-IT')}
        </div>
    `;

    statusDiv.innerHTML = html;
    statusDiv.style.display = 'flex';
}

// ============================================================================
// UI: ALERT/NOTIFICHE
// ============================================================================
function showAlert(type, message) {
    // Rimuovi alert precedenti
    const existingAlerts = document.querySelectorAll('.alert');
    existingAlerts.forEach(alert => alert.remove());

    // Crea nuovo alert
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;

    // Inserisci dopo header
    const container = document.querySelector('.container');
    container.insertBefore(alert, container.firstChild);

    // Rimuovi dopo 5 secondi
    setTimeout(() => {
        alert.style.opacity = '0';
        setTimeout(() => alert.remove(), 300);
    }, 5000);
}

// ============================================================================
// ============================================================================
// INIZIALIZZAZIONE
// ============================================================================
document.addEventListener('DOMContentLoaded', function() {
    console.log(`🚀 Dashboard Rilievi v${DASHBOARD_VERSION} (${DASHBOARD_DATE})`);
    console.log('📊 Initializing...');

    // 🔧 v8.66: Sostituisci "GitHub Projects" con bottone "Lista Progetti" nella sidebar
    setTimeout(() => {
        const ghSection = document.querySelector('.sidebar-expandable');
        if (ghSection) {
            const parent = ghSection.parentElement;
            // Nascondi sezione GitHub Projects + lista sotto
            ghSection.style.display = 'none';
            const ghList = document.getElementById('githubProjectsList');
            if (ghList) ghList.style.display = 'none';
            
            // Crea bottone Lista Progetti
            const btn = document.createElement('div');
            btn.innerHTML = `
                <div onclick="switchBlocco('progetti');closeSidebar();" 
                     style="background:linear-gradient(135deg,#6366f1,#3b82f6);color:white;
                            padding:12px 16px;margin:8px 12px;border-radius:10px;cursor:pointer;
                            font-weight:700;font-size:15px;text-align:center;
                            display:flex;align-items:center;justify-content:center;gap:8px;
                            box-shadow:0 2px 8px rgba(99,102,241,0.3);transition:transform 0.15s;">
                    📋 LISTA PROGETTI
                </div>
            `;
            parent.insertBefore(btn, ghSection);
            console.log('✅ v8.66: Bottone Lista Progetti iniettato nella sidebar');
        }
    }, 100);

    // Carica dati se presenti in localStorage
    loadFromLocalStorage();
    
    // v8.63: Ripristina blocco e vista dopo F5
    try {
        const savedBlocco = sessionStorage.getItem('dash_blocco');
        const savedVista = sessionStorage.getItem('dash_vista');
        if (savedBlocco && savedBlocco !== 'generale') {
            switchBlocco(savedBlocco);
            console.log(`🔄 F5: Ripristinato blocco "${savedBlocco}"`);
        }
        if (savedVista && appState.rilievoData) {
            // Delay per dare tempo al DOM di renderizzare
            setTimeout(() => {
                switchVistaUfficio(savedVista);
                console.log(`🔄 F5: Ripristinata vista "${savedVista}"`);
            }, 300);
        }
    } catch(e) { console.warn('F5 restore:', e); }
    
    // v8.492: Event listener per salvataggio automatico configPreventivo
    initConfigPreventivoListeners();

    console.log('✅ App ready');
});

/**
 * 💾 v8.492: Inizializza event listener per salvataggio automatico configPreventivo
 */
function initConfigPreventivoListeners() {
    // Campi cliente - salva su input/change
    const campiCliente = ['clienteNome', 'clienteIndirizzo', 'clienteTelefono', 'clienteEmail', 'clienteCF'];
    campiCliente.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', salvaConfigPreventivo);
        }
    });
    
    // Campi che già chiamano ricalcolaTotaliPreventivo (che ora chiama salvaConfigPreventivo)
    // Non servono listener aggiuntivi per questi
    
    console.log('✅ v8.492: Event listener configPreventivo inizializzati');
}

// ============================================================================
// RESET DATI
// ============================================================================
function resetData() {
    if (confirm('⚠️ Cancellare tutti i dati caricati?')) {
        localStorage.removeItem('dashboard_rilievo_current');
        appState.rilievoData = null;
        appState.lastImport = null;
        
        document.getElementById('dataStatus').style.display = 'none';
        document.getElementById('generalePlaceholder').style.display = 'block';
        document.getElementById('generaleContent').style.display = 'none';
        
        // ✅ v7.20: Uso classList invece di style.display per ufficio
        document.getElementById('ufficioPlaceholder').classList.remove('content-hidden');
        document.getElementById('ufficioContent').classList.add('content-hidden');
        
        // Reset filtri
        document.getElementById('filterPiano').value = '';
        document.getElementById('filterStanza').value = '';
        document.getElementById('filterProdotto').value = '';
        document.getElementById('searchInput').value = '';
        
        showAlert('info', '🔄 Dati cancellati');
        console.log('🔄 Data reset');
    }
}

// ============================================================================
// BLOCCO UFFICIO - NAVIGAZIONE VISTE
// ============================================================================
function switchVistaUfficio(vistaName, evt) {
    console.log(`🔄 Switching to vista: ${vistaName}`);
    // v8.63: Persisti per F5
    try { sessionStorage.setItem('dash_vista', vistaName); } catch(e) {}
    
    // 🆕 v7.82 FIX: Usa window.currentData e window.projectData per sicurezza
    const currentData = window.currentData;
    const projectData = window.projectData;
    
    // 🔄 v8.04: Applica/rimuovi fullwidth per preventivo
    const mainContainer = document.querySelector('.blocco.active');
    if (mainContainer) {
        if (vistaName === 'preventivo') {
            mainContainer.classList.add('preventivo-fullwidth');
            document.body.style.overflow = 'auto'; // Permetti scroll
        } else {
            mainContainer.classList.remove('preventivo-fullwidth');
        }
    }
    
    // ✅ v7.20 FIX: RESET tutte le viste prima di cambiare
    // Ripristina stato iniziale (placeholder visibile, content nascosto)
    const allContentIds = ['ufficioContent', 'posizioniContent', 'aziendeContent', 'preventivoContent'];
    const allPlaceholderIds = ['ufficioPlaceholder', 'posizioniPlaceholder', 'aziendePlaceholder', 'preventivoPlaceholder'];
    
    allContentIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('content-hidden');
    });
    
    allPlaceholderIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('content-hidden');
    });
    
    // ✅ v7.21: Pulisci container totali quando non in Vista Generale
    if (vistaName !== 'generale') {
        const totaliContainer = document.getElementById('totaliCommessaContainer');
        if (totaliContainer) {
            totaliContainer.innerHTML = '';
            console.log('🧹 Totali Commessa rimossi (non in Vista Generale)');
        }
    }
    
    // Nascondi tutte le viste
    document.querySelectorAll('.vista-ufficio').forEach(v => v.classList.remove('active'));
    // Mostra vista selezionata
    document.getElementById(`vista-${vistaName}-ufficio`).classList.add('active');
    
    // Aggiorna pulsanti submenu
    document.querySelectorAll('.submenu-btn').forEach(btn => btn.classList.remove('active'));
    
    // Trova e attiva il pulsante corretto
    if (evt && evt.target) {
        evt.target.closest('.submenu-btn').classList.add('active');
    } else {
        // Fallback: cerca pulsante per nome vista
        document.querySelectorAll('.submenu-btn').forEach(btn => {
            if (btn.onclick && btn.onclick.toString().includes(`'${vistaName}'`)) {
                btn.classList.add('active');
            }
        });
    }
    
    // 🔧 v8.67: Vista Posizioni funziona anche con 0 posizioni (progetto nuovo)
    if (vistaName === 'posizioni' && currentData) {
        if (!currentData.posizioni) currentData.posizioni = [];
        if (!currentData.positions) currentData.positions = [];
        console.log(`📋 Rendering Vista Posizioni con ${currentData.posizioni.length} posizioni...`);
        renderVistaPosizioniUfficio(currentData);
    } else if (vistaName === 'posizioni') {
        console.warn('⚠️ Vista Posizioni richiesta ma nessun dato disponibile');
    }
    
    // Se vista aziende, renderizza se ci sono dati
    if (vistaName === 'aziende' && currentData && currentData.posizioni) {
        console.log(`🏢 Rendering Vista Aziende con ${currentData.posizioni.length} posizioni...`);
        renderVistaAziende(currentData);
    } else if (vistaName === 'aziende') {
        console.warn('⚠️ Vista Aziende richiesta ma nessun dato disponibile');
    }
    
    // ✅ v7.22: Se vista preventivo, renderizza se ci sono dati
    if (vistaName === 'preventivo' && currentData && currentData.posizioni) {
        console.log(`💰 Rendering Vista Preventivo con ${currentData.posizioni.length} posizioni...`);
        renderVistaPreventivo(currentData);
    } else if (vistaName === 'preventivo') {
        console.warn('⚠️ Vista Preventivo richiesta ma nessun dato disponibile');
    }
    
    // ✅ v7.73: FIX - Se vista generale, ri-renderizza contenuto
    if (vistaName === 'generale' && currentData && currentData.posizioni) {
        console.log(`📊 Rendering Vista Generale con ${currentData.posizioni.length} posizioni...`);
        renderVistaGeneraleUfficio(currentData);
    } else if (vistaName === 'generale' && projectData && projectData.posizioni) {
        // Fallback a projectData se currentData non disponibile
        console.log(`📊 Rendering Vista Generale da projectData con ${projectData.posizioni.length} posizioni...`);
        renderVistaGeneraleUfficio(projectData);
    } else if (vistaName === 'generale') {
        console.warn('⚠️ Vista Generale richiesta ma nessun dato disponibile');
    }
    
    console.log(`✅ Vista ${vistaName} attivata`);
}

// ============================================================================
// BLOCCO UFFICIO - RENDER VISTA GENERALE
// ============================================================================
function renderVistaGeneraleUfficio(data) {
    console.log('📊 Rendering Vista Generale Ufficio...');
    
    // Nascondi placeholder, mostra contenuto (usando classList invece di style.display)
    document.getElementById('ufficioPlaceholder').classList.add('content-hidden');
    document.getElementById('ufficioContent').classList.remove('content-hidden');
    
    // ✅ v7.21: CREA sezione totali dinamicamente
    createTotaliCommessaSection();
    
    // Popola tutte le sezioni
    renderInfoCliente(data);
    // renderCaratteristicheMuro(data); // ❌ ELIMINATO
    // ❌ RIMOSSO: renderConfigurazioneInfissi(data) - Spostato in Vista Aziende
    renderTotaliCommessa(data);
    renderRiepilogoEconomico(data); // ✅ NUOVO: Riepilogo economico con totale
    
    // ✅ v7.997: Inizializza Config Prodotti Globale in Ufficio
    initConfigMenuUfficio();
    
    // ✅ v8.57: Pannello Sconti Fornitori
    renderScontiPanel();
    
    console.log('✅ Vista Generale Ufficio rendered');
}

// ============================================================================
// SEZIONE A: INFO CLIENTE
// ============================================================================

/**
 * v8.60: Genera badge stato progetto interattivo
 * Usa STATI_CONFIG dal modulo condiviso se disponibile, altrimenti fallback
 */
function renderStatoProgettoBadge() {
    const currentStato = window._githubProjectRef?.rawData?.stato || 'preventivo';
    
    // Usa modulo condiviso per colori/label
    if (typeof ProjectListView !== 'undefined' && ProjectListView.STATI_MAP) {
        const sc = ProjectListView.STATI_MAP[currentStato] || ProjectListView.STATI_MAP[ProjectListView.STATI_DEFAULT];
        return `
            <button onclick="cycleDashboardProjectStato()" 
                    title="Click per cambiare stato"
                    style="padding:6px 16px;border:2px solid ${sc.color};background:${sc.bg};border-radius:8px;cursor:pointer;
                           font-size:14px;font-weight:700;color:${sc.color};transition:all 0.2s;display:inline-flex;align-items:center;gap:6px;"
                    onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                ${sc.icon} ${sc.labelSingolare}
            </button>`;
    }
    
    // Fallback senza modulo
    const fallback = {
        preventivo: { icon: '📋', label: 'Preventivo', color: '#6366f1', bg: '#eef2ff' },
        ordine:     { icon: '✅', label: 'Ordine',     color: '#059669', bg: '#ecfdf5' },
        annullato:  { icon: '❌', label: 'Annullato',  color: '#9ca3af', bg: '#f9fafb' }
    };
    const fb = fallback[currentStato] || fallback.preventivo;
    return `
        <button onclick="cycleDashboardProjectStato()" 
                title="Click per cambiare stato"
                style="padding:6px 16px;border:2px solid ${fb.color};background:${fb.bg};border-radius:8px;cursor:pointer;
                       font-size:14px;font-weight:700;color:${fb.color};transition:all 0.2s;display:inline-flex;align-items:center;gap:6px;">
            ${fb.icon} ${fb.label}
        </button>`;
}

/**
 * v8.60: Cicla stato del progetto correntemente caricato nella Dashboard
 * Aggiorna: rawData → githubProjects → salva su GitHub → aggiorna UI
 */
function cycleDashboardProjectStato() {
    const ref = window._githubProjectRef;
    if (!ref || !ref.rawData) {
        showAlert('warning', 'Nessun progetto caricato');
        return;
    }
    
    // Ciclo da modulo condiviso oppure fallback
    const cycle = (typeof ProjectListView !== 'undefined' && ProjectListView.STATI_CYCLE) 
        ? ProjectListView.STATI_CYCLE 
        : { preventivo: 'ordine', ordine: 'annullato', annullato: 'preventivo' };
    
    const oldStato = ref.rawData.stato || 'preventivo';
    const newStato = cycle[oldStato] || 'preventivo';
    
    // 1. Aggiorna rawData del progetto caricato
    ref.rawData.stato = newStato;
    
    // 2. Aggiorna anche in window.githubProjects (lista globale)
    if (window.githubProjects) {
        const gp = window.githubProjects.find(p => p.id === ref.id);
        if (gp) {
            if (gp.rawData) gp.rawData.stato = newStato;
            gp.stato = newStato; // 🔧 v8.61: aggiorna top-level per ProjectListView
        }
    }
    
    // 3. Salva su GitHub
    if (typeof saveProjectStatoToGitHub === 'function') {
        saveProjectStatoToGitHub(ref.id, newStato);
    }
    
    // 4. Aggiorna UI badge
    const container = document.getElementById('statoProgettoContainer');
    if (container) {
        container.innerHTML = renderStatoProgettoBadge();
    }
    
    // 🔧 v8.61: Re-render lista progetti per aggiornare tab conteggi
    renderProjectsList(window.githubProjects || []);
    
    // 5. Notifica
    const sc = (typeof ProjectListView !== 'undefined' && ProjectListView.STATI_MAP) 
        ? ProjectListView.STATI_MAP[newStato] : null;
    const label = sc ? `${sc.icon} ${sc.labelSingolare}` : newStato;
    showAlert('success', `Stato → ${label}`);
}

function renderInfoCliente(data) {
    const cliente = data.cliente || {};
    const clientData = data.clientData || {};
    
    // ✅ FALLBACK INTELLIGENTE per compatibilità con formato app v4.17
    // Nome Cliente: usa client (root) se clientData.nome vuoto
    const nomeCliente = clientData.nome || cliente.nome || data.client || 'N/D';
    
    // Nome Progetto: usa name (root) come fallback principale
    const nomeProgetto = clientData.progetto || cliente.progetto || data.name || data.nome_ricerca || 'N/D';
    
    // Piano: usa clientData.piano o cliente.piano
    const piano = clientData.piano || cliente.piano || 'N/D';
    
    // Indirizzo: costruisce intelligentemente da indirizzo + città
    let indirizzo = 'N/D';
    const via = clientData.indirizzo || cliente.indirizzo || cliente.via || '';
    const citta = clientData.citta || cliente.citta || '';
    
    if (via && citta) {
        indirizzo = `${via}, ${citta}`;
    } else if (via) {
        indirizzo = via;
    } else if (citta) {
        indirizzo = citta;
    }
    
    // Telefono e Email
    const telefono = clientData.telefono || cliente.telefono || 'N/D';
    const email = clientData.email || cliente.email || 'N/D';
    
    const html = `
        <div class="info-item">
            <div class="info-label">Nome Cliente</div>
            <div class="info-value-large">${nomeCliente}</div>
        </div>
        <div class="info-item">
            <div class="info-label">Nome Progetto</div>
            <div class="info-value">${nomeProgetto}</div>
        </div>
        <div class="info-item">
            <div class="info-label">Stato Progetto</div>
            <div class="info-value" id="statoProgettoContainer">${renderStatoProgettoBadge()}</div>
        </div>
        <div class="info-item">
            <div class="info-label">Piano</div>
            <div class="info-value">${piano}</div>
        </div>
        <div class="info-item">
            <div class="info-label">Indirizzo</div>
            <div class="info-value">${indirizzo}</div>
        </div>
        <div class="info-item">
            <div class="info-label">Telefono</div>
            <div class="info-value">${telefono}</div>
        </div>
        <div class="info-item">
            <div class="info-label">Email</div>
            <div class="info-value">${email}</div>
        </div>
    `;
    
    document.getElementById('infoCliente').innerHTML = html;
    
    // Note progetto (se presenti)
    if (data.note_progetto || data.notes) {
        const noteHtml = `
            <div class="note-box">
                <div class="note-box-title">📝 Note Progetto</div>
                <div class="note-box-content">${data.note_progetto || data.notes}</div>
            </div>
        `;
        document.getElementById('noteProgetto').innerHTML = noteHtml;
    } else {
        document.getElementById('noteProgetto').innerHTML = '';
    }
}

// ============================================================================
// SEZIONE B: CARATTERISTICHE MURO GLOBALI
// ============================================================================

// ============================================================================
// SEZIONE CONFIG INFISSI - CONFIGURAZIONE GLOBALE PRODOTTI
// ============================================================================
function renderConfigurazioneInfissi(data) {
    const config = data.configInfissi || {};
    
    // Verifica se ci sono dati
    const hasConfig = Object.keys(config).length > 0;
    
    if (!hasConfig) {
        document.getElementById('configInfissiContent').innerHTML = `
            <p style="color: #6b7280; font-style: italic; text-align: center; padding: 2rem;">
                Nessuna configurazione infissi presente
            </p>
        `;
        return;
    }
    
    const configItems = [
        { label: 'Azienda', value: config.azienda, icon: '🏢' },
        { label: 'Tipo Anta', value: config.tipoAnta, icon: '🚪' },
        { label: 'Telaio', value: config.telaio, icon: '⬜' },
        { label: 'Finitura Interna', value: config.finituraInt, icon: '🎨' },
        { label: 'Finitura Esterna', value: config.finituraEst, icon: '🎨' },
        { label: 'Colore Interno', value: config.coloreInt, icon: '🌈' },
        { label: 'Colore Esterno', value: config.coloreEst, icon: '🌈' },
        { label: 'Allarme', value: config.allarme, icon: '🔔' },
        { label: 'Vetro', value: config.vetro, icon: '💎' },
        { label: 'Maniglia', value: config.maniglia, icon: '🔧' },
        { label: 'Colore Maniglia', value: config.coloreManiglia, icon: '🎨' }
    ].filter(item => item.value); // Mostra solo campi compilati
    
    const html = `
        <div class="wall-chars-grid">
            ${configItems.map(item => `
                <div class="wall-char-item">
                    <div class="wall-char-label">${item.icon} ${item.label}</div>
                    <div class="wall-char-value">${item.value}</div>
                </div>
            `).join('')}
        </div>
        ${configItems.length === 0 ? `
            <p style="color: #6b7280; font-style: italic; text-align: center; padding: 1rem;">
                Configurazione non completa
            </p>
        ` : ''}
    `;
    
    document.getElementById('configInfissiContent').innerHTML = html;
}

// ============================================================================
// CREAZIONE DINAMICA SEZIONE TOTALI COMMESSA - v7.21
// ============================================================================
function createTotaliCommessaSection() {
    const container = document.getElementById('totaliCommessaContainer');
    if (!container) return;
    
    // Crea HTML completo
    container.innerHTML = `
        <div class="card-ufficio">
            <h2 class="card-ufficio-title">
                <span class="card-ufficio-icon">📦</span>
                Totali Commessa
            </h2>
            
            <h3 style="font-size: 1rem; font-weight: 600; color: #6b7280; margin-bottom: 1rem;">
                Riepilogo Quantità
            </h3>
            <div id="totaliQuantita" class="totali-grid">
            </div>

            <h3 style="font-size: 1rem; font-weight: 600; color: #6b7280; margin-bottom: 1rem; margin-top: 2rem;">
                Riepilogo Economico
            </h3>
            <div id="riepilogoEconomico" class="economico-list">
            </div>
        </div>
    `;
    
    console.log('✅ Sezione Totali Commessa creata dinamicamente');
}

// ============================================================================
// SEZIONE C: TOTALI COMMESSA
// ============================================================================
function renderTotaliCommessa(data) {
    const stats = calculateTotaliCommessa(data);
    
    // 🆕 v8.55: DINAMICO da PRODOTTI_CONFIG
    let html = `
        <div class="totale-item">
            <div class="totale-numero">${stats.n_posizioni}</div>
            <div class="totale-label">Posizioni</div>
        </div>
    `;
    
    PRODOTTI_CONFIG.forEach(cfg => {
        const n = stats['n_' + cfg.totaleKey] || 0;
        if (n > 0) {
            html += `
        <div class="totale-item" style="background: linear-gradient(135deg, ${cfg.bg} 0%, ${cfg.border}40 100%); border-color: ${cfg.border};">
            <div class="totale-numero" style="color: ${cfg.color};">${n}</div>
            <div class="totale-label" style="color: ${cfg.color};">${cfg.label}</div>
        </div>
            `;
        }
    });
    
    document.getElementById('totaliQuantita').innerHTML = html;
}

// 🆕 v8.55: DINAMICO da PRODOTTI_CONFIG + countAllProducts
function calculateTotaliCommessa(data) {
    const posizioni = data.posizioni || data.positions || [];
    return countAllProducts(posizioni);
}

// ============================================================================
// NUOVO: RIEPILOGO ECONOMICO CON TOTALE
// ============================================================================
function renderRiepilogoEconomico(data) {
    console.log('💰 Calcolo riepilogo economico...');
    
    try {
        // 🆕 v8.55: Usa calcolaPreventivo standalone (gestisce TUTTI i prodotti)
        const preventivo = calcolaPreventivo(data);
        
        if (!preventivo || !preventivo.righe || preventivo.righe.length === 0) {
            console.warn('⚠️ Preventivo non calcolabile, mostro placeholder');
            document.getElementById('riepilogoEconomico').innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #6b7280; font-style: italic;">
                    Configura i prodotti per calcolare i costi
                </div>
            `;
            return;
        }
        
        // 🆕 v8.55: DINAMICO da PRODOTTI_CONFIG
        const totali = {};
        PRODOTTI_CONFIG.forEach(cfg => { totali[cfg.totaleKey] = 0; });
        
        preventivo.righe.forEach(riga => {
            const importo = parseFloat(riga.totale) || 0;
            const tipo = (riga.tipo || '').toLowerCase();
            const tipoNoSpaces = tipo.replace(/\s+/g, '');
            // Trova il prodotto corrispondente (match con/senza spazi)
            const cfg = PRODOTTI_CONFIG.find(c => tipo.includes(c.key.toLowerCase()) || tipoNoSpaces.includes(c.key.toLowerCase()) || tipo.includes(c.label.toLowerCase()));
            if (cfg) totali[cfg.totaleKey] += importo;
        });
        
        const totaleGenerale = Object.values(totali).reduce((sum, val) => sum + val, 0);
        
        let html = '';
        PRODOTTI_CONFIG.forEach(cfg => {
            if (totali[cfg.totaleKey] > 0) {
                html += `
                <div class="economico-item">
                    <span class="economico-label">${cfg.icon} ${cfg.label}</span>
                    <span class="economico-value">€ ${totali[cfg.totaleKey].toFixed(2)}</span>
                </div>
                `;
            }
        });
        
        // TOTALE FINALE
        html += `
            <div class="economico-item totale">
                <span class="economico-label">💰 TOTALE</span>
                <span class="economico-value">€ ${totaleGenerale.toFixed(2)}</span>
            </div>
        `;
        
        document.getElementById('riepilogoEconomico').innerHTML = html;
        console.log('✅ Riepilogo economico renderizzato:', totaleGenerale.toFixed(2));
        
    } catch (error) {
        console.error('❌ Errore calcolo riepilogo economico:', error);
        document.getElementById('riepilogoEconomico').innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #ef4444;">
                Errore nel calcolo dei costi
            </div>
        `;
    }
}

// ============================================================================
// 💰 v8.57: PANNELLO SCONTI FORNITORI - Vista e modifica sconti
// ============================================================================
function renderScontiPanel() {
    const container = document.getElementById('scontiFornitoriContainer');
    if (!container || typeof SCONTI_FORNITORI === 'undefined') return;
    
    container.style.display = 'block';
    const lista = SCONTI_FORNITORI.getAll();
    const nModifiche = lista.filter(i => !i.isDefault).length;
    
    let righeHtml = '';
    lista.forEach(item => {
        const modified = !item.isDefault ? ' style="background:#fef3c7;"' : '';
        const badge = !item.isDefault 
            ? `<span style="font-size:0.65rem;background:#f59e0b;color:#fff;padding:1px 5px;border-radius:4px;margin-left:4px;">mod</span>` 
            : '';
        const resetBtn = !item.isDefault 
            ? `<button onclick="scontiResetRiga('${item.nome}')" style="background:none;border:none;cursor:pointer;font-size:0.8rem;" title="Ripristina default ${item.hasDefault ? item.defaultValue + '%' : 'rimuovi'}">↩️</button>` 
            : '';
        
        righeHtml += `
            <tr${modified}>
                <td style="padding:6px 10px;font-weight:600;font-size:0.85rem;">${item.nome}${badge}</td>
                <td style="padding:6px 10px;text-align:center;">
                    <input type="number" step="0.01" min="0" max="99" value="${item.sconto}" 
                        onchange="scontiUpdateRiga('${item.nome}', this.value)"
                        style="width:70px;text-align:center;padding:4px;border:1px solid #d1d5db;border-radius:6px;font-size:0.85rem;font-weight:600;">%
                </td>
                <td style="padding:6px 10px;text-align:center;font-size:0.8rem;color:#6b7280;">
                    ${item.hasDefault ? item.defaultValue + '%' : '—'} ${resetBtn}
                </td>
            </tr>`;
    });
    
    const modNote = nModifiche > 0 
        ? `<div style="margin-top:0.5rem;padding:6px 10px;background:#fef3c7;border-radius:6px;font-size:0.8rem;color:#92400e;">
               ⚠️ ${nModifiche} scont${nModifiche === 1 ? 'o modificato' : 'i modificati'} — <strong>Salva su GitHub</strong> per rendere permanenti
           </div>` 
        : '';
    
    container.innerHTML = `
        <h2 class="card-ufficio-title">
            <span class="card-ufficio-icon">💰</span>
            Sconti Fornitori
        </h2>
        <p style="color:#6b7280;font-size:0.8rem;margin-bottom:0.75rem;">
            Sconti per questo progetto. Le modifiche vengono salvate nel progetto quando premi "Salva su GitHub".
        </p>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
            <thead>
                <tr style="background:#f1f5f9;">
                    <th style="padding:8px 10px;text-align:left;font-size:0.8rem;color:#374151;">Fornitore</th>
                    <th style="padding:8px 10px;text-align:center;font-size:0.8rem;color:#374151;">Sconto %</th>
                    <th style="padding:8px 10px;text-align:center;font-size:0.8rem;color:#374151;">Default</th>
                </tr>
            </thead>
            <tbody>${righeHtml}</tbody>
        </table>
        <div style="margin-top:0.75rem;display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;">
            <input type="text" id="scontiNuovoNome" placeholder="Nome fornitore" 
                style="padding:6px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:0.85rem;flex:1;min-width:120px;">
            <input type="number" id="scontiNuovoPerc" placeholder="%" step="0.01" min="0" max="99" value="0"
                style="width:70px;padding:6px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:0.85rem;text-align:center;">
            <button onclick="scontiAggiungiRiga()" 
                style="padding:6px 14px;background:#10b981;color:#fff;border:none;border-radius:6px;font-size:0.85rem;font-weight:600;cursor:pointer;">
                + Aggiungi
            </button>
            <button onclick="scontiResetTutti()" 
                style="padding:6px 14px;background:#ef4444;color:#fff;border:none;border-radius:6px;font-size:0.85rem;font-weight:600;cursor:pointer;margin-left:auto;">
                🔄 Reset tutti
            </button>
        </div>
        ${modNote}
    `;
}

function scontiUpdateRiga(nome, valore) {
    SCONTI_FORNITORI.setSconto(nome, parseFloat(valore) || 0);
    renderScontiPanel();
}

function scontiResetRiga(nome) {
    SCONTI_FORNITORI.removeSconto(nome);
    renderScontiPanel();
}

function scontiAggiungiRiga() {
    const nome = document.getElementById('scontiNuovoNome')?.value?.trim();
    const perc = parseFloat(document.getElementById('scontiNuovoPerc')?.value) || 0;
    if (!nome) { alert('Inserisci il nome del fornitore'); return; }
    SCONTI_FORNITORI.setSconto(nome, perc);
    renderScontiPanel();
}

function scontiResetTutti() {
    if (!confirm('Ripristinare tutti gli sconti ai valori di default?')) return;
    SCONTI_FORNITORI.resetAll();
    renderScontiPanel();
}

// ============================================================================
// MENU AVANZATO - GESTIONE SIDEBAR E BREADCRUMB
// ============================================================================

// Struttura menu completa
const menuStructure = {
    generale: {
        icon: '📊',
        label: 'Generale',
        color: '#667eea',
        items: [
            { id: 'dashboard', label: 'Dashboard', icon: '📊', status: 'completed' },
            { id: 'import', label: 'Import JSON', icon: '📥', status: 'completed' },
            { id: 'tabella', label: 'Tabella Completa', icon: '📋', status: 'completed' },
            { id: 'statistiche', label: 'Statistiche', icon: '📈', status: 'completed' },
            { id: 'export', label: 'Export', icon: '💾', status: 'completed' }
        ]
    },
    ufficio: {
        icon: '💼',
        label: 'Ufficio',
        color: '#10b981',
        items: [
            { id: 'generale', label: 'Vista Generale', icon: '📊', status: 'completed' },
            { id: 'posizioni', label: 'Vista Posizioni', icon: '📋', status: 'completed' },
            { id: 'aziende', label: 'Vista Aziende', icon: '🏢', status: 'completed' }
        ]
    },
    posa: {
        icon: '🔧',
        label: 'Posa',
        color: '#f59e0b',
        items: [
            { id: 'generale-cantiere', label: 'Vista Generale Cantiere', icon: '📦', status: 'completed' },
            { id: 'posizioni-cantiere', label: 'Vista Posizioni Cantiere', icon: '🔨', status: 'completed' }
        ]
    }
};

// Stato corrente menu
let currentMenuState = {
    blocco: 'generale',
    sottosezione: 'dashboard'
};

// Render menu sidebar completo
function renderAdvancedMenu() {
    const sidebar = document.getElementById('menuSidebar');
    if (!sidebar) return;

    let html = '';

    // v8.60: Bottone Progetti in cima al menu
    html += `
        <div class="sidebar-section">
            <div class="menu-item" style="background:linear-gradient(135deg,#6366f1,#3b82f6);color:white;border-radius:8px;margin:8px;cursor:pointer;font-weight:700;"
                 onclick="switchBlocco('progetti');closeSidebar();">
                <span class="menu-item-icon">📋</span>
                <span class="menu-item-text">LISTA PROGETTI</span>
                <span style="font-size:12px;">→</span>
            </div>
        </div>
    `;

    // Per ogni blocco
    Object.keys(menuStructure).forEach(bloccoKey => {
        const blocco = menuStructure[bloccoKey];
        
        html += `
            <div class="sidebar-section">
                <div class="sidebar-section-title">
                    <span>${blocco.icon}</span>
                    <span>${blocco.label.toUpperCase()}</span>
                </div>
        `;

        // Items del blocco
        blocco.items.forEach(item => {
            const isActive = currentMenuState.blocco === bloccoKey && 
                           currentMenuState.sottosezione === item.id;
            const isDisabled = item.status === 'disabled';
            
            html += `
                <div class="menu-item ${isActive ? 'active blocco-'+bloccoKey : ''} ${isDisabled ? 'disabled' : ''} submenu-item"
                     onclick="${isDisabled ? '' : `navigateToSection('${bloccoKey}', '${item.id}')`}">
                    <span class="menu-item-icon">${item.icon}</span>
                    <span class="menu-item-text">${item.label}</span>
                    <span class="menu-item-badge badge-${item.status}">
                        ${window.BadgeRenderer ? 
                            BadgeRenderer.getBadgeHTML(item) : 
                            getStatusIcon(item.status)
                        }
                    </span>
                </div>
                ${item.completamento !== undefined && item.completamento < 100 && window.BadgeRenderer ? 
                    `<div style="padding: 0 12px;">${BadgeRenderer.renderMiniProgressBar(item.completamento)}</div>` : 
                    ''
                }
            `;
        });

        html += `</div>`;
    });

    // Keyboard shortcuts hint
    html += `
        <div class="keyboard-hint">
            <strong>⌨️ Shortcuts:</strong><br>
            <kbd>G</kbd> Generale • <kbd>U</kbd> Ufficio • <kbd>P</kbd> Posa<br>
            <kbd>←</kbd> <kbd>→</kbd> Naviga sezioni
        </div>
    `;

    sidebar.innerHTML = html;
}

// Get status icon
function getStatusIcon(status) {
    switch(status) {
        case 'completed': return '✅';
        case 'in-progress': return '⏳';
        case 'disabled': return '❌';
        default: return '';
    }
}

// Toggle menu (mobile)
function toggleMenu() {
    const sidebar = document.getElementById('sidebarMenu');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (sidebar && overlay) {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('active');
    }
}

// Chiudi sidebar
function closeSidebar() {
    const sidebar = document.getElementById('sidebarMenu');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (sidebar && overlay) {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
    }
}

// 🆕 v8.486: Forza aggiornamento app (bypassa cache)
function forceUpdateApp() {
    closeSidebar();
    
    if (confirm('🔄 Forzare aggiornamento app?\n\nI dati salvati NON verranno persi.\nLa pagina verrà ricaricata dalla rete.')) {
        // Forza refresh bypassando cache browser
        const url = new URL(window.location.href);
        url.searchParams.set('nocache', Date.now());
        
        // Pulisce cache del Service Worker se presente
        if ('caches' in window) {
            caches.keys().then(names => {
                names.forEach(name => caches.delete(name));
            });
        }
        
        // Ricarica forzando dalla rete
        window.location.href = url.toString();
    }
}

// Toggle GitHub Projects cascata
function toggleGithubProjects(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const expandable = event.currentTarget;
    const submenu = document.getElementById('githubProjectsList');
    
    if (expandable && submenu) {
        expandable.classList.toggle('expanded');
        
        if (submenu.style.display === 'none') {
            submenu.style.display = 'block';
        } else {
            submenu.style.display = 'none';
        }
    }
}

// Toggle Impostazioni nel menu laterale
function toggleImpostazioni(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const expandable = event.currentTarget;
    const submenu = document.getElementById('impostazioniMenu');
    
    if (expandable && submenu) {
        expandable.classList.toggle('expanded');
        
        if (submenu.style.display === 'none') {
            submenu.style.display = 'block';
        } else {
            submenu.style.display = 'none';
        }
    }
}

// Popola menu laterale con progetti GitHub
function updateSidebarMenu(projects) {
    // 🔧 v8.66: Lista progetti rimossa dalla sidebar — usa LISTA PROGETTI dall'hamburger
    const submenu = document.getElementById('githubProjectsList');
    if (submenu) submenu.innerHTML = '';
    console.log(`ℹ️ v8.66: Lista progetti sidebar disabilitata — usa blocco-progetti`);
}

/**
 * v8.492: Toggle espansione lista progetti
 */
function toggleProjectsList(showAll) {
    const submenu = document.getElementById('githubProjectsList');
    if (submenu) {
        submenu.dataset.showAll = showAll ? 'true' : 'false';
        // Ri-renderizza con i progetti salvati
        if (window.githubProjects) {
            updateSidebarMenu(window.githubProjects);
        }
    }
}

// ⚠️ v7.73: loadGitHubProject definita più avanti (riga ~18900)
// NON duplicare qui!

// Navigate to section
function navigateToSection(blocco, sottosezione) {
    console.log(`Navigate to: ${blocco} > ${sottosezione}`);
    
    // Update state
    currentMenuState.blocco = blocco;
    currentMenuState.sottosezione = sottosezione;
    
    // Switch blocco if different
    if (currentBlocco !== blocco) {
        switchBlocco(blocco);
    }
    
    // Update breadcrumb
    updateBreadcrumb(blocco, sottosezione);
    
    // Re-render menu to update active state
    renderAdvancedMenu();
    
    // Close mobile menu
    const sidebar = document.getElementById('menuSidebar');
    if (sidebar && window.innerWidth <= 768) {
        sidebar.classList.remove('open');
    }
    
    // Handle specific actions based on section
    handleSectionAction(blocco, sottosezione);
}

// Handle section-specific actions
function handleSectionAction(blocco, sottosezione) {
    switch(blocco) {
        case 'generale':
            // Scroll to relevant section
            switch(sottosezione) {
                case 'dashboard':
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    break;
                case 'tabella':
                    const tableSection = document.getElementById('kpiCardsContainer');
                    if (tableSection) {
                        tableSection.scrollIntoView({ behavior: 'smooth' });
                    }
                    break;
            }
            break;
            
        case 'ufficio':
            switch(sottosezione) {
                case 'generale':
                    switchVistaUfficio('generale');
                    break;
                case 'posizioni':
                    switchVistaUfficio('posizioni');
                    break;
                case 'aziende':
                    switchVistaUfficio('aziende');
                    break;
            }
            break;
    }
}

// Update breadcrumb
function updateBreadcrumb(blocco, sottosezione) {
    const breadcrumb = document.getElementById('breadcrumb');
    if (!breadcrumb) return;

    const bloccoLabel = menuStructure[blocco]?.label || blocco;
    const sottosezioneItem = menuStructure[blocco]?.items.find(i => i.id === sottosezione);
    const sottosezioneLabel = sottosezioneItem?.label || sottosezione;

    breadcrumb.innerHTML = `
        <div class="breadcrumb-content">
            <a href="#" class="breadcrumb-item" onclick="switchBlocco('progetti'); return false;" style="font-weight:600;">📋 Progetti</a>
            <span class="breadcrumb-separator">›</span>
            <a href="#" class="breadcrumb-item" onclick="navigateToSection('generale', 'dashboard'); return false;">Dashboard</a>
            <span class="breadcrumb-separator">›</span>
            <span class="breadcrumb-item">${bloccoLabel}</span>
            <span class="breadcrumb-separator">›</span>
            <span class="breadcrumb-item current">${sottosezioneLabel}</span>
        </div>
    `;
}

// Setup keyboard shortcuts
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ignore if typing in input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        switch(e.key.toLowerCase()) {
            case 'g':
                navigateToSection('generale', 'dashboard');
                break;
            case 'u':
                navigateToSection('ufficio', 'generale');
                break;
        }
    });
}

// Modify existing switchBlocco to update menu state
const originalSwitchBlocco = switchBlocco;
switchBlocco = function(blocco) {
    // v8.60: Crea blocco-progetti se necessario
    if (blocco === 'progetti') {
        initBloccoProgetti();
        renderBloccoProgetti(window.githubProjects || []);
    }
    
    originalSwitchBlocco(blocco);
    currentMenuState.blocco = blocco;
    
    // Set default sottosezione
    const defaultSottosezione = menuStructure[blocco]?.items[0]?.id || 'dashboard';
    currentMenuState.sottosezione = defaultSottosezione;
    
    updateBreadcrumb(blocco, defaultSottosezione);
    renderAdvancedMenu();
};

// ============================================================================
// VISTA POSIZIONI UFFICIO - Variabili Globali
// ============================================================================
let currentPositionIndex = 0;
let filteredPositions = [];
let allPositionsData = [];
let projectData = null; // 🆕 Dati completi progetto (per config globale)

// ============================================================================
// VISTA POSIZIONI - RENDER PRINCIPALE
// ============================================================================
function renderVistaPosizioniUfficio(data) {
    console.log('📋 Rendering Vista Posizioni Ufficio...');
    
    if (!data) {
        console.warn('⚠️ Nessun dato progetto');
        return;
    }
    
    // 🆕 v8.67: Inizializza array posizioni se mancante (progetto nuovo da ufficio)
    if (!data.posizioni) data.posizioni = [];
    if (!data.positions) data.positions = [];

    // Nascondi placeholder, mostra contenuto SEMPRE (anche con 0 posizioni)
    document.getElementById('posizioniPlaceholder').classList.add('content-hidden');
    document.getElementById('posizioniContent').classList.remove('content-hidden');
    
    // ✅ Popola header progetto
    const nomeProgetto = data.nome || data.projectName || 'Progetto Senza Nome';
    const nomeCliente = data.cliente?.nome || data.cliente?.ragione_sociale || 
                      data.customerName || 'Cliente Non Specificato';
    const cognomeCliente = data.cliente?.cognome || '';
    const dataRilievo = data.data_rilievo || data.metadata?.created || Date.now();
    const numPosizioni = data.posizioni.length;
    
    // Formatta data
    const dataFormatted = new Date(dataRilievo).toLocaleDateString('it-IT', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
    
    // Aggiorna elementi header
    document.getElementById('projectNameDisplay').textContent = nomeProgetto;
    document.getElementById('projectClientDisplay').textContent = 
        `👤 ${nomeCliente}${cognomeCliente ? ' ' + cognomeCliente : ''}`;
    document.getElementById('projectDateDisplay').textContent = `📅 ${dataFormatted}`;
    document.getElementById('projectPositionsCountDisplay').textContent = 
        `📍 ${numPosizioni} posizion${numPosizioni !== 1 ? 'i' : 'e'}`;
    
    // 🆕 v8.502: Popola pulsante Schizzo Notability
    const schizzoContainer = document.getElementById('schizzoButtonContainer');
    if (schizzoContainer && typeof NOTABILITY !== 'undefined') {
        schizzoContainer.innerHTML = NOTABILITY.renderButton(data, { 
            size: 'small',
            showEditButton: true 
        });
    }
    
    console.log(`ℹ️ Header progetto popolato: ${nomeProgetto} - ${nomeCliente}`);
    
    // Salva dati progetto completi (per config globale)
    projectData = data;
    
    // Salva dati posizioni
    allPositionsData = data.posizioni;
    filteredPositions = [...allPositionsData];
    currentPositionIndex = 0;
    
    // Popola filtri
    populateFilters();
    
    // Render config globale
    renderConfigGlobale();
    
    // ✅ v7.73: Inizializza menu configurazione prodotti
    initConfigMenu();
    
    // Rende lista e dettaglio
    renderPositionsList();
    renderPositionDetail(0);
    
    console.log(`✅ Vista Posizioni rendered: ${allPositionsData.length} posizioni`);
}

// ============================================================================
// BLOCCO UFFICIO - RENDER VISTA AZIENDE
// ============================================================================
function renderVistaAziende(data) {
    console.log('🏢 Rendering Vista Aziende...');
    
    // Salva dati progetto completi
    projectData = data;
    
    // Nascondi placeholder, mostra contenuto (usando classList invece di style.display)
    document.getElementById('aziendePlaceholder').classList.add('content-hidden');
    document.getElementById('aziendeContent').classList.remove('content-hidden');
    
    // Raggruppa prodotti per azienda
    const aziendeMap = groupProductsByAzienda(data.posizioni);
    
    // NUOVO LAYOUT: Tab orizzontali + contenuto espandibile
    const aziendeArray = Array.from(aziendeMap.entries());
    
    // Genera HTML per tab orizzontali
    const tabsHTML = `
        <div class="aziende-tabs-container">
            <div class="aziende-tabs">
                ${aziendeArray.map(([aziendaKey, aziendaData], index) => {
                    const totaleProdotti = aziendaData.prodotti.reduce((sum, p) => sum + p.quantita, 0);
                    const displayName = aziendaData.displayName || aziendaKey;
                    return `
                        <div class="azienda-tab ${index === 0 ? 'active' : ''}" 
                             onclick="showAziendaDetails('${displayName}', ${index})"
                             id="azienda-tab-${index}">
                            <div class="azienda-tab-icon">🏢</div>
                            <div class="azienda-tab-content">
                                <div class="azienda-tab-name">${displayName}</div>
                                <div class="azienda-tab-count">${totaleProdotti} pz</div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
    
    // Genera HTML per contenuti espandibili
    const contentsHTML = `
        <div class="aziende-details-container">
            ${aziendeArray.map(([aziendaKey, aziendaData], index) => {
                const displayName = aziendaData.displayName || aziendaKey;
                return `
                    <div class="azienda-details ${index === 0 ? 'active' : ''}" 
                         id="azienda-details-${index}">
                        ${renderAziendaCard(displayName, aziendaData, data)}
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    // Inserisci nel DOM
    document.getElementById('aziendeCards').innerHTML = tabsHTML + contentsHTML;
    
    console.log(`✅ Vista Aziende rendered: ${aziendeMap.size} aziende`);
}

// NUOVA FUNZIONE: Mostra dettagli azienda selezionata
function showAziendaDetails(aziendaName, index) {
    // Rimuovi classe active da tutti i tab
    document.querySelectorAll('.azienda-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Rimuovi classe active da tutti i contenuti
    document.querySelectorAll('.azienda-details').forEach(details => {
        details.classList.remove('active');
    });
    
    // Aggiungi classe active al tab selezionato
    document.getElementById(`azienda-tab-${index}`).classList.add('active');
    
    // Aggiungi classe active al contenuto selezionato
    document.getElementById(`azienda-details-${index}`).classList.add('active');
    
    console.log(`📂 Azienda selezionata: ${aziendaName}`);
}

// ============================================================================
// LISTINO FINSTRAL - EUR 2025/3
// ============================================================================

// ✅ v8.66: CAMPIONI_TIPO_101/401, TELAI_PVC/ALU/INTERNI, SUPPLEMENTI_ANTE
// → Centralizzati in finstral-module.js (shared-database)

// ============================================================================
// LISTINO PUNTO PERSIANE - STECCHE FISSE TONDE - 2025
// ============================================================================

// 🆕 v7.92: MAGGIORAZIONI MODELLI PERSIANE (da listino pag. 88)
const MAGGIORAZIONI_MODELLI_PERSIANE = {
    'Alto Adige': 0.33,      // +33% (verificato da preventivo Punto Persiane)
    'Alto Adige [R]': 0.17,  // +17%
    'Alto Adige [TT]': 0.225, // +22.5%
    'Cortina': 0.04,          // +4%
    'Cortina [R]': 0.04,      // +4%
    'Nerina': 0.04,           // +4%
    'Nerina [R]': 0.04,       // +4%
    'Canazei': 0.04,          // +4%
    'Diamante': 0.04          // +4%
};

// VOCI FISSE PERSIANE (da PDF Punto Persiane)
const VOCI_FISSE_PERSIANE = {
    contributoGestione: 97.00,  // €97 fisso
    imballoPercent: 3.00,       // 3% sul totale
    cardiniBase: 3.50,          // €3.50 cad (C.SAF90)
    cardiniQuantita: 4          // 4 pezzi per F2
};

// ============================================================================
// LISTINO OIKOS PORTE BLINDATE - 2025
// ============================================================================
const LISTINO_OIKOS_BLINDATE = {
    // Prezzi base per versione e luce
    prezziBase: {
        'E3': { 'luce0': 1156, 'luce1': 1206, 'luce2': 1441 },
        'E4': { 'luce0': 1436, 'luce1': 1486, 'luce2': 1721 },
        'E3D': { 'luce3': 2217, 'luce4': 2532 },
        'E3EI30': { 'luce0': 1731 },
        'E3EI45': { 'luce0': 1731 },
        'E3EI60': { 'luce0': 1891 },
        'E3TT086': { 'luce0': 2254, 'luce1': 2442, 'luce2': 2766 },
        'E3TT1': { 'luce0': 1958, 'luce1': 2131, 'luce2': 2386 },
        'P3': { 'luce0': 1173, 'luce1': 1293, 'luce2': 1480 }
    },
    // Controtelaio
    controtelaio: {
        'luce0': 177, 'luce1': 202, 'luce2': 240,
        'luce3': 318, 'luce4': 350
    },
    // Cilindro
    cilindri: { 'BASIC': 123, 'SEKUR': 238 },
    // Colori telaio
    colori: {
        'RAL8022': 0,
        'OIKOS_Polveri': 246,
        'OIKOS_Evergreen': 320,
        'OIKOS_Future': 384,
        'OIKOS_Liquido': 492
    },
    // Termica upgrade
    termica: {
        'singola': {
            '1.2': { 'luce0': 272, 'luce1': 308, 'luce2': 354 },
            '1.0': { 'luce0': 496, 'luce1': 544, 'luce2': 624 }
        }
    },
    // Kit Aria-Acqua-Vento
    kitAAV: {
        'MOSE': { 'luce0': 405, 'luce1': 464, 'luce2': 499, 'luce3': 499, 'luce4': 499 },
        'DAM': { 'luce0': 459, 'luce1': 489, 'luce2': 514, 'luce3': 514, 'luce4': 514 }
    },
    // Rivestimenti (prezzi da listino EVO 2025)
    rivestimenti: {
        // Piano - Di Serie (pag. 94)
        'Piano Di Serie': { 'luce0': 192, 'luce1': 192, 'luce2': 235, 'luce3': 346, 'luce4': 414 },
        // 🔐 v7.98_05: Piano - Non di serie (pag. 99)
        'Piano Non di serie': { 'luce0': 405, 'luce1': 405, 'luce2': 483, 'luce5': 526, 'luce6': 585, 'luce3': 626, 'luce4': 811 },
        'Piano Non di serie Noce Canaletto': { 'luce0': 458, 'luce1': 458, 'luce2': 545, 'luce3': 700, 'luce4': 889 },
        'Piano Non di serie Teak': { 'luce0': 520, 'luce1': 520, 'luce2': 620, 'luce3': 782, 'luce4': 1005 },
        'Piano Non di serie Altre Essenze': { 'luce0': 486, 'luce1': 486, 'luce2': 579, 'luce3': 751, 'luce4': 973 },
        // Piano - Gres (pag. 100)
        'Piano Gres': { 'luce0': 1304, 'luce1': 1347, 'luce2': 1436 },
        // Piano generico (media per retrocompatibilità)
        'Piano': { 'luce0': 192, 'luce1': 192, 'luce2': 235, 'luce3': 346, 'luce4': 414 },
        // Fugato
        'Fugato': { 'luce0': 592, 'luce1': 592, 'luce2': 706, 'luce3': 894, 'luce4': 1156 },
        // Pantografato
        'Pantografato': { 'luce0': 791, 'luce1': 791, 'luce2': 968, 'luce3': 1235, 'luce4': 1477 },
        // Legno Vivo
        'LegnoVivo': { 'luce0': 1183, 'luce1': 1183, 'luce2': 1411, 'luce3': 1788, 'luce4': 2304 },
        // Massello (su richiesta - stima)
        'Massello': { 'luce0': 450, 'luce1': 520, 'luce2': 590 },
        // Riflessi Vetro
        'Riflessi': { 'luce0': 1197, 'luce1': 1322, 'luce2': 1534 },
        'Riflessi Vetro': { 'luce0': 1197, 'luce1': 1322, 'luce2': 1534 },
        // Alluminio (su richiesta - stima)
        'Alluminio': { 'luce0': 280, 'luce1': 320, 'luce2': 360 },
        // Gres
        'Gres': { 'luce0': 1304, 'luce1': 1347, 'luce2': 1436 },
        // Tekno
        'Tekno': { 'luce0': 909, 'luce1': 1000, 'luce2': 1192 }
    },
    // Optional vetro blindato
    vetroBlindato: {
        'V1': { 'trasparente': 1050, 'sabbiato': 1150 },
        'V2': { 'trasparente': 1350, 'sabbiato': 1450 },
        'V3': { 'trasparente': 1650, 'sabbiato': 1750 },
        'V4': { 'trasparente': 2100, 'sabbiato': 2200 },
        'V5': { 'trasparente': 2800, 'sabbiato': 2900 }
    },
    // Optional vetro termico
    vetroTermico: {
        'V1': { 'trasparente': 850, 'sabbiato': 950 },
        'V2': { 'trasparente': 1100, 'sabbiato': 1200 },
        'V3': { 'trasparente': 1350, 'sabbiato': 1450 },
        'V4': { 'trasparente': 1750, 'sabbiato': 1850 },
        'V5': { 'trasparente': 2350, 'sabbiato': 2450 }
    },
    // Sopraluce
    sopraluce: {
        'H500': { 'luce0': 380, 'luce1': 420, 'luce2': 480 },
        'H800': { 'luce0': 520, 'luce1': 580, 'luce2': 650 },
        'controtelaio': { 'luce0': 95, 'luce1': 110, 'luce2': 130 },
        'sabbiato_H500': { 'luce0': 85, 'luce1': 95, 'luce2': 110 },
        'sabbiato_H800': { 'luce0': 110, 'luce1': 125, 'luce2': 145 }
    },
    // Fiancoluce
    fiancoluce: {
        'conVetro': { 'luce1': 650, 'luce2': 750, 'luce3': 850 },
        'senzaVetro': { 'luce1': 380, 'luce2': 440, 'luce3': 500 },
        'sabbiato': { 'luce1': 95, 'luce2': 110, 'luce3': 125 },
        'colori': {
            'OIKOS_Polveri': { 'luce1': 150, 'luce2': 175, 'luce3': 200 },
            'OIKOS_Evergreen': { 'luce1': 195, 'luce2': 225, 'luce3': 255 },
            'OIKOS_Future': { 'luce1': 235, 'luce2': 270, 'luce3': 305 },
            'OIKOS_Liquido': { 'luce1': 300, 'luce2': 345, 'luce3': 390 }
        }
    },
    // Acustica maggiorata
    acusticaMagg: 120,
    // Verniciatura esterni
    verniciaturaEst: 150,
    
    // 🆕 v7.98: IMBOTTI (da listino EVO 2025 pag. 142-143)
    imbotti: {
        // Imbotte esterno in legno - prezzo per altezza × larghezza
        'imbotte_cornici': {
            // Altezze (H1=fino 2100, H2=fino 2400)
            'H1': {
                'L20': 180, 'L25': 210, 'L30': 240, 'L35': 270, 'L40': 300
            },
            'H2': {
                'L20': 210, 'L25': 245, 'L30': 280, 'L35': 315, 'L40': 350
            }
        },
        'imbotte_solo': {
            'H1': { 'L20': 140, 'L25': 165, 'L30': 190, 'L35': 215, 'L40': 240 },
            'H2': { 'L20': 165, 'L25': 195, 'L30': 225, 'L35': 255, 'L40': 285 }
        },
        // Essenza maggiorazione (rispetto a standard)
        'essenze': {
            'tangMog': 0,        // Tanganica Mogano - standard
            'tangNat': 0,        // Tanganica Naturale
            'rovereNat': 20,     // Rovere Naturale +€20
            'rovereSbi': 35,     // Rovere Sbiancato +€35
            'noce': 45,          // Noce +€45
            'noceCan': 65,       // Noce Canaletto +€65
            'teak': 85,          // Teak +€85
            'laccato': 60        // Laccato +€60
        }
    },
    
    // 🆕 v7.98: CORNICI FERMA PANNELLO (pag. 142)
    cornici: {
        'fermaPannello': { 'luce0': 96, 'luce1': 108, 'luce2': 125, 'luce3': 145, 'luce4': 165 },
        'interne': { 'luce0': 85, 'luce1': 95, 'luce2': 110, 'luce3': 125, 'luce4': 145 }
    },
    
    // 🆕 v7.98: MANIGLIE E POMOLI (pag. 144-148)
    maniglie: {
        // Maniglie interne
        'MO-05': { 'OL': 0, 'OL_TZ': 45, 'CS': 35, 'CL': 40, 'VP': 50, 'VL': 60, 'VS': 55 },
        'MO-07Q': { 'OL': 65, 'OL_TZ': 95, 'CS': 85, 'CL': 90, 'VP': 95, 'VL': 105, 'VS': 100 },
        'MO-07T': { 'OL': 65, 'OL_TZ': 95, 'CS': 85, 'CL': 90, 'VP': 95, 'VL': 105, 'VS': 100 },
        'MO-08Q': { 'OL': 85, 'OL_TZ': 120, 'CS': 105, 'CL': 110, 'VP': 115, 'VL': 130, 'VS': 120 },
        'MO-08T': { 'OL': 85, 'OL_TZ': 120, 'CS': 105, 'CL': 110, 'VP': 115, 'VL': 130, 'VS': 120 },
        'MO-13Q': { 'OL': 95, 'OL_TZ': 135, 'CS': 120, 'CL': 125, 'VP': 130, 'VL': 145, 'VS': 135 },
        'MO-13T': { 'OL': 95, 'OL_TZ': 135, 'CS': 120, 'CL': 125, 'VP': 130, 'VL': 145, 'VS': 135 },
        'MO-03T': { 'OL_TZ': 145, 'CS': 130, 'CL': 135 },
        // Pomoli esterni
        'PO-05': { 'OL': 0, 'OL_TZ': 35, 'CS': 30, 'CL': 32, 'VP': 40, 'VL': 50, 'VS': 45 },
        'PO-02': { 'OL_TZ': 55, 'CS': 45, 'CL': 48 },
        'PO-INOX': { 'INOX': 76 },
        // Maniglioni
        'JUMBO-300': { 'VP': 180, 'VL': 210, 'VS': 195, 'OB': 220 },
        'JUMBO-600': { 'VP': 240, 'VL': 280, 'VS': 260, 'OB': 295 }
    },
    
    // 🆕 v7.98: CHIAVI EXTRA (oltre le 3 di serie)
    chiaviExtra: 25  // €25 per ogni chiave aggiuntiva
};

// Funzione calcolo luce Oikos
function calcolaLuceOikos(L, H) {
    if (L <= 0 || H <= 0) return '';
    if (L <= 900 && H <= 2100) return 'luce0';
    if (L <= 940 && H <= 2210) return 'luce1';
    if (L <= 1030 && H <= 2400) return 'luce2';
    if (L <= 1350 && H <= 2210) return 'luce3';
    if (L <= 1600 && H <= 2400) return 'luce4';
    if (L <= 1800 && H <= 2210) return 'luce5';
    if (L <= 2000 && H <= 2400) return 'luce6';
    return 'fuoriMisura';
}

// Funzione calcolo prezzo blindata Oikos
function calcolaPrezzoBlindataOikos(bld) {
    const dettaglio = {
        prezzoBase: 0,
        controtelaio: 0,
        cilindro: 0,
        colore: 0,
        acustica: 0,
        termica: 0,
        kitAAV: 0,
        rivestimenti: 0,
        optional: 0,
        // 🆕 v7.98: Nuovi campi
        imbotti: 0,
        cornici: 0,
        maniglie: 0,
        chiaviExtra: 0
    };
    
    // Calcola luce se non presente
    const L = parseInt(bld.LNP_L) || 0;
    const H = parseInt(bld.LNP_H) || 0;
    const luce = bld.luceCalcolata || calcolaLuceOikos(L, H) || 'luce0';
    
    // Prezzo base anta
    dettaglio.prezzoBase = LISTINO_OIKOS_BLINDATE.prezziBase[bld.versione]?.[luce] || 
                           LISTINO_OIKOS_BLINDATE.prezziBase['E3']?.[luce] || 0;
    
    // Controtelaio
    if (bld.controtelaio === 'si' || bld.controtelaio === true) {
        dettaglio.controtelaio = LISTINO_OIKOS_BLINDATE.controtelaio[luce] || 0;
    }
    
    // Cilindro
    dettaglio.cilindro = LISTINO_OIKOS_BLINDATE.cilindri[bld.cilindro] || 
                         LISTINO_OIKOS_BLINDATE.cilindri['BASIC'] || 0;
    
    // 🆕 v7.98: CHIAVI EXTRA (oltre le 3 di serie)
    const numChiavi = parseInt(bld.numChiavi) || 3;
    if (numChiavi > 3) {
        dettaglio.chiaviExtra = (numChiavi - 3) * (LISTINO_OIKOS_BLINDATE.chiaviExtra || 25);
        console.log(`   Chiavi extra: ${numChiavi - 3} × €25 = €${dettaglio.chiaviExtra}`);
    }
    
    // Colore telaio
    dettaglio.colore = LISTINO_OIKOS_BLINDATE.colori[bld.coloreTelaio] || 0;
    
    // 🆕 v7.98: MANIGLIA INTERNA
    if (bld.manigliaInt && bld.finituraInt) {
        const prezzoManInt = LISTINO_OIKOS_BLINDATE.maniglie[bld.manigliaInt]?.[bld.finituraInt] || 0;
        dettaglio.maniglie += prezzoManInt;
        console.log(`   Maniglia INT: ${bld.manigliaInt} ${bld.finituraInt} → €${prezzoManInt}`);
    }
    
    // 🆕 v7.98: MANIGLIA/POMOLO ESTERNO
    if (bld.manigliaEst && bld.finituraEst) {
        let finitura = bld.finituraEst;
        // PO-INOX usa sempre finitura INOX
        if (bld.manigliaEst === 'PO-INOX') finitura = 'INOX';
        const prezzoManEst = LISTINO_OIKOS_BLINDATE.maniglie[bld.manigliaEst]?.[finitura] || 0;
        dettaglio.maniglie += prezzoManEst;
        console.log(`   Maniglia EST: ${bld.manigliaEst} ${finitura} → €${prezzoManEst}`);
    }
    
    // Acustica maggiorata
    if (bld.acustica === 'maggiorata') {
        dettaglio.acustica = LISTINO_OIKOS_BLINDATE.acusticaMagg || 0;
    }
    
    // Termica
    if (bld.termica && bld.termica !== 'serie') {
        dettaglio.termica = LISTINO_OIKOS_BLINDATE.termica?.['singola']?.[bld.termica]?.[luce] || 0;
    }
    
    // Kit AAV (MOSE/DAM)
    if (bld.kitAAV) {
        dettaglio.kitAAV = LISTINO_OIKOS_BLINDATE.kitAAV[bld.kitAAV]?.[luce] || 0;
    }
    
    // Rivestimento INTERNO
    if (bld.rivestimentoInt?.linea) {
        // 🔐 v7.98_05: Chiave composita linea+modello per prezzi specifici
        const linea = bld.rivestimentoInt.linea;
        const modello = bld.rivestimentoInt.modello || '';
        const essenza = bld.rivestimentoInt.essenza || '';
        let keyRiv = linea;
        
        // Prova chiave specifica (es. "Piano Non di serie Noce Canaletto")
        if (modello === 'Non di serie') {
            if (essenza.includes('Noce Canaletto')) {
                keyRiv = `${linea} ${modello} Noce Canaletto`;
            } else if (essenza.includes('Teak')) {
                keyRiv = `${linea} ${modello} Teak`;
            } else if (essenza.includes('Altre Essenze')) {
                keyRiv = `${linea} ${modello} Altre Essenze`;
            } else {
                keyRiv = `${linea} ${modello}`;
            }
        } else if (modello === 'Gres') {
            keyRiv = `${linea} Gres`;
        } else if (modello) {
            keyRiv = `${linea} ${modello}`;
        }
        
        // Cerca prezzo con fallback
        const prezzoRiv = LISTINO_OIKOS_BLINDATE.rivestimenti[keyRiv]?.[luce] ||
                          LISTINO_OIKOS_BLINDATE.rivestimenti[linea]?.[luce] || 0;
        dettaglio.rivestimenti += prezzoRiv;
        console.log(`   Riv INT: ${keyRiv} → €${prezzoRiv}`);
    }
    
    // Rivestimento ESTERNO
    if (bld.rivestimentoEst?.linea) {
        // 🔐 v7.98_05: Chiave composita linea+modello per prezzi specifici
        const linea = bld.rivestimentoEst.linea;
        const modello = bld.rivestimentoEst.modello || '';
        const essenza = bld.rivestimentoEst.essenza || '';
        let keyRiv = linea;
        
        if (modello === 'Non di serie') {
            if (essenza.includes('Noce Canaletto')) {
                keyRiv = `${linea} ${modello} Noce Canaletto`;
            } else if (essenza.includes('Teak')) {
                keyRiv = `${linea} ${modello} Teak`;
            } else if (essenza.includes('Altre Essenze')) {
                keyRiv = `${linea} ${modello} Altre Essenze`;
            } else {
                keyRiv = `${linea} ${modello}`;
            }
        } else if (modello === 'Gres') {
            keyRiv = `${linea} Gres`;
        } else if (modello) {
            keyRiv = `${linea} ${modello}`;
        }
        
        const prezzoRiv = LISTINO_OIKOS_BLINDATE.rivestimenti[keyRiv]?.[luce] ||
                          LISTINO_OIKOS_BLINDATE.rivestimenti[linea]?.[luce] || 0;
        dettaglio.rivestimenti += prezzoRiv;
        console.log(`   Riv EST: ${keyRiv} → €${prezzoRiv}`);
        
        // Verniciatura esterni
        if (bld.rivestimentoEst.verniciatura) {
            dettaglio.rivestimenti += LISTINO_OIKOS_BLINDATE.verniciaturaEst || 0;
        }
    }
    
    // 🆕 v7.98: IMBOTTI ESTERNO
    if (bld.imbotteEst && bld.imbotteEst !== '' && bld.imbotteEstAltezza && bld.imbotteEstLargh) {
        const tipoImbotte = bld.imbotteEst; // 'imbotte_cornici' o 'imbotte_solo'
        const altezza = bld.imbotteEstAltezza; // 'H1' o 'H2'
        const larghezza = bld.imbotteEstLargh; // 'L20', 'L25', 'L30', 'L35', 'L40'
        const essenza = bld.imbotteEstEssenza || 'tangMog';
        
        // Prezzo base imbotte
        const prezzoImbotte = LISTINO_OIKOS_BLINDATE.imbotti[tipoImbotte]?.[altezza]?.[larghezza] || 0;
        // Maggiorazione essenza
        const maggEssenza = LISTINO_OIKOS_BLINDATE.imbotti.essenze[essenza] || 0;
        
        dettaglio.imbotti = prezzoImbotte + maggEssenza;
        console.log(`   Imbotte: ${tipoImbotte} ${altezza}×${larghezza} ${essenza} → €${dettaglio.imbotti}`);
    }
    
    // 🆕 v7.98: CORNICI FERMA PANNELLO
    if (bld.corniciFermaPannello) {
        dettaglio.cornici += LISTINO_OIKOS_BLINDATE.cornici.fermaPannello[luce] || 0;
        console.log(`   Cornici ferma pannello: €${dettaglio.cornici}`);
    }
    
    // 🆕 v7.98: CORNICI INTERNE
    if (bld.corniciInt) {
        dettaglio.cornici += LISTINO_OIKOS_BLINDATE.cornici.interne[luce] || 0;
        console.log(`   Cornici interne: €${dettaglio.cornici}`);
    }
    
    // Optional: VETRO
    if (bld.vetro?.attivo && bld.vetro?.tipo) {
        const tipoVetro = bld.vetro.termico ? 
            LISTINO_OIKOS_BLINDATE.vetroTermico : 
            LISTINO_OIKOS_BLINDATE.vetroBlindato;
        const finitura = bld.vetro.finitura || 'trasparente';
        dettaglio.optional += tipoVetro[bld.vetro.tipo]?.[finitura] || 0;
    }
    
    // Optional: SOPRALUCE
    if (bld.sopraluce?.attivo && bld.sopraluce?.altezza) {
        dettaglio.optional += LISTINO_OIKOS_BLINDATE.sopraluce[bld.sopraluce.altezza]?.[luce] || 0;
        dettaglio.optional += LISTINO_OIKOS_BLINDATE.sopraluce.controtelaio[luce] || 0;
        if (bld.sopraluce.sabbiato) {
            const sabKey = 'sabbiato_' + bld.sopraluce.altezza;
            dettaglio.optional += LISTINO_OIKOS_BLINDATE.sopraluce[sabKey]?.[luce] || 0;
        }
    }
    
    // Optional: FIANCOLUCE
    if (bld.fiancoluce?.attivo) {
        const luceFL = luce === 'luce0' ? 'luce1' : luce;
        if (bld.fiancoluce.conVetro) {
            dettaglio.optional += LISTINO_OIKOS_BLINDATE.fiancoluce.conVetro[luceFL] || 0;
        } else {
            dettaglio.optional += LISTINO_OIKOS_BLINDATE.fiancoluce.senzaVetro[luceFL] || 0;
        }
        if (bld.fiancoluce.sabbiato) {
            dettaglio.optional += LISTINO_OIKOS_BLINDATE.fiancoluce.sabbiato[luceFL] || 0;
        }
        if (bld.fiancoluce.colore && bld.fiancoluce.colore !== 'RAL8022') {
            dettaglio.optional += LISTINO_OIKOS_BLINDATE.fiancoluce.colori[bld.fiancoluce.colore]?.[luceFL] || 0;
        }
    }
    
    // Totale
    const totale = dettaglio.prezzoBase + dettaglio.controtelaio + dettaglio.cilindro +
                  dettaglio.colore + dettaglio.acustica + dettaglio.termica +
                  dettaglio.kitAAV + dettaglio.rivestimenti + dettaglio.optional +
                  dettaglio.imbotti + dettaglio.cornici + dettaglio.maniglie + dettaglio.chiaviExtra;
    
    console.log(`🔐 Calcolo Oikos: Base €${dettaglio.prezzoBase} + CT €${dettaglio.controtelaio} + Cil €${dettaglio.cilindro} + Col €${dettaglio.colore} + Riv €${dettaglio.rivestimenti} + Imb €${dettaglio.imbotti} + Cor €${dettaglio.cornici} + Man €${dettaglio.maniglie} + Opt €${dettaglio.optional} = €${totale}`);
    
    return {
        totale: totale,
        dettaglio: dettaglio,
        luce: luce
    };
}


// ============================================================================
// 🚪 FERREROLEGNO PORTE INTERNE 2025 - Collezioni FL, Replica, Zero
// ============================================================================
/**
 * FERREROLEGNO DATABASE 2025
 * Porte Interne - Collezioni FL, Replica, Zero
 * 
 * ValiditÃ : 1 Aprile 2025
 * Sconto Installatore: 50%
 * 
 * STRUTTURA:
 * - FERREROLEGNO_CONFIG: Configurazione generale
 * - FERREROLEGNO_COLLEZIONI_FL: Collezioni standard legno/laccato
 * - FERREROLEGNO_REPLICA: Linea sintetica
 * - FERREROLEGNO_ZERO: Linea filo muro
 * - FERREROLEGNO_TELAI: Telai per ogni linea
 * - FERREROLEGNO_MAGGIORAZIONI: Supplementi comuni
 * - calcolaPrezzoFerreroLegno(): Funzione calcolo
 */

// =============================================================================
// CONFIGURAZIONE GENERALE
// =============================================================================

// ═══════════════════════════════════════════════════════════════════════════
// 📦 FUNZIONE CALCOLO PREZZO CASSONETTO FINSTRAL
// ═══════════════════════════════════════════════════════════════════════════
// ============================================================================
// ✅ CENTRALIZZATO in finstral-module.js (shared-database)
// calcolaPrezzoCassonettoFinstral, mappaColoreACodiceFinstral,
// getCodiceApertura, formatTipoApertura, getSupplementoCerniereScomparsa,
// calcolaSupplementoFerramenta, isTelaioRC2Compatibile, verificaMisureMinime
// ============================================================================

// ============================================================================
// RENDER VISTA PREVENTIVO - v7.24
// ============================================================================

function renderVistaPreventivo(data) {
    console.log('💰 Rendering Vista Preventivo...');
    
    // Nascondi placeholder, mostra contenuto
    document.getElementById('preventivoPlaceholder').classList.add('content-hidden');
    document.getElementById('preventivoContent').classList.remove('content-hidden');
    
    // Calcola preventivo
    const preventivo = calcolaPreventivo(data);
    
    // Popola tabella
    popolaTabellaPreventivo(preventivo);
    
    console.log('✅ Vista Preventivo rendered');
}

// 🚪 v8.63: Stub calcolo portoncino (fallback se findoor-portoncini.js non caricato)
function _calcolaPortoncinoStub(ptc, L_mm, H_mm) {
    const isAlu = (ptc.materialeInt === 'ALU' || ptc.materialeEst === 'ALU' || ptc.materialeEst === 'alu');
    const base = isAlu ? 2100 : 1400;
    const fattoreDim = Math.max(1, (L_mm * H_mm) / (1000 * 2200));
    const totale = Math.round(base * fattoreDim);
    return {
        totale, prezzoBase: totale, supplModello: 0, supplSerratura: 0,
        supplCerniere: 0, supplCilindro: 0, supplSoglia: 0, supplManiglia: 0,
        supplManigliaInt: 0, supplChiudiporta: 0, supplRC2: 0, supplAccessori: 0,
        prezzoLaterali: 0, prezzoSopraluce: 0, dettaglio: [`STUB: base €${totale}`], _stub: true
    };
}

function calcolaPreventivo(data) {
    console.log('💰 calcolaPreventivo() chiamata con data:', data);
    console.log('📊 Numero posizioni:', (data.positions || data.posizioni || []).length);
    
    const righe = [];
    let totaleMateriali = 0;
    let numeroPezzi = 0;
    
    // GESTISCI ENTRAMBE LE STRUTTURE: positions (app) e posizioni (vecchio)
    const posizioni = data.positions || data.posizioni || [];
    
    console.log('🔍 Struttura posizioni:', posizioni.length > 0 ? 'OK' : 'VUOTA');
    console.log('🔍 Array righe PRIMA forEach:', righe.length);
    
    // Processa ogni posizione
    posizioni.forEach((pos, index) => {
        // 🔐 v7.98_07: NORMALIZZA BLINDATA da ingresso.blindata se non già presente
        if (pos.ingresso?.blindata && !pos.blindata) {
            pos.blindata = pos.ingresso.blindata;
            console.log(`   🔐 NORMALIZZATO pos ${index + 1}: ingresso.blindata → blindata`);
        }
        
        // getQta() da prodotti-config.js (global)
        
        // Processa INFISSI
        const infissoQta = getQta(pos.infisso);
        if (pos.infisso && infissoQta > 0) {
            const infisso = pos.infisso;
            
            // 🔧 v8.54: BRM centralizzato via getProductBRM (offset +100/+50 per infissi)
            const brmInfisso = getProductBRM(infisso, pos, { L: 100, H: 50 });
            let L_mm = brmInfisso.L;
            let H_mm = brmInfisso.H;
            let brmStimato = brmInfisso.stimato;
            let brmOrigine = brmInfisso.origine;
            if (brmStimato) console.log(`📐 Pos ${index + 1}: BRM STIMATO da ${brmOrigine} → ${L_mm} × ${H_mm} mm`);
            
            if (L_mm && H_mm) {
                // ✅ v7.55: Log tipo e tipoAnta infissi
                const numAnteInfisso = estraiNumeroAnte(infisso.tipo);
                console.log(`🪟 Infisso tipo="${infisso.tipo || 'N/D'}" → ${numAnteInfisso} ante`);
                console.log(`🚪 Tipo Anta: "${infisso.tipoAnta || data.configInfissi?.tipoAnta || 'step-line'}"`);
                
                // Calcola perimetro BRM
                const perimetro_ml = calcolaPerimetroBRM(L_mm, H_mm);
                const superficie_mq = (L_mm * H_mm) / 1000000;
                
                // Ottieni telaio (da configurazione o da infisso)
                const telaio = infisso.telaio || 
                               data.configInfissi?.telaio || 
                               '961';
                
                // Determina colore (per supplemento)
                const coloreEsterno = infisso.coloreEst || 
                                     infisso.coloreEsterno || 
                                     data.configInfissi?.coloreEst ||
                                     data.configInfissi?.coloreEsterno || 
                                     '';
                const coloreInterno = infisso.coloreInt || 
                                     infisso.coloreInterno || 
                                     data.configInfissi?.coloreInt ||
                                     data.configInfissi?.coloreInterno || 
                                     '';
                const coloreScuro = isColoreScuro(coloreEsterno);
                
                // ✅ v7.73: Estrai tipo anta per calcolo colore
                const tipoAnta = infisso.tipoAnta || data.configInfissi?.tipoAnta || 'step-line';
                
                // ✅ v8.467: USA FUNZIONE CENTRALIZZATA PER DETERMINARE TIPO
                const tipoInfo = determinaTipoInfisso(infisso, data.configInfissi);
                const tipoFinstral = tipoInfo.tipoFinstral;
                const isScorrevole = tipoInfo.isScorrevole;
                const isFinSlide = tipoInfo.isFinSlide;  // 🆕 v8.472
                const tipoVisualizzato = tipoInfo.tipoVisualizzato;
                const ferramenta1 = infisso.ferramenta1 || '';
                
                // ✅ v8.468 FIX: Ripristina variabili per compatibilità
                const tipoInfisso = (infisso.tipo || tipoVisualizzato || '').toLowerCase();
                const apertura = infisso.apertura || infisso.tipo || 'battente';
                
                console.log(`🏷️ Pos ${index+1}: tipoVisualizzato="${tipoVisualizzato}", tipoFinstral="${tipoFinstral}", isScorrevole=${isScorrevole}, isFinSlide=${isFinSlide}`);
                
                // 🆕 v8.472: CALCOLO FIN-SLIDE (HST) - Usa database dedicato
                if (isFinSlide && typeof FINSLIDE_PREZZI !== 'undefined') {
                    // 🆕 v8.481: Supporta sia camelCase che snake_case da JSON
                    // 🆕 v8.483: Default telaio 90M (ALU-PVC 168mm)
                    const finslideTelaio = infisso.finslideTelaio || infisso.finslide_telaio || '90M';
                    const finslideAnta = infisso.finslideAnta || infisso.finslide_anta || 'Step-line Door';
                    const finslideFerramenta = infisso.finslideFerramenta || infisso.finslide_ferramenta || '83';
                    
                    console.log(`🏠 FIN-Slide Pos ${index+1}: Telaio=${finslideTelaio}, Anta=${finslideAnta}, Ferr=${finslideFerramenta}`);
                    
                    // Calcola prezzo telaio
                    const prezzoTelaio = FINSLIDE_PREZZI.calcolaPrezzoTelaio(finslideTelaio, L_mm, H_mm);
                    
                    // 🆕 v8.475: Determina numero ante mobili E numero elementi fissi
                    const numAnteMobili = tipoInfo.numAnte || 1;
                    let numFissi = 0;
                    
                    // Mappa codice → numero fissi
                    const mappaFissi = {
                        'FS600': 1,   // 1 fisso
                        'FS601': 1,   // anta + fisso
                        'FS602': 1,   // fisso + anta
                        'FS610': 1,   // anta + fisso + anta
                        'FS611': 2,   // anta + fisso + fisso + anta
                        'FS614': 1,   // 2 ante + fisso
                        'FS615': 1,   // 2 ante collegate + fisso
                        'FS616': 1,   // fisso + 2 ante
                        'FS617': 1,   // anta + fisso + 2 ante
                        'FS621': 2    // 2 fissi
                    };
                    numFissi = mappaFissi[tipoFinstral] || 0;
                    
                    // Calcola larghezze proporzionali
                    const numCampi = numAnteMobili + numFissi;
                    const larghezzaCampo = numCampi > 0 ? L_mm / numCampi : L_mm;
                    
                    // Calcola prezzo anta (solo per ante mobili)
                    const prezzoAntaUnit = numAnteMobili > 0 ? FINSLIDE_PREZZI.calcolaPrezzoAnta(finslideAnta, larghezzaCampo, H_mm) : 0;
                    const prezzoAnte = prezzoAntaUnit * numAnteMobili;
                    
                    // 🆕 v8.477: Calcola prezzo ELEMENTO FISSO (profilo battente FIN-Slide)
                    // L'elemento fisso FIN-Slide usa lo stesso profilo dell'anta, non tipo 102
                    // Fattore correttivo: ~63% del prezzo anta (basato su confronto protocollo)
                    let prezzoFissi = 0;
                    if (numFissi > 0) {
                        // Usa la stessa griglia delle ante con fattore 0.628
                        const prezzoFissoUnit = FINSLIDE_PREZZI.calcolaPrezzoAnta(finslideAnta, larghezzaCampo, H_mm) * 0.628;
                        prezzoFissi = prezzoFissoUnit * numFissi;
                        
                        console.log(`📐 Fisso FIN-Slide: ${larghezzaCampo}×${H_mm}, €${(prezzoFissoUnit/0.628).toFixed(0)}×0.628=${prezzoFissoUnit.toFixed(0)}×${numFissi}=€${prezzoFissi.toFixed(0)}`);
                    }
                    
                    // Supplemento ferramenta
                    const supplFerr = FINSLIDE_PREZZI.supplementiFerramenta?.[finslideFerramenta]?.prezzo || 0;
                    
                    // 🆕 v8.479: Calcola prezzo MANIGLIA HST
                    // Maniglia serie 2 = €166 (default per porta-finestra alzante scorrevole)
                    // 🆕 v8.481: Supporta sia camelCase che snake_case da JSON
                    const finslideManiglia = infisso.finslideManiglia || infisso.finslide_maniglia || 'serie2';
                    let prezzoManiglia = 0;
                    if (FINSLIDE_PREZZI.maniglie?.[finslideManiglia]) {
                        prezzoManiglia = FINSLIDE_PREZZI.maniglie[finslideManiglia].default || 166;
                    } else {
                        // Default: maniglia serie 2 per HST
                        prezzoManiglia = 166;
                    }
                    console.log(`🚪 Maniglia HST: ${finslideManiglia} = €${prezzoManiglia}`);
                    
                    // 🆕 v8.480: Calcola prezzo VETRI FIN-Slide
                    // Default: Max-Valor 3 triplo 46mm (più comune per HST)
                    // 🆕 v8.481: Supporta sia camelCase che snake_case da JSON
                    const finslideVetro = infisso.finslideVetro || infisso.finslide_vetro || 'Max-Valor3_46';
                    let prezzoVetri = 0;
                    
                    if (FINSLIDE_PREZZI.vetri?.[finslideVetro]) {
                        const vetroConfig = FINSLIDE_PREZZI.vetri[finslideVetro];
                        
                        // Superficie per campo in m²
                        const superficieCampo = (larghezzaCampo / 1000) * (H_mm / 1000);
                        
                        // Prezzo vetro anta: €145/m² (codice 11429)
                        // Prezzo vetro fisso: €176/m² (codice 12429) - vetro più spesso
                        const prezzoVetroAnta = vetroConfig.codici?.['11429']?.prezzoMq || vetroConfig.default || 145;
                        const prezzoVetroFisso = vetroConfig.codici?.['12429']?.prezzoMq || 176;
                        
                        const prezzoVetriAnte = superficieCampo * prezzoVetroAnta * numAnteMobili;
                        const prezzoVetriFissi = superficieCampo * prezzoVetroFisso * numFissi;
                        prezzoVetri = prezzoVetriAnte + prezzoVetriFissi;
                        
                        console.log(`🔷 Vetri FIN-Slide: ${superficieCampo.toFixed(2)}m² × (${numAnteMobili}×€${prezzoVetroAnta} + ${numFissi}×€${prezzoVetroFisso}) = €${prezzoVetri.toFixed(2)}`);
                    }
                    
                    // 🆕 v8.480: Totale FIN-Slide include FISSI + MANIGLIA + VETRI
                    const totaleFinSlide = prezzoTelaio + prezzoAnte + prezzoFissi + supplFerr + prezzoManiglia + prezzoVetri;
                    
                    console.log(`💰 FIN-Slide Pos ${index+1}: Telaio €${prezzoTelaio} + Ante €${prezzoAnte} + Fissi €${prezzoFissi} + Ferr €${supplFerr} + Maniglia €${prezzoManiglia} + Vetri €${prezzoVetri.toFixed(0)} = €${totaleFinSlide.toFixed(0)}`);
                    
                    // Quantità - 🆕 v8.510: USA SOLO prodotto.qta
                    const quantita = getQta(infisso) || 1;
                    const totaleRiga = totaleFinSlide * quantita;
                    
                    // ✅ v8.468: Validazione prodotto
                    const validazioneInfisso = validaProdotto('infisso', infisso, data.configInfissi);
                    
                    righe.push({
                        posizione: index + 1,
                        ambiente: pos.ambiente || pos.nome || pos.stanza || `Pos ${index + 1}`,
                        tipo: tipoVisualizzato,
                        tipoFinstral: tipoFinstral,
                        isScorrevole: true,
                        isFinSlide: true,
                        validazione: validazioneInfisso,
                        brmStimato: brmStimato,
                        brmOrigine: brmOrigine,
                        azienda: 'Finstral',
                        telaio: `HST-${finslideTelaio}`,
                        tipoAnta: finslideAnta,
                        vetro: finslideVetro,  // 🆕 v8.480: Tipo vetro HST
                        larghezza: L_mm,
                        altezza: H_mm,
                        superficie: superficie_mq.toFixed(2),
                        perimetro: perimetro_ml.toFixed(2),
                        prezzoBase: prezzoTelaio.toFixed(2),
                        supplemento: (prezzoAnte + prezzoFissi + supplFerr + prezzoManiglia + prezzoVetri).toFixed(2),  // 🆕 v8.480: Include vetri
                        supplementoTelaio: '0.00',
                        supplementoAnta: prezzoAnte.toFixed(2),
                        supplementoFisso: prezzoFissi.toFixed(2),
                        numFissi: numFissi,
                        supplementoVetro: prezzoVetri.toFixed(2),  // 🆕 v8.480: Vetri HST
                        vetroHST: finslideVetro,  // 🆕 v8.480
                        supplementoColore: '0.00',
                        supplementoManiglia: prezzoManiglia.toFixed(2),
                        manigliaHST: finslideManiglia,
                        supplementoMontante: '0.00',
                        supplementoSoglia: '0.00',
                        supplementoManigliettaPF: '0.00',
                        supplementoTagli: '0.00',
                        tagli: '',
                        isPortaFinestra: true,
                        prezzoUnitario: totaleFinSlide.toFixed(2),
                        quantita: quantita,
                        totale: totaleRiga.toFixed(2)
                    });
                    
                    totaleMateriali += totaleRiga;
                    numeroPezzi += quantita;
                    
                } else {
                // CALCOLO STANDARD (non FIN-Slide)
                
                // Determina materiale
                // ✅ v7.73 FIX: Usa finituraEst per determinare se esterno è alluminio
                const finituraEstInfisso = infisso.finituraEst || infisso.finitura_est || '';
                const finituraEstConfig = data.configInfissi?.finituraEst || data.configInfissi?.finitura_est || '';
                const finituraEst = (finituraEstInfisso || finituraEstConfig || '').toLowerCase();
                const materiale = finituraEst.includes('alluminio') || finituraEst.includes('alu') ? 'alluminio' : 'pvc';
                console.log(`🔧 Materiale Pos ${index+1}:`);
                console.log(`   infisso.finituraEst = "${infisso.finituraEst || 'undefined'}"`);
                console.log(`   infisso.finitura_est = "${infisso.finitura_est || 'undefined'}"`);
                console.log(`   configInfissi.finituraEst = "${data.configInfissi?.finituraEst || 'undefined'}"`);
                console.log(`   → finituraEst finale = "${finituraEst}" → materiale = ${materiale}`);
                
                // ✅ v7.73: Mappa colori a codici Finstral
                const codicePVC = mappaColoreACodiceFinstral(coloreInterno || coloreEsterno, 'pvc');
                const codiceAlluminio = materiale === 'alluminio' ? 
                    mappaColoreACodiceFinstral(coloreEsterno, 'alluminio') : null;
                
                // ✅ CALCOLO FINSTRAL COMPLETO CON COLORI
                console.log(`🚀 Chiamata calcolaPrezzoFinstral con materiale="${materiale}"${isScorrevole ? ', SCORREVOLE' : ''}`);
                const risultatoFinstral = calcolaPrezzoFinstral({
                    tipo: tipoFinstral,
                    larghezza: L_mm,
                    altezza: H_mm,
                    telaio: telaio,
                    materiale: materiale,
                    tipoAnta: tipoAnta,
                    colorePVC: codicePVC,
                    coloreAlluminio: codiceAlluminio,
                    ferramenta1: ferramenta1,  // ✅ v8.466: Per scorrevoli
                    isScorrevole: isScorrevole
                });
                
                let prezzoBase = 400; // Fallback
                let supplementoTelaioFinstral = 0;
                let supplementoColoreFinstral = 0;
                let supplementoProfiloAntaFinstral = 0;
                let supplementoMontanteFinstral = 0;
                
                if (!risultatoFinstral.errore) {
                    prezzoBase = risultatoFinstral.dettaglio.prezzoBase;
                    supplementoTelaioFinstral = risultatoFinstral.dettaglio.supplementoTelaio || 0;
                    supplementoProfiloAntaFinstral = risultatoFinstral.dettaglio.supplementoProfiloAnta || 0;
                    supplementoMontanteFinstral = risultatoFinstral.dettaglio.supplementoMontante || 0;
                    supplementoColoreFinstral = (risultatoFinstral.dettaglio.supplementoColorePVC || 0) + 
                                               (risultatoFinstral.dettaglio.supplementoColoreAlluminio || 0);
                    
                    const gruppoCol = risultatoFinstral.dettaglio.gruppoColorePVC || 'A';
                    console.log(`💰 FINSTRAL Pos ${index+1}: tipo${tipoFinstral} ${L_mm}×${H_mm} tel.${telaio} ${tipoAnta}`);
                    console.log(`   └─ Base €${prezzoBase} + Telaio €${supplementoTelaioFinstral.toFixed(2)} + Profilo €${supplementoProfiloAntaFinstral.toFixed(2)}`);
                } else {
                    // ✅ v7.73 FIX: Calcola supplementi SEMPRE, anche con fallback prezzo base
                    const tipo = getTipoDaApertura(apertura);
                    prezzoBase = trovaCampionePrezzoBase(tipo, L_mm, H_mm) || 400;
                    
                    // Calcola supplementi manualmente usando FINSTRAL_PREZZI
                    // 🆕 v8.505: Usa struttura gruppi colore A/B
                    const supplTelaio = FINSTRAL_PREZZI.supplementiTelaio?.[telaio];
                    if (supplTelaio) {
                        // Determina gruppo colore (A o B) dal codice PVC
                        const gruppoB = FINSTRAL_PREZZI.supplementiColorePVC?.gruppoB || ["46", "06", "13", "19", "55", "36"];
                        const gruppoColore = gruppoB.includes(codicePVC) ? 'B' : 'A';
                        const keyPvc = gruppoColore === 'B' ? 'pvcB' : 'pvcA';
                        const keyAlu = gruppoColore === 'B' ? 'aluB' : 'aluA';
                        
                        if (materiale === 'alluminio') {
                            // PVC-ALU: somma supplemento PVC interno + supplemento ALU esterno
                            const suppPvc = supplTelaio[keyPvc] || supplTelaio.pvc || 0;
                            const suppAlu = supplTelaio[keyAlu] || supplTelaio.alluminio || 0;
                            supplementoTelaioFinstral = Math.round((suppPvc + suppAlu) * perimetro_ml * 100) / 100;
                            console.log(`📊 Telaio ${telaio} gruppo ${gruppoColore}: PVC €${suppPvc}/ml + ALU €${suppAlu}/ml × ${perimetro_ml.toFixed(2)}ml = €${supplementoTelaioFinstral}`);
                        } else {
                            // PVC-PVC: solo supplemento PVC
                            const suppPvc = supplTelaio[keyPvc] || supplTelaio.pvc || 0;
                            supplementoTelaioFinstral = Math.round(suppPvc * perimetro_ml * 100) / 100;
                            console.log(`📊 Telaio ${telaio} gruppo ${gruppoColore}: PVC €${suppPvc}/ml × ${perimetro_ml.toFixed(2)}ml = €${supplementoTelaioFinstral}`);
                        }
                    }
                    
                    // ✅ v7.79 FIX: Calcola perimetro BATTENTI per supplemento profilo anta
                    const larghezzaAnta_m_fb = (L_mm / numAnteInfisso) / 1000;
                    const altezzaAnta_m_fb = H_mm / 1000;
                    const perimetroBattenti_fb = 2 * (larghezzaAnta_m_fb + altezzaAnta_m_fb) * numAnteInfisso;
                    
                    const antaNorm = tipoAnta.toLowerCase().replace(/\s+/g, '-');
                    
                    // ✅ v7.79: Prima controlla tabelle dimensionali
                    const larghezzaAnta_mm_fb = L_mm / numAnteInfisso;
                    const suppTabella_fb = getSupplementoAntaDimensionale(antaNorm, H_mm, larghezzaAnta_mm_fb);
                    if (suppTabella_fb !== null && suppTabella_fb > 0) {
                        supplementoProfiloAntaFinstral = Math.round(suppTabella_fb * numAnteInfisso * 100) / 100;
                        console.log(`📊 Fallback tabella ${antaNorm}: €${suppTabella_fb}/pz × ${numAnteInfisso} = €${supplementoProfiloAntaFinstral}`);
                    } else {
                        const supplProfilo = FINSTRAL_PREZZI.supplementiProfiloAnta?.[antaNorm];
                        if (supplProfilo) {
                            // 🆕 v8.505: Usa struttura gruppi colore A/B
                            const gruppoB = FINSTRAL_PREZZI.supplementiColorePVC?.gruppoB || ["46", "06", "13", "19", "55", "36"];
                            const gruppoColore = gruppoB.includes(codicePVC) ? 'B' : 'A';
                            const keyPvc = gruppoColore === 'B' ? 'pvcB' : 'pvcA';
                            const keyAlu = gruppoColore === 'B' ? 'aluB' : 'aluA';
                            
                            // Nova-line è SOLO PVC (vetro esterno, no alluminio)
                            const isNovaLine_fb = antaNorm.includes('nova');
                            
                            let suppPvc = supplProfilo[keyPvc] || supplProfilo.pvc || 0;
                            let suppAlu = 0;
                            if (materiale === 'alluminio' && !isNovaLine_fb) {
                                suppAlu = supplProfilo[keyAlu] || supplProfilo.alluminio || 0;
                            }
                            
                            supplementoProfiloAntaFinstral = Math.round((suppPvc + suppAlu) * perimetroBattenti_fb * 100) / 100;
                            console.log(`📊 Profilo ${antaNorm} gruppo ${gruppoColore}: PVC €${suppPvc}/ml + ALU €${suppAlu}/ml × ${perimetroBattenti_fb.toFixed(2)}ml = €${supplementoProfiloAntaFinstral}`);
                        }
                    }
                    
                    // ✅ v7.79 FIX: Montante per 2 ante con nodo specifico per tipo anta
                    if (tipoFinstral === "401") {
                        const codiceNodo_fb = FINSTRAL_PREZZI.nodiPerTipoAnta?.[antaNorm] || "codice28";
                        const montanteData = FINSTRAL_PREZZI.supplementiMontante?.[codiceNodo_fb];
                        if (montanteData) {
                            // Per fallback, usa gruppo semplificato
                            if (materiale === 'alluminio') {
                                // Verifica se colore decorativo
                                const colEst = (infisso.coloreEst || '').toUpperCase();
                                if (colEst.startsWith('L') || colEst.includes('CASTAGNO') || colEst.includes('ROVERE')) {
                                    supplementoMontanteFinstral = montanteData.aluC || montanteData.aluA || 0;
                                } else {
                                    supplementoMontanteFinstral = montanteData.aluA || 0;
                                }
                            } else {
                                supplementoMontanteFinstral = montanteData.pvcA || 0;
                            }
                            console.log(`📊 Fallback montante ${codiceNodo_fb}: €${supplementoMontanteFinstral}`);
                        }
                    }
                    
                    console.log(`⚠️ Finstral fuori range Pos ${index+1}, uso fallback prezzoBase: €${prezzoBase}`);
                    console.log(`   └─ Perimetro battenti: ${perimetroBattenti_fb.toFixed(2)}ml (${numAnteInfisso} ante)`);
                    console.log(`   └─ MA supplementi FINSTRAL: Telaio €${supplementoTelaioFinstral.toFixed(2)} + Profilo €${supplementoProfiloAntaFinstral.toFixed(2)} + Montante €${supplementoMontanteFinstral.toFixed(2)}`);
                }
                
                // Usa supplementi Finstral (calcolati sempre)
                const supplementoTelaio = supplementoTelaioFinstral;
                
                // ✅ v7.73: Supplemento colore (usa Finstral se disponibile)
                const supplementoColore = supplementoColoreFinstral;
                
                // ✅ v7.73: Supplemento profilo anta
                const supplementoProfiloAnta = supplementoProfiloAntaFinstral;
                
                // ✅ v7.73: Log dettagliato per debug
                if (!risultatoFinstral.errore) {
                    console.log(`📊 FINSTRAL Dettaglio Pos ${index+1}:`);
                    console.log(`   Base: €${prezzoBase}`);
                    console.log(`   Telaio ${telaio}: €${supplementoTelaioFinstral.toFixed(2)} (${perimetro_ml.toFixed(2)}ml)`);
                    console.log(`   Profilo ${tipoAnta}: €${supplementoProfiloAnta.toFixed(2)}`);
                    console.log(`   Colore: €${supplementoColore.toFixed(2)}`);
                }
                
                // Calcola supplemento vetro
                const tipoVetro = infisso.vetro || data.configInfissi?.vetro || 'doppio';
                const supplementoVetro = calcolaSupplementoVetro(tipoVetro, superficie_mq);
                
                // Calcola supplemento maniglia (v7.26: supporta database Finstral)
                const manigliaValue = infisso.maniglia || data.configInfissi?.maniglia || '';
                const coloreValue = infisso.coloreManiglia || data.configInfissi?.coloreManiglia || '';
                let supplementoManiglia = calcolaSupplementoManigliaFinstral(manigliaValue, coloreValue);
                
                // ✅ v7.56: Moltiplica maniglia per numero ante (1 maniglia/anta)
                supplementoManiglia = supplementoManiglia * numAnteInfisso;
                if (numAnteInfisso > 1) {
                    console.log(`🔧 Maniglie: ${numAnteInfisso} ante × supplemento = €${supplementoManiglia.toFixed(2)}`);
                }
                
                // ✅ v7.73: Supplemento MONTANTE (già calcolato sopra)
                const supplementoMontante = supplementoMontanteFinstral;
                if (supplementoMontante > 0) {
                    console.log(`🔗 Montante 2 ante: €${supplementoMontante.toFixed(2)}`);
                }
                
                // ✅ v7.74: Supplemento SOGLIA se porta-finestra (PF1, PF2, o H>=1800)
                let supplementoSoglia = 0;
                let supplementoManigliettaPF = 0;  // ✅ v8.10: Maniglietta esterna PF
                // ✅ v8.468 FIX: Usa tipoInfo.isPortaFinestra + fallback su stringa tipo
                const isPortaFinestra = tipoInfo.isPortaFinestra || 
                                       tipoInfisso.startsWith('pf') || tipoInfisso.startsWith('p1') || tipoInfisso.startsWith('p2') ||
                                       tipoInfisso.includes('porta') || apertura.includes('porta') ||
                                       H_mm >= 1800;  // Logica Finstral: altezza >= 1800mm = porta-finestra
                if (isPortaFinestra) {
                    const larghezza_ml = L_mm / 1000;
                    // ✅ v8.10: Soglia ribassata codice 3 = 54.50 €/ml
                    supplementoSoglia = larghezza_ml * (FINSTRAL_PREZZI.supplementiSoglia?.["codice3"] || 54.50);
                    console.log(`🚪 Soglia porta-finestra: ${larghezza_ml.toFixed(2)}ml × €54.50 = €${supplementoSoglia.toFixed(2)}`);
                    
                    // ✅ v8.10: Maniglietta esterna per porte-finestre (codice 454)
                    // Obbligatoria per Nova-line e altre ante
                    supplementoManigliettaPF = 39.10;  // €/pezzo
                    console.log(`🚪 Maniglietta esterna PF: €${supplementoManigliettaPF.toFixed(2)}`);
                }
                
                // ✅ v7.75: Supplemento TAGLI TELAIO (codici dal JSON)
                let supplementoTagli = 0;
                let taglioDescrizione = '';
                // Legge tagli dal JSON: può essere stringa singola o array
                const tagliRaw = infisso.taglio || infisso.tagli || pos.taglio || pos.tagli || null;
                if (tagliRaw) {
                    // Normalizza a array
                    const tagli = Array.isArray(tagliRaw) ? tagliRaw : [tagliRaw];
                    tagli.forEach(codice => {
                        const codiceClean = String(codice).trim().toUpperCase();
                        const prezzoTaglio = FINSTRAL_PREZZI.supplementiTagli?.[codiceClean] || 
                                             FINSTRAL_PREZZI.supplementiTagli?.[codiceClean.toLowerCase()] || 0;
                        if (prezzoTaglio > 0) {
                            const supplementoQuesto = prezzoTaglio * perimetro_ml;
                            supplementoTagli += supplementoQuesto;
                            taglioDescrizione += (taglioDescrizione ? ', ' : '') + codiceClean;
                            console.log(`✂️ Taglio ${codiceClean}: ${perimetro_ml.toFixed(2)}ml × €${prezzoTaglio}/ml = €${supplementoQuesto.toFixed(2)}`);
                        }
                    });
                }
                
                // Prezzo unitario (con tutti i supplementi)
                // ✅ v8.10: Aggiunto supplementoManigliettaPF
                const supplementoTotale = supplementoTelaio + supplementoProfiloAnta + supplementoVetro + supplementoManiglia + supplementoColore + supplementoMontante + supplementoSoglia + supplementoTagli + supplementoManigliettaPF;
                const prezzoUnitario = prezzoBase + supplementoTotale;
                
                // Quantità - 🆕 v8.510: USA SOLO prodotto.qta
                const quantita = getQta(infisso) || 1;
                
                // Totale riga
                const totaleRiga = prezzoUnitario * quantita;
                
                // ✅ v8.468: Validazione prodotto
                const validazioneInfisso = validaProdotto('infisso', infisso, data.configInfissi);
                
                righe.push({
                    posizione: index + 1,
                    ambiente: pos.ambiente || pos.nome || pos.stanza || `Pos ${index + 1}`,
                    tipo: isScorrevole ? tipoVisualizzato : `Infisso ${tipoVisualizzato}`,  // ✅ v8.467
                    tipoFinstral: tipoFinstral,  // ✅ v8.467: Codice Finstral
                    isScorrevole: isScorrevole,  // ✅ v8.467
                    validazione: validazioneInfisso,  // ✅ v8.468: Stato validazione
                    brmStimato: brmStimato,  // 🆕 v8.470: Flag BRM stimato
                    brmOrigine: brmOrigine,  // 🆕 v8.470: Fonte BRM (LF+100, TMV-40, etc.)
                    azienda: infisso.azienda || data.configInfissi?.azienda || 'Finstral',
                    telaio: telaio,  // ✅ v8.10: Solo codice telaio (es. "961")
                    tipoAnta: tipoAnta,  // ✅ v8.10: Tipo anta separato (es. "Nova-line")
                    vetro: infisso.vetro || '',  // ✅ v8.40: Tipo vetro (triplo, doppio, satinato)
                    larghezza: L_mm,
                    altezza: H_mm,
                    superficie: superficie_mq.toFixed(2),
                    perimetro: perimetro_ml.toFixed(2),
                    prezzoBase: prezzoBase.toFixed(2),
                    supplemento: supplementoTotale.toFixed(2),
                    supplementoTelaio: supplementoTelaio.toFixed(2),
                    supplementoAnta: supplementoProfiloAnta.toFixed(2),  // ✅ v7.73: Rinominato
                    supplementoVetro: supplementoVetro.toFixed(2),
                    supplementoColore: supplementoColore.toFixed(2),  // ✅ v7.73
                    supplementoManiglia: supplementoManiglia.toFixed(2),
                    supplementoMontante: supplementoMontante.toFixed(2),  // ✅ v7.73: NUOVO
                    supplementoSoglia: supplementoSoglia.toFixed(2),  // ✅ v7.74: NUOVO
                    supplementoManigliettaPF: supplementoManigliettaPF.toFixed(2),  // ✅ v8.10: NUOVO
                    supplementoTagli: supplementoTagli.toFixed(2),  // ✅ v7.75: NUOVO
                    tagli: taglioDescrizione || '',  // ✅ v7.75: Codici taglio applicati
                    isPortaFinestra: isPortaFinestra,  // ✅ v7.74: Flag per debug
                    prezzoUnitario: prezzoUnitario.toFixed(2),
                    quantita: quantita,
                    totale: totaleRiga.toFixed(2)
                });
                
                totaleMateriali += totaleRiga;
                numeroPezzi += quantita;
                }  // 🆕 v8.472: Fine else calcolo standard (non FIN-Slide)
            } else {
                console.warn(`⚠️ Pos ${index + 1}: Misure BRM non trovate, salto calcolo`);
            }
        }
        
        // ============================================================================
        // TAPPARELLE - PLASTICINO/NEW SOLAR/ESTELLA
        // ============================================================================
        
        // 🔍 DEBUG: Log completo posizione
        console.log(`🔍 DEBUG Pos ${index + 1}:`, {
            ha_tapparella: !!pos.tapparella,
            tapparella_completo: pos.tapparella,
            quantita: pos.tapparella?.quantita,
            azienda: pos.tapparella?.azienda,
            serveTapparella: pos.tapparella?.serveTapparella,
            serveMotore: pos.tapparella?.serveMotore
        });
        
        // 🆕 v7.996: Controlla serveTapparella - se false, salta telo e vai a motore
        const serveTapparella = pos.tapparella?.serveTapparella !== false;
        const serveMotore = pos.tapparella?.serveMotore === true;
        
        // ✅ FIX v7.996: Solo se serveTapparella è true (o undefined per retrocompatibilità)
        if (pos.tapparella && serveTapparella && hasQta(pos.tapparella)) {
            const tapp = pos.tapparella;
            const azienda = (tapp.azienda || '').toLowerCase();
            
            // FIX: Se quantita undefined, usa 1
            const quantita = parseInt(tapp.quantita) || 1;
            
            console.log(`✅ Pos ${index + 1} ha tapparella con quantità ${quantita}, azienda: "${azienda}"`);
            
            // 🔍 v7.50 DEBUG ESTREMO: Vedi TUTTA la struttura pos
            console.log(`🔍 v7.50 DEBUG pos.infisso completo:`, pos.infisso);
            console.log(`🔍 v7.50 pos.infisso.BRM_L = ${pos.infisso?.BRM_L} (type: ${typeof pos.infisso?.BRM_L})`);
            console.log(`🔍 v7.50 pos.infisso.BRM_H = ${pos.infisso?.BRM_H} (type: ${typeof pos.infisso?.BRM_H})`);
            console.log(`🔍 v7.50 pos.infisso.brm = `, pos.infisso?.brm);
            console.log(`🔍 v7.50 tapp.brm = `, tapp.brm);
            console.log(`🔍 v7.50 tapp completo:`, tapp);
            
            // 🔍 DEBUG: Accetta TUTTE le aziende per test
            const usaListinoPlasticino = LISTINO_PLASTICINO.aziende.includes(azienda);
            console.log(`🔍 Azienda "${azienda}" usa listino Plasticino? ${usaListinoPlasticino}`);
            console.log(`🔍 DEBUG: PROCEDO COMUNQUE con il calcolo (versione debug)`);
            
            // if (LISTINO_PLASTICINO.aziende.includes(azienda)) {  // ← RIMOSSO PER DEBUG
            if (true) {  // ← DEBUG: Accetta TUTTE le aziende
                // 🔧 v8.54: BRM centralizzato via getProductBRM (no offset per tapparelle)
                const brmTapp = getProductBRM(tapp, pos);
                let L_mm = brmTapp.L;
                let H_mm = brmTapp.H;
                let usaMisureForo = brmTapp.stimato;
                
                // 🆕 v7.81: MAGGIORAZIONI per misure foro (LF/HF)
                let L_telo_mm = L_mm;
                let H_telo_mm = H_mm;
                if (usaMisureForo) {
                    L_telo_mm = L_mm + 40;
                    H_telo_mm = H_mm + 200;
                }
                
                // ✅ Per calcolo Plasticino serve in CM (usa misure telo maggiorate)
                const L_cm = Math.round(L_telo_mm / 10);
                const H_cm = Math.round(H_telo_mm / 10);
                
                console.log(`✅ v7.81 Tapparella Pos ${index + 1}: Foro=${L_mm}×${H_mm}mm → Telo=${L_telo_mm}×${H_telo_mm}mm (${L_cm}×${H_cm}cm)`);
                
                if (L_cm > 0 && H_cm > 0) {
                    // Determina modello telo da dati tapparella (se presente)
                    const modelloTelo = tapp.modello || null;  // es. 'TA01', 'TA25', 'A01'
                    const coloreTelo = tapp.colore_tipo || null;  // es. 'tinta_unita', 'tinta_legno'
                    
                    // Calcola prezzo usando listino Plasticino COMPLETO (con telo)
                    const calcolo = calcolaPrezzoPLASTICINO(L_cm, H_cm, modelloTelo, coloreTelo);
                    
                    // 🆕 v7.81: Calcola prezzo guida
                    let prezzoGuida = 0;
                    let guidaInfo = { codice: '', descrizione: '', prezzo: 0 };
                    if (tapp.guida && tapp.guida !== '') {
                        guidaInfo = calcolaPrezzoGuida(tapp.guida, tapp.coloreGuida || 'Argento', H_mm);
                        prezzoGuida = guidaInfo.prezzo || 0;
                    }
                    
                    // Totale con guida
                    const totaleConGuida = calcolo.totale + prezzoGuida;
                    const totaleRiga = totaleConGuida * quantita;
                    
                    console.log(`💰 v7.81 Dettaglio tapparella Pos ${index + 1}:`, {
                        telo: `€${calcolo.telo.toFixed(2)} (${calcolo.telo_mq.toFixed(2)} mq × €${calcolo.telo_prezzo_mq}/mq) [${calcolo.telo_modello}]`,
                        rullo: `€${calcolo.rullo.toFixed(2)}`,
                        fissi: `€${calcolo.fissi.toFixed(2)}`,
                        supplemento: `€${calcolo.supplemento_altezza.toFixed(2)}`,
                        guida: `€${prezzoGuida.toFixed(2)} [${guidaInfo.codice || 'N/D'}]`,
                        totale: `€${totaleConGuida.toFixed(2)}`
                    });
                    
                    righe.push({
                        posizione: index + 1,
                        ambiente: pos.ambiente || pos.nome || pos.stanza || `Pos ${index + 1}`,
                        tipo: 'Tapparella',
                        azienda: tapp.azienda || 'Plasticino',
                        telaio: calcolo.telo_modello || '-',  // Mostra modello telo
                        larghezza: L_mm,  // ✅ v7.57: Mostra in MM (non cm!)
                        altezza: H_mm,    // ✅ v7.57: Mostra in MM (non cm!)
                        superficie: calcolo.telo_mq.toFixed(2),  // Superficie in mq
                        perimetro: '-',
                        // 🆕 v7.81: Mapping con GUIDA inclusa
                        prezzoBase: calcolo.telo.toFixed(2),             // TELO (costo principale)
                        supplementoTelaio: calcolo.rullo.toFixed(2),     // Rullo
                        supplementoAnta: calcolo.fissi.toFixed(2),       // Fissi
                        supplementoVetro: calcolo.supplemento_altezza.toFixed(2), // Supp altezza
                        supplementoManiglia: prezzoGuida.toFixed(2),     // 🆕 GUIDA
                        prezzoUnitario: totaleConGuida.toFixed(2),
                        quantita: quantita,
                        totale: totaleRiga.toFixed(2)
                    });
                    
                    totaleMateriali += totaleRiga;
                    numeroPezzi += quantita;
                    
                    console.log(`✅ Tapparella ${azienda} Pos ${index + 1}: ${L_mm}mm×${H_mm}mm = €${totaleConGuida.toFixed(2)} (Telo: €${calcolo.telo.toFixed(2)} + Rullo: €${calcolo.rullo.toFixed(2)} + Fissi: €${calcolo.fissi.toFixed(2)} + Guida: €${prezzoGuida.toFixed(2)})`);
                } else {
                    console.warn(`⚠️ Pos ${index + 1}: Tapparella ${azienda} senza misure, salto calcolo`);
                }
            } else {
                console.warn(`⚠️ Pos ${index + 1}: Azienda tapparelle "${tapp.azienda}" non ha listino prezzi`);
            }
        }
        
        // ============================================================================
        // 🔌 v7.999: MOTORI - Aggiunge riga SEMPRE quando serveMotore=true
        // (indipendentemente da serveTapparella - possono coesistere)
        // ============================================================================
        if (pos.tapparella && serveMotore) {
            const tapp = pos.tapparella;
            const motori = tapp.motori || [];
            const quantita = parseInt(tapp.qta || tapp.quantita) || 1;
            
            console.log(`🔌 v7.999 Pos ${index + 1}: MOTORE (serveMotore=true)`);
            console.log(`   Motori array:`, motori);
            
            // Se ci sono motori nell'array, creane una riga per ciascuno
            if (motori.length > 0) {
                motori.forEach((motore, motIdx) => {
                    const modelloId = motore.modelloId || tapp.motoreModelloDefault || 'oximo_20';
                    const comandoId = motore.comandoId || tapp.comandoDefault || '';
                    const accessori = motore.accessori || {};
                    const noteMotore = motore.note || '';
                    
                    // 🔌 v7.999: Calcola prezzo con SOMFY_PREZZI
                    const prezzoKit = SOMFY_PREZZI.calcolaPrezzoKit(motore);
                    const prezzoMotore = prezzoKit.totale;
                    
                    // Genera descrizione accessori per la riga
                    let descAccessori = [];
                    const motoreDb = SOMFY_PREZZI.getPrezzoMotore(modelloId);
                    if (motoreDb) descAccessori.push(motoreDb.nome);
                    const comandoDb = SOMFY_PREZZI.getPrezzoComando(comandoId);
                    if (comandoDb) descAccessori.push(comandoDb.nome);
                    if (accessori.supporto) descAccessori.push('Supporto');
                    if (accessori.ruota_60) descAccessori.push('Ruota 60');
                    if (accessori.corona_60) descAccessori.push('Corona');
                    
                    righe.push({
                        posizione: index + 1,
                        ambiente: pos.ambiente || pos.nome || `Pos ${index + 1}`,
                        tipo: 'Motore',
                        azienda: tapp.motoreAzienda || 'Somfy',
                        telaio: modelloId.replace(/_/g, ' ').toUpperCase(),
                        larghezza: '-',
                        altezza: '-',
                        superficie: '-',
                        perimetro: '-',
                        prezzoBase: (motoreDb?.prezzo || 0).toFixed(2),
                        supplementoTelaio: (comandoDb?.prezzo || 0).toFixed(2),  // Comando
                        supplementoAnta: (accessori.supporto ? (SOMFY_PREZZI.accessori.supporto?.listino || 7.88) : 0).toFixed(2),  // Supporto da DB
                        supplementoVetro: (accessori.ruota_60 ? (SOMFY_PREZZI.accessori.ruota_60?.listino || 21.00) : 0).toFixed(2),  // Ruota da DB
                        supplementoManiglia: '0.00',
                        prezzoUnitario: prezzoMotore.toFixed(2),
                        quantita: quantita,
                        totale: (prezzoMotore * quantita).toFixed(2),
                        _tipoMotore: true,
                        _accessori: accessori,
                        _comandoId: comandoId,
                        _dettaglioKit: prezzoKit.dettaglio
                    });
                    
                    // ✅ v8.11 FIX CRITICO: Somma motori al totale materiali
                    totaleMateriali += prezzoMotore * quantita;
                    numeroPezzi += quantita;
                    
                    console.log(`✅ Motore Pos ${index + 1}: ${modelloId} = €${prezzoMotore.toFixed(2)} (aggiunto a totale)`);
                    console.log(`   Dettaglio:`, prezzoKit.dettaglio);
                });
            } else {
                // Nessun motore specificato, ma serveMotore=true
                // Usa modelloDefault se presente
                const modelloDefault = tapp.motoreModelloDefault || 'oximo_20';
                const comandoDefault = tapp.comandoDefault || '';
                
                // Calcola prezzo default
                const motoreDb = SOMFY_PREZZI.getPrezzoMotore(modelloDefault);
                const comandoDb = SOMFY_PREZZI.getPrezzoComando(comandoDefault);
                const prezzoMotore = (motoreDb?.prezzo || 0) + (comandoDb?.prezzo || 0);
                
                righe.push({
                    posizione: index + 1,
                    ambiente: pos.ambiente || pos.nome || `Pos ${index + 1}`,
                    tipo: 'Motore',
                    azienda: tapp.motoreAzienda || 'Somfy',
                    telaio: modelloDefault.replace(/_/g, ' ').toUpperCase(),
                    larghezza: '-',
                    altezza: '-',
                    superficie: '-',
                    perimetro: '-',
                    prezzoBase: (motoreDb?.prezzo || 0).toFixed(2),
                    supplementoTelaio: (comandoDb?.prezzo || 0).toFixed(2),
                    supplementoAnta: '0.00',
                    supplementoVetro: '0.00',
                    supplementoManiglia: '0.00',
                    prezzoUnitario: prezzoMotore.toFixed(2),
                    quantita: quantita,
                    totale: (prezzoMotore * quantita).toFixed(2),
                    _tipoMotore: true
                });
                
                // ✅ v8.11 FIX CRITICO: Somma motori al totale materiali
                totaleMateriali += prezzoMotore * quantita;
                numeroPezzi += quantita;
                
                console.log(`✅ Motore Pos ${index + 1}: ${modelloDefault} (default) = €${prezzoMotore.toFixed(2)} (aggiunto a totale)`);
            }
        }
        
        // ============================================================================
        // PERSIANE - PUNTO PERSIANE
        // ============================================================================
        if (pos.persiana && hasQta(pos.persiana)) {
            const pers = pos.persiana;
            const quantita = parseInt(pers.quantita) || 1;
            
            // 🔧 v8.54: BRM centralizzato via getProductBRM
            const brmPers = getProductBRM(pers, pos);
            let L_mm = brmPers.L;
            let H_mm = brmPers.H;
            
            if (L_mm > 0 && H_mm > 0) {
                // ✅ v7.52: Implementato calcolo prezzi con listino Punto Persiane
                const azienda = (pers.azienda || '').toLowerCase();
                const usaListinoPuntoPersiane = LISTINO_PUNTO_PERSIANE.aziende.includes(azienda);
                
                console.log(`🔍 Azienda persiane "${azienda}" usa listino Punto Persiane? ${usaListinoPuntoPersiane}`);
                
                let prezzoUnitario = 0;
                let prezzoBase = 0;
                let supplementoColore = 0;
                let supplementoSpagnolette = 0;
                let categoriaColore = 'CAT01';
                let tipologia = 'F1';
                let cardini = 0;
                let imballo = 0;
                let contributoGestione = 0;
                
                if (usaListinoPuntoPersiane) {
                    // ✅ v7.55: Estrai numero ante dal campo tipo (F1, F2, PF2, ecc.)
                    const numAnte = estraiNumeroAnte(pers.tipo);
                    
                    // Determina se Finestra (F) o Porta Finestra (PF) in base altezza
                    const isPortaFinestra = H_mm >= 1800;
                    const prefix = isPortaFinestra ? 'PF' : 'F';
                    
                    // Determina tipologia in base al numero ante
                    tipologia = `${prefix}1`;
                    if (numAnte === 2) tipologia = `${prefix}2`;
                    else if (numAnte === 3) tipologia = 'F3'; // F3 solo finestre
                    else if (numAnte === 4) tipologia = 'F4'; // F4 solo finestre
                    
                    console.log(`📐 Persiana tipo="${pers.tipo}" → ${numAnte} ante, H=${H_mm}mm → ${isPortaFinestra ? 'Porta Finestra' : 'Finestra'} → Tipologia ${tipologia}`);
                    console.log(`📋 Modello persiana: "${pers.modello || 'N/D'}"`);
                    
                    // 🆕 v7.92: Usa calcolo COMPLETO con tutte le voci
                    const calcolo = calcolaPrezzoPersianaCOMPLETO(
                        L_mm, 
                        H_mm, 
                        tipologia, 
                        pers.modello || 'Alto Adige',  // Modello per maggiorazione
                        pers.colorePersiana,            // Colore
                        numAnte                         // Numero ante
                    );
                    
                    prezzoBase = calcolo.prezzo_base_con_modello;
                    supplementoColore = calcolo.supplemento_colore;
                    categoriaColore = calcolo.categoria_colore;
                    supplementoSpagnolette = calcolo.supplemento_spagnolette;
                    cardini = calcolo.cardini;
                    imballo = calcolo.imballo;
                    contributoGestione = calcolo.contributo_gestione;
                    
                    // Prezzo unitario finale CON TUTTE LE VOCI
                    prezzoUnitario = calcolo.totale;
                    
                    console.log(`✅ Persiana Pos ${index + 1}: TOTALE COMPLETO €${prezzoUnitario.toFixed(2)}`);
                } else {
                    console.warn(`⚠️ Pos ${index + 1}: Azienda persiane "${pers.azienda}" non ha listino prezzi`);
                }
                
                const totaleRiga = prezzoUnitario * quantita;
                
                righe.push({
                    posizione: index + 1,
                    ambiente: pos.ambiente || pos.nome || pos.stanza || `Pos ${index + 1}`,
                    tipo: `Persiana ${pers.tipo || tipologia}`,
                    azienda: pers.azienda || 'P. Persiane',
                    telaio: pers.modello ? `${pers.modello}` : '-',
                    larghezza: L_mm,
                    altezza: H_mm,
                    superficie: '-',
                    perimetro: '-',
                    prezzoBase: prezzoBase.toFixed(2),
                    supplementoTelaio: supplementoColore.toFixed(2),      // Colore
                    supplementoAnta: supplementoSpagnolette.toFixed(2),   // Spagnolette
                    supplementoVetro: cardini.toFixed(2),                 // 🆕 Cardini
                    supplementoManiglia: imballo.toFixed(2),              // 🆕 Imballo
                    supplementoColore: contributoGestione.toFixed(2),     // 🆕 Contributo gestione
                    supplementoMontante: '0.00',
                    prezzoUnitario: prezzoUnitario.toFixed(2),
                    quantita: quantita,
                    totale: totaleRiga.toFixed(2),
                    // Campi extra per debug
                    _colore: pers.colorePersiana || '-',
                    _categoriaColore: categoriaColore
                });
                
                totaleMateriali += totaleRiga;
                numeroPezzi += quantita;
            }
        }
        
        // ============================================================================
        // ZANZARIERE - PALAGINA
        // ============================================================================
        if (pos.zanzariera && hasQta(pos.zanzariera)) {
            const zanz = pos.zanzariera;
            const quantita = parseInt(zanz.quantita) || 1;
            
            // 🔧 v8.54: BRM centralizzato via getProductBRM
            const brmZanz = getProductBRM(zanz, pos);
            let L_mm = brmZanz.L;
            let H_mm = brmZanz.H;
            
            if (L_mm > 0 && H_mm > 0) {
                // 🦟 v8.13: Calcolo prezzi con listino PALAGINA
                let prezzoUnitario = 0;
                let noteRiga = '';
                let dettaglioCalcolo = null;
                
                const modello = zanz.modello || 'SINTESI';  // Default SINTESI
                const codColore = zanz.codiceColore || zanz.colore || '';
                const tipoRete = zanz.rete || zanz.tipoRete || 'STD';
                const accessoriIds = zanz.accessori || [];
                
                // Determina fascia colore
                let fascia = zanz.fascia || 'F1';
                if (codColore && PALAGINA_ZANZARIERE_2025.getFasciaByColore) {
                    const fasciaCalc = PALAGINA_ZANZARIERE_2025.getFasciaByColore(codColore);
                    if (fasciaCalc) fascia = fasciaCalc;
                }
                
                // Calcola prezzo con database PALAGINA
                const L_cm = L_mm / 10;  // mm → cm
                const H_cm = H_mm / 10;
                
                if (PALAGINA_ZANZARIERE_2025.modelli[modello]) {
                    dettaglioCalcolo = PALAGINA_ZANZARIERE_2025.calcolaPrezzo(modello, L_cm, H_cm, fascia, tipoRete, accessoriIds);
                    if (dettaglioCalcolo && !dettaglioCalcolo.errore) {
                        prezzoUnitario = dettaglioCalcolo.totale;
                        noteRiga = `${modello} ${fascia} ${dettaglioCalcolo.mqFatturati}mq @${dettaglioCalcolo.prezzoMq}€`;
                        console.log(`🦟 PALAGINA Pos ${index + 1}: ${modello} ${L_cm}×${H_cm}cm ${fascia} = €${prezzoUnitario}`);
                    } else {
                        noteRiga = dettaglioCalcolo?.errore || '⚠️ Errore calcolo';
                        console.warn(`⚠️ PALAGINA Pos ${index + 1}: ${dettaglioCalcolo?.errore}`);
                    }
                } else {
                    noteRiga = `⚠️ Modello ${modello} non in listino`;
                    console.warn(`⚠️ PALAGINA Pos ${index + 1}: Modello ${modello} non trovato`);
                }
                
                const totaleRiga = prezzoUnitario * quantita;
                
                righe.push({
                    posizione: index + 1,
                    ambiente: pos.ambiente || pos.nome || pos.stanza || `Pos ${index + 1}`,
                    tipo: 'Zanzariera',
                    azienda: zanz.azienda || 'Palagina',
                    telaio: modello || '-',
                    larghezza: L_mm,
                    altezza: H_mm,
                    superficie: dettaglioCalcolo?.mqFatturati || '-',
                    perimetro: fascia || '-',
                    prezzoBase: (dettaglioCalcolo?.prezzoBase || 0).toFixed(2),
                    supplementoTelaio: (dettaglioCalcolo?.suppRete || 0).toFixed(2),
                    supplementoAnta: (dettaglioCalcolo?.totAccessori || 0).toFixed(2),
                    supplementoVetro: '0.00',
                    supplementoManiglia: '0.00',
                    prezzoUnitario: prezzoUnitario.toFixed(2),
                    quantita: quantita,
                    totale: totaleRiga.toFixed(2),
                    note: noteRiga,
                    _dettaglioPalagina: dettaglioCalcolo  // Per popup dettaglio
                });
                
                totaleMateriali += totaleRiga;
                numeroPezzi += quantita;
                
                console.log(`✅ Zanzariera Pos ${index + 1}: ${L_mm}×${H_mm} ${modello} ${fascia} = €${totaleRiga.toFixed(2)}`);
            }
        }
        
        // ============================================================================
        // CASSONETTI - FINSTRAL/MAGÒ/ALPAC
        // ============================================================================
        if (pos.cassonetto && hasQta(pos.cassonetto)) {
            const cass = pos.cassonetto;
            const quantita = parseInt(cass.qta) || 1;
            
            // 🔧 v8.54: BRM centralizzato via getProductBRM
            const brmCass = getProductBRM(cass, pos);
            let L_mm = brmCass.L;
            let A_mm = brmCass.H;
            let B_mm = brmCass.B;
            let C_mm = brmCass.C;
            
            // Fallback speciale cassonetto: LS+SRSX+SRDX
            if (!L_mm && cass.LS) {
                L_mm = (parseInt(cass.LS) || 0) + (parseInt(cass.SRSX) || 0) + (parseInt(cass.SRDX) || 0);
            }
            
            const azienda = cass.azienda || 'Finstral';
            const materialeCass = cass.materialeCass || 'PVC';
            const codiceCass = cass.codiceCass || '';
            // ✅ v8.11: Determina gruppo colore dal codice colore effettivo, non da gruppoColoreCass
            const coloreCass = cass.coloreCass || '';
            const gruppoColoreCass = determinaGruppoColoreCassonetto(coloreCass);
            const codiceIsolamento = cass.isolamentoPosaclima ? (cass.codiceIsolamento || '') : '';
            
            if (L_mm > 0 && A_mm > 0 && azienda.toLowerCase() === 'finstral') {
                // 🆕 v7.996: Usa calcolaPrezzoCassonettoFinstral
                const calcolo = calcolaPrezzoCassonettoFinstral({
                    L: L_mm,
                    A: A_mm,
                    B: B_mm,
                    materialeCass: materialeCass,
                    codiceCass: codiceCass,
                    gruppoColoreCass: gruppoColoreCass,
                    codiceIsolamento: codiceIsolamento
                });
                
                if (calcolo.success) {
                    const prezzoUnitario = calcolo.prezzo;
                    const totaleRiga = prezzoUnitario * quantita;
                    
                    righe.push({
                        posizione: index + 1,
                        ambiente: pos.ambiente || pos.nome || `Pos ${index + 1}`,
                        tipo: 'Cassonetto',
                        azienda: azienda,
                        telaio: `${materialeCass} ${calcolo.parametri.codiceCass || codiceCass}`,
                        larghezza: L_mm,
                        altezza: A_mm,
                        B: B_mm,
                        superficie: '-',
                        perimetro: '-',
                        prezzoBase: calcolo.dettaglio.prezzoBase.toFixed(2),
                        supplementoTelaio: '0.00',
                        supplementoAnta: '0.00',
                        supplementoVetro: calcolo.dettaglio.supplementoIsolamento.toFixed(2),
                        supplementoManiglia: '0.00',
                        prezzoUnitario: prezzoUnitario.toFixed(2),
                        quantita: quantita,
                        totale: totaleRiga.toFixed(2),
                        materialeCass: materialeCass,
                        codiceCass: calcolo.parametri.codiceCass,
                        gruppoColoreCass: gruppoColoreCass,
                        codiceIsolamento: codiceIsolamento,
                        _tipoCassonetto: true
                    });
                    
                    totaleMateriali += totaleRiga;
                    numeroPezzi += quantita;
                    
                    console.log(`✅ Cassonetto Finstral Pos ${index + 1}: ${L_mm}×${A_mm}mm (B=${B_mm}) = €${prezzoUnitario.toFixed(2)} [${materialeCass} ${calcolo.parametri.codiceCass}]`);
                } else {
                    console.warn(`⚠️ Cassonetto Pos ${index + 1}: Calcolo fallito -`, calcolo.errori);
                    // Riga placeholder senza prezzo
                    righe.push({
                        posizione: index + 1,
                        ambiente: pos.ambiente || pos.nome || `Pos ${index + 1}`,
                        tipo: 'Cassonetto',
                        azienda: azienda,
                        telaio: `${materialeCass} ${codiceCass}`,
                        larghezza: L_mm,
                        altezza: A_mm,
                        superficie: '-',
                        perimetro: '-',
                        prezzoBase: '0.00',
                        supplementoTelaio: '0.00',
                        supplementoAnta: '0.00',
                        supplementoVetro: '0.00',
                        supplementoManiglia: '0.00',
                        prezzoUnitario: '0.00',
                        quantita: quantita,
                        totale: '0.00',
                        note: calcolo.errori.join(', '),
                        _tipoCassonetto: true
                    });
                }
            } else if (L_mm > 0 && A_mm > 0) {
                // Altre aziende (no calcolo automatico)
                righe.push({
                    posizione: index + 1,
                    ambiente: pos.ambiente || pos.nome || `Pos ${index + 1}`,
                    tipo: 'Cassonetto',
                    azienda: azienda,
                    telaio: '-',
                    larghezza: L_mm,
                    altezza: A_mm,
                    superficie: '-',
                    perimetro: '-',
                    prezzoBase: '0.00',
                    supplementoTelaio: '0.00',
                    supplementoAnta: '0.00',
                    supplementoVetro: '0.00',
                    supplementoManiglia: '0.00',
                    prezzoUnitario: '0.00',
                    quantita: quantita,
                    totale: '0.00',
                    note: `${azienda}: prezzo manuale`,
                    _tipoCassonetto: true
                });
                console.log(`📦 Cassonetto ${azienda} Pos ${index + 1}: ${L_mm}×${A_mm}mm - Prezzo manuale`);
            }
        }
        
        // ============================================================================
        // 🔒 v8.52: GRATE SICUREZZA - ERRECI
        // ============================================================================
        if (pos.grata && hasQta(pos.grata)) {
            const grata = pos.grata;
            const quantita = getQta(grata) || 1;
            
            // 🔧 v8.54: BRM centralizzato con fallback LF/HF
            const brmGrata = typeof getProductBRM !== 'undefined' 
                ? getProductBRM(grata, pos) 
                : { L: parseInt(grata.BRM_L) || 0, H: parseInt(grata.BRM_H) || 0 };
            const L_mm = brmGrata.L;
            const H_mm = brmGrata.H;
            if (brmGrata.stimato) console.log(`📐 Grata Pos ${index+1}: BRM stimato da ${brmGrata.origine} → ${L_mm}×${H_mm}`);
            
            let prezzoUnitario = 0;
            let noteRiga = '';
            let tipoDesc = `Grata ${grata.linea || ''} ${grata.tipoApertura || ''}`.trim();
            
            // Calcolo prezzo se GRATE_MODULE è disponibile
            let dettaglioGrata = null;
            if (typeof GRATE_MODULE !== 'undefined' && GRATE_MODULE.calcolaPrezzo) {
                // 🔧 v8.54: Passa BRM calcolato dentro l'oggetto grata per calcolaPrezzo
                const grataConBRM = Object.assign({}, grata, { BRM_L: L_mm, BRM_H: H_mm });
                const risultato = GRATE_MODULE.calcolaPrezzo(grataConBRM, pos);
                if (risultato && !risultato.errore) {
                    prezzoUnitario = risultato.prezzo || 0;
                    noteRiga = risultato.dettaglio || '';
                    dettaglioGrata = risultato;
                } else {
                    noteRiga = risultato?.errore || 'Errore calcolo';
                }
            } else {
                noteRiga = 'Modulo grate non caricato';
            }
            
            const totaleRiga = prezzoUnitario * quantita;
            if (prezzoUnitario > 0) {
                totaleMateriali += totaleRiga;
                numeroPezzi += quantita;
            }
            
            righe.push({
                posizione: index + 1,
                ambiente: pos.ambiente || pos.nome || `Pos ${index + 1}`,
                tipo: tipoDesc,
                azienda: grata.azienda || 'Erreci',
                telaio: grata.modello || '-',
                larghezza: L_mm,
                altezza: H_mm,
                superficie: '-',
                perimetro: '-',
                prezzoBase: prezzoUnitario.toFixed(2),
                supplementoTelaio: '0.00',
                supplementoAnta: '0.00',
                supplementoVetro: '0.00',
                supplementoManiglia: '0.00',
                prezzoUnitario: prezzoUnitario.toFixed(2),
                quantita: quantita,
                totale: totaleRiga.toFixed(2),
                note: noteRiga,
                _tipoGrata: true,
                _dettaglioGrata: dettaglioGrata
            });
            
            console.log(`🔒 Grata Pos ${index + 1}: ${L_mm}×${H_mm}mm = €${prezzoUnitario.toFixed(2)}`);
        }
        
        // ============================================================================
        // PORTE BLINDATE - OIKOS
        // ============================================================================
        // 🔐 v7.98: blindata esiste se ha LNP o versione (LNP può essere stringa)
        const hasBlindataData = pos.blindata && (
            parseInt(pos.blindata.LNP_L) > 0 || 
            parseInt(pos.blindata.LNP_H) > 0 || 
            pos.blindata.versione
        );
        
        if (hasBlindataData) {
            const bld = pos.blindata;
            const quantita = 1; // Porte blindate sempre qta 1
            
            // Leggi misure LNP (Luce Netta Passaggio) - possono essere stringhe
            const L_mm = parseInt(bld.LNP_L) || 0;
            const H_mm = parseInt(bld.LNP_H) || 0;
            
            console.log(`🔐 Blindata Pos ${index + 1}: LNP=${L_mm}×${H_mm}mm, versione=${bld.versione}`);
            
            if (L_mm > 0 && H_mm > 0) {
                // Calcola prezzo con funzione Oikos
                const prezzoCalcolato = calcolaPrezzoBlindataOikos(bld);
                const prezzoUnitario = prezzoCalcolato.totale || 0;
                const totaleRiga = prezzoUnitario * quantita;
                
                // Descrizione configurazione
                const configDesc = [
                    bld.versione || 'E3',
                    bld.tipoAnta === 'doppia' ? '2 Ante' : '1 Anta',
                    bld.sensoApertura || '',
                    bld.controtelaio === 'si' ? 'Con CT' : 'Senza CT'
                ].filter(x => x).join(' | ');
                
                righe.push({
                    posizione: index + 1,
                    ambiente: pos.ambiente || pos.nome || pos.stanza || `Pos ${index + 1}`,
                    tipo: `🔐 Blindata ${bld.versione || 'E3'}`,
                    azienda: bld.azienda || 'Oikos',
                    telaio: configDesc,
                    larghezza: L_mm,
                    altezza: H_mm,
                    superficie: ((L_mm * H_mm) / 1000000).toFixed(2),
                    perimetro: '-',
                    prezzoBase: (prezzoCalcolato.dettaglio?.prezzoBase || 0).toFixed(2),
                    supplementoTelaio: (prezzoCalcolato.dettaglio?.controtelaio || 0).toFixed(2),
                    supplementoAnta: (prezzoCalcolato.dettaglio?.cilindro || 0).toFixed(2),
                    supplementoVetro: (prezzoCalcolato.dettaglio?.rivestimenti || 0).toFixed(2),
                    supplementoColore: (prezzoCalcolato.dettaglio?.colore || 0).toFixed(2),
                    supplementoManiglia: (prezzoCalcolato.dettaglio?.optional || 0).toFixed(2),
                    supplementoMontante: (prezzoCalcolato.dettaglio?.kitAAV || 0).toFixed(2),
                    prezzoUnitario: prezzoUnitario.toFixed(2),
                    quantita: quantita,
                    totale: totaleRiga.toFixed(2),
                    _tipoBlindato: true,
                    _luceCalcolata: bld.luceCalcolata || 'luce0'
                });
                
                totaleMateriali += totaleRiga;
                numeroPezzi += quantita;
                
                console.log(`✅ Blindata Pos ${index + 1}: €${prezzoUnitario.toFixed(2)} (${bld.luceCalcolata})`);
            } else {
                console.warn(`⚠️ Pos ${index + 1}: Misure blindata non trovate`);
            }
        }
        
        // ============================================================================
        // 🚪 PORTONCINI FIN-DOOR FINSTRAL - v8.63
        // ============================================================================
        // v8.63: Fix normalizzazione - pos.portoncino può esistere vuoto (senza BRM)
        // Controlla se pos.portoncino ha dati reali, altrimenti copia da ingresso
        const ptcDirect = pos.portoncino;
        const ptcIngresso = pos.ingresso?.portoncino;
        const hasPtcDirectData = ptcDirect && (parseInt(ptcDirect.BRM_L) > 0 || parseInt(ptcDirect.BRM_H) > 0 || ptcDirect.tipoApertura);
        
        if (ptcIngresso && !hasPtcDirectData) {
            pos.portoncino = ptcIngresso;
            console.log(`   🚪 NORMALIZZATO pos ${index + 1}: ingresso.portoncino → portoncino (BRM=${ptcIngresso.BRM_L}×${ptcIngresso.BRM_H})`);
        }
        
        const hasPortoncinoData = pos.portoncino && (
            parseInt(pos.portoncino.BRM_L) > 0 || 
            parseInt(pos.portoncino.BRM_H) > 0 || 
            pos.portoncino.tipoApertura
        );
        
        if (hasPortoncinoData) {
            const ptc = pos.portoncino;
            const quantita = 1;
            
            const L_mm = parseInt(ptc.BRM_L) || 0;
            const H_mm = parseInt(ptc.BRM_H) || 0;
            
            console.log(`🚪 Portoncino Pos ${index + 1}: BRM=${L_mm}×${H_mm}mm, tipo=${ptc.tipoApertura}`);
            
            if (L_mm > 0 && H_mm > 0) {
                try {
                // v8.63: passa larghezza/altezza per compatibilità con findoor-portoncini.js v2.0.0
                ptc.larghezza = ptc.larghezza || ptc.BRM_L;
                ptc.altezza = ptc.altezza || ptc.BRM_H;
                
                const prezzoCalcolato = (typeof calcolaPrezzoPortoncinoFindoor === 'function') 
                    ? calcolaPrezzoPortoncinoFindoor(ptc) 
                    : _calcolaPortoncinoStub(ptc, L_mm, H_mm);
                const prezzoUnitario = prezzoCalcolato.totale || 0;
                const totaleRiga = prezzoUnitario * quantita;
                
                const configDesc = [
                    `Tipo ${ptc.tipoApertura || '720'}`,
                    ptc.materialeInt && ptc.materialeEst ? `${ptc.materialeInt}-${ptc.materialeEst}` : '',
                    ptc.modelloAnta ? `Mod.${ptc.modelloAnta}` : ''
                ].filter(x => x).join(' | ');
                
                righe.push({
                    posizione: index + 1,
                    ambiente: pos.ambiente || pos.nome || pos.stanza || `Pos ${index + 1}`,
                    tipo: `🚪 Portoncino ${ptc.tipoApertura || '720'}`,
                    azienda: 'Finstral',
                    telaio: configDesc,
                    larghezza: L_mm,
                    altezza: H_mm,
                    superficie: ((L_mm * H_mm) / 1000000).toFixed(2),
                    perimetro: '-',
                    prezzoBase: (prezzoCalcolato.prezzoBase || 0).toFixed(2),
                    supplementoTelaio: (prezzoCalcolato.supplModello || 0).toFixed(2),
                    supplementoAnta: (prezzoCalcolato.supplSerratura || 0).toFixed(2),
                    supplementoVetro: (prezzoCalcolato.supplCerniere || 0).toFixed(2),
                    supplementoColore: (prezzoCalcolato.supplCilindro || 0).toFixed(2),
                    supplementoManiglia: (prezzoCalcolato.supplManiglia || 0).toFixed(2),
                    supplementoMontante: ((prezzoCalcolato.prezzoLaterali || 0) + (prezzoCalcolato.prezzoSopraluce || 0)).toFixed(2),
                    prezzoUnitario: prezzoUnitario.toFixed(2),
                    quantita: quantita,
                    totale: totaleRiga.toFixed(2),
                    _tipoPortoncino: true,
                    _prezzoCalcolato: prezzoCalcolato
                });
                
                totaleMateriali += totaleRiga;
                numeroPezzi += quantita;
                
                console.log(`✅ Portoncino Pos ${index + 1}: €${prezzoUnitario.toFixed(2)}${prezzoCalcolato._stub ? ' (STUB)' : ''}`);
                } catch(e) {
                    console.error(`❌ Errore calcolo portoncino Pos ${index + 1}:`, e);
                }
            } else {
                console.warn(`⚠️ Pos ${index + 1}: Misure portoncino non trovate`);
            }
        }
        
        // ============================================================================
        // 🆕 v8.56: CLICK ZIP - GIBUS
        // ============================================================================
        if (pos.clickZip && pos.clickZip.serveClickZip !== false) {
            const cz = pos.clickZip;
            const quantita = parseInt(cz.qta) || 1;
            const prezzoUnitario = parseFloat(cz.prezzoListino) || 0;
            const totaleRiga = prezzoUnitario * quantita;
            if (prezzoUnitario > 0) { totaleMateriali += totaleRiga; numeroPezzi += quantita; }
            righe.push({
                posizione: index + 1,
                ambiente: pos.ambiente || pos.nome || `Pos ${index + 1}`,
                tipo: `🌀 Click Zip ${cz.modello || ''}`.trim(),
                azienda: 'Gibus',
                telaio: cz.tessuto || '-',
                larghezza: parseInt(cz.larghezza) || 0,
                altezza: parseInt(cz.altezza) || 0,
                superficie: '-', perimetro: '-',
                prezzoBase: prezzoUnitario.toFixed(2),
                supplementoTelaio: '0.00', supplementoAnta: '0.00', supplementoVetro: '0.00', supplementoManiglia: '0.00',
                prezzoUnitario: prezzoUnitario.toFixed(2),
                quantita: quantita,
                totale: totaleRiga.toFixed(2),
                note: cz.note || ''
            });
        }
        
        // ============================================================================
        // 🆕 v8.56: TENDE A BRACCI - GIBUS
        // ============================================================================
        if (pos.tendaBracci?.tende?.length > 0) {
            pos.tendaBracci.tende.forEach((t, ti) => {
                const prezzoUnitario = parseFloat(t.prezzoListino) || 0;
                if (prezzoUnitario > 0) { totaleMateriali += prezzoUnitario; numeroPezzi += 1; }
                righe.push({
                    posizione: index + 1,
                    ambiente: pos.ambiente || pos.nome || `Pos ${index + 1}`,
                    tipo: `🎪 Tenda Bracci ${t.modello || ''}`.trim(),
                    azienda: 'Gibus',
                    telaio: t.tessuto || '-',
                    larghezza: parseInt(t.larghezza) || 0,
                    altezza: parseInt(t.sporgenza) || 0,
                    superficie: '-', perimetro: '-',
                    prezzoBase: prezzoUnitario.toFixed(2),
                    supplementoTelaio: '0.00', supplementoAnta: '0.00', supplementoVetro: '0.00', supplementoManiglia: '0.00',
                    prezzoUnitario: prezzoUnitario.toFixed(2),
                    quantita: 1,
                    totale: prezzoUnitario.toFixed(2),
                    note: ''
                });
            });
        }
        
        // ============================================================================
        // 🆕 v8.56: PORTE INTERNE - FERREROLEGNO/FLESSYA
        // ============================================================================
        if (pos.portaInterna && (getQta(pos.portaInterna) > 0 || pos.portaInterna.modello)) {
            const pi = pos.portaInterna;
            const quantita = getQta(pi) || 1;
            const prezzoUnitario = parseFloat(pi.prezzoListino) || parseFloat(pi.prezzo) || 0;
            const totaleRiga = prezzoUnitario * quantita;
            if (prezzoUnitario > 0) { totaleMateriali += totaleRiga; numeroPezzi += quantita; }
            righe.push({
                posizione: index + 1,
                ambiente: pos.ambiente || pos.nome || `Pos ${index + 1}`,
                tipo: `🚪 Porta Interna ${pi.modello || ''}`.trim(),
                azienda: pi.azienda || 'FerreroLegno',
                telaio: pi.finitura || '-',
                larghezza: parseInt(pi.larghezza) || 0,
                altezza: parseInt(pi.altezza) || 0,
                superficie: '-', perimetro: '-',
                prezzoBase: prezzoUnitario.toFixed(2),
                supplementoTelaio: '0.00', supplementoAnta: '0.00', supplementoVetro: '0.00', supplementoManiglia: '0.00',
                prezzoUnitario: prezzoUnitario.toFixed(2),
                quantita: quantita,
                totale: totaleRiga.toFixed(2),
                note: pi.note || ''
            });
        }
    });
    console.log('🔍 Dettaglio righe create:');
    righe.forEach((r, i) => {
        console.log(`   Riga ${i + 1}: ${r.tipo} - ${r.azienda} - ${r.ambiente} - €${r.totale}`);
    });
    
    // 💰 v8.14: Calcolo sconti fornitori per ogni riga
    const ricaricoPct = parseFloat(document.getElementById('ricaricoPct')?.value || 30);
    let totaleNetto = 0;
    let totaleCliente = 0;
    
    righe.forEach(riga => {
        const totaleListino = parseFloat(riga.totale) || 0;
        const sconto = SCONTI_FORNITORI.getSconto(riga.azienda);
        const netto = totaleListino * (1 - sconto / 100);
        const cliente = netto * (1 + ricaricoPct / 100);
        
        riga._scontoPerc = sconto.toFixed(0);
        riga._totaleNetto = netto.toFixed(2);
        riga._totaleCliente = cliente.toFixed(2);
        
        totaleNetto += netto;
        totaleCliente += cliente;
        
        console.log(`💰 ${riga.azienda}: €${totaleListino} -${sconto}% = €${netto.toFixed(2)} +${ricaricoPct}% = €${cliente.toFixed(2)}`);
    });
    
    // Calcola posa e smontaggio
    const posa = numeroPezzi * COSTI_EXTRA.posa_per_pezzo;
    const smontaggio = numeroPezzi * COSTI_EXTRA.smontaggio_per_pezzo;
    
    // Posa e smontaggio: applica ricarico
    const posaNetto = posa;  // Nessuno sconto sulla posa
    const posaCliente = posa * (1 + ricaricoPct / 100);
    const smontaggioNetto = smontaggio;
    const smontaggioCliente = smontaggio * (1 + ricaricoPct / 100);
    
    const subtotale = totaleMateriali + posa + smontaggio;
    
    // IVA (calcolata dopo in ricalcolaTotaliPreventivo)
    const ivaPercent = 0; // v8.16: IVA gestita separatamente in base a tipo intervento
    const iva = subtotale * (ivaPercent / 100);
    const totale = subtotale + iva;
    
    console.log(`💰 TOTALI: Listino €${totaleMateriali.toFixed(2)} | Netto €${totaleNetto.toFixed(2)} | Cliente €${totaleCliente.toFixed(2)} | Ricarico ${ricaricoPct}%`);
    
    return {
        righe: righe,
        totaleMateriali: totaleMateriali,
        _totaleNetto: totaleNetto,
        _totaleCliente: totaleCliente,
        _ricaricoPct: ricaricoPct,
        posa: posa,
        _posaNetto: posaNetto,
        _posaCliente: posaCliente,
        smontaggio: smontaggio,
        _smontaggioNetto: smontaggioNetto,
        _smontaggioCliente: smontaggioCliente,
        subtotale: subtotale,
        ivaPercent: ivaPercent,
        iva: iva,
        totale: totale
    };
}

function popolaTabellaPreventivo(preventivo) {
    console.log('📋 popolaTabellaPreventivo() chiamata');
    console.log('📋 Righe ricevute:', preventivo.righe.length);
    console.log('📋 Dettaglio righe:', preventivo.righe.map(r => `${r.tipo}-${r.azienda}`).join(', '));
    
    const tbody = document.getElementById('preventivoTableBody');
    if (!tbody) {
        console.error('❌ Tabella preventivo non trovata');
        return;
    }
    
    tbody.innerHTML = '';
    
    // 🆕 v7.82: Salva righe per click handler
    // 🐛 v8.21 FIX: Esplicito window. per visibilità globale
    window.righePreventivo = preventivo.righe;
    
    console.log('📋 tbody.innerHTML cleared');
    
    // Popola righe
    preventivo.righe.forEach((riga, index) => {
        const tr = document.createElement('tr');
        
        // 🆕 v7.996: TUTTI i tipi sono cliccabili per dettaglio (incluso cassonetto)
        // 🔌 v8.09: Aggiunto Motore
        // ✅ v8.468c: Aggiunto Scorrevole
        const isTapparella = riga.tipo.toLowerCase().includes('tapparella');
        const isPersiana = riga.tipo.toLowerCase().includes('persiana');
        const isCassonetto = riga.tipo.toLowerCase().includes('cassonetto');
        const isMotore = riga.tipo.toLowerCase().includes('motore') || riga._tipoMotore;
        const isZanzariera = riga.tipo.toLowerCase().includes('zanzariera');
        const isInfisso = riga.tipo.toLowerCase().includes('infisso') || 
                          riga.tipo.toLowerCase().includes('finestra') ||
                          riga.tipo.toLowerCase().includes('scorrevole') ||
                          riga.tipo.toLowerCase().includes('hst') ||  // 🆕 v8.475: FIN-Slide HST
                          riga.isFinSlide ||  // 🆕 v8.475: Flag FIN-Slide
                          riga.tipo.toLowerCase().includes('porta');
        const isBlindato = riga.tipo.toLowerCase().includes('blindata') || riga._tipoBlindato;
        const isPortoncino = riga.tipo.toLowerCase().includes('portoncino') || riga._tipoPortoncino;
        const isGrata = riga._tipoGrata || riga.tipo.toLowerCase().includes('grata');
        const isClickable = isTapparella || isPersiana || isCassonetto || isInfisso || isBlindato || isPortoncino || isMotore || isGrata || isZanzariera;
        
        if (isClickable) {
            tr.style.cursor = 'pointer';
            tr.title = '🔍 Clicca per vedere il dettaglio costi';
            const hoverColor = isTapparella ? '#fef3c7' : isPersiana ? '#f3e8ff' : isCassonetto ? '#ffedd5' : isBlindato ? '#fee2e2' : isPortoncino ? '#fce7f3' : isMotore ? '#fed7aa' : isGrata ? '#fef2f2' : isZanzariera ? '#ccfbf1' : '#dbeafe';
            tr.onmouseover = function() { this.style.background = hoverColor; };
            tr.onmouseout = function() { this.style.background = ''; };
            
            // 🆕 v7.82 FIX: Usa window. e salva posizione in variabile locale
            const posIdx = riga.posizione;
            const rigaCopia = Object.assign({}, riga); // Copia per closure
            tr.onclick = function() {
                if (isMotore) {
                    console.log('🖱️ Click su motore pos', posIdx);
                    window.mostraDettaglioCostiMotore(posIdx, rigaCopia);
                } else if (isPortoncino) {
                    console.log('🖱️ Click su portoncino pos', posIdx);
                    window.mostraDettaglioCostiPortoncino(posIdx, rigaCopia);
                } else if (isBlindato) {
                    console.log('🖱️ Click su blindata pos', posIdx);
                    window.mostraDettaglioCostiBlindato(posIdx, rigaCopia);
                } else if (isCassonetto) {
                    console.log('🖱️ Click su cassonetto pos', posIdx);
                    window.mostraDettaglioCostiCassonetto(posIdx, rigaCopia);
                } else if (isTapparella) {
                    console.log('🖱️ Click su tapparella pos', posIdx);
                    window.mostraDettaglioCostiTapparella(posIdx, rigaCopia);
                } else if (isPersiana) {
                    console.log('🖱️ Click su persiana pos', posIdx);
                    window.mostraDettaglioCostiPersiana(posIdx, rigaCopia);
                } else if (isInfisso) {
                    console.log('🖱️ Click su infisso pos', posIdx);
                    window.mostraDettaglioCostiInfisso(posIdx, rigaCopia);
                } else if (isGrata) {
                    console.log('🖱️ Click su grata pos', posIdx);
                    window.mostraDettaglioCostiGrata(posIdx, rigaCopia);
                } else if (isZanzariera) {
                    console.log('🖱️ Click su zanzariera pos', posIdx);
                    if (typeof window.mostraDettaglioCostiZanzariera === 'function') {
                        window.mostraDettaglioCostiZanzariera(posIdx, rigaCopia);
                    } else {
                        console.log('ℹ️ Dettaglio zanzariera non ancora implementato');
                    }
                }
            };
        }
        
        tr.innerHTML = `
            <td>${riga.posizione}</td>
            <td style="text-align: left;">${riga.ambiente}</td>
            <td>${riga.tipo}${isClickable ? ' <span style="font-size: 0.7rem; color: #3b82f6;">🔍</span>' : ''}${riga.validazione ? ` <span title="${riga.validazione.stato === 'completo' ? 'Dati completi' : (riga.validazione.errori?.map(e=>e.messaggio).join(', ') || riga.validazione.warning?.map(w=>w.messaggio).join(', ') || '')}" style="cursor: help;">${riga.validazione.icona}</span>` : ''}</td>
            <td>${riga.azienda}</td>
            <td>${riga.telaio}</td>
            <td${riga.brmStimato ? ' style="background: #fef3c7; color: #92400e;" title="⚠️ BRM stimato da ' + riga.brmOrigine + '"' : ''}>${riga.larghezza}${riga.brmStimato ? ' ⚠️' : ''}</td>
            <td${riga.brmStimato ? ' style="background: #fef3c7; color: #92400e;" title="⚠️ BRM stimato da ' + riga.brmOrigine + '"' : ''}>${riga.altezza}${riga.brmStimato ? ' ⚠️' : ''}</td>
            <td>${riga.superficie}</td>
            <td>${riga.perimetro}</td>
            <td>€ ${riga.prezzoBase}</td>
            <td>€ ${riga.supplementoTelaio}</td>
            <td>€ ${riga.supplementoAnta}</td>
            <td>€ ${riga.supplementoVetro}</td>
            <td>€ ${riga.supplementoColore || '0.00'}</td>
            <td>€ ${riga.supplementoManiglia}</td>
            <td>€ ${riga.supplementoMontante || '0.00'}</td>
            <td>${riga.quantita}</td>
            <td style="background: #fef3c7;">€ ${riga.totale}</td>
            <td style="background: #d1fae5; color: #059669; font-size: 0.7rem;">${riga._scontoPerc || 0}%</td>
            <td style="background: #d1fae5; font-weight: 600; color: #059669;">€ ${riga._totaleNetto || riga.totale}</td>
            <td style="background: #dbeafe; font-weight: 700; color: #1d4ed8;">€ ${riga._totaleCliente || riga.totale}</td>
        `;
        tbody.appendChild(tr);
        console.log(`📋 Riga aggiunta: ${riga.posizione} - ${riga.tipo} - ${riga.azienda}${isClickable ? ' (cliccabile)' : ''}`);
    });
    
    // Aggiorna totali - v8.14 con sconti
    const totListino = preventivo.totaleMateriali;
    const totNetto = preventivo._totaleNetto || totListino;
    const totCliente = preventivo._totaleCliente || totListino;
    const margine = totCliente - totNetto;
    
    // Salva totali materiali in variabili globali per ricalcolo
    window._preventivoMateriali = {
        listino: totListino,
        netto: totNetto,
        cliente: totCliente,
        ricaricoPct: preventivo._ricaricoPct || 30,
        ivaPercent: preventivo.ivaPercent
    };
    
    // Popola totali materiali
    document.getElementById('totaleListino').textContent = `€ ${totListino.toFixed(2)}`;
    document.getElementById('totaleNetto').textContent = `€ ${totNetto.toFixed(2)}`;
    document.getElementById('totaleCliente').textContent = `€ ${totCliente.toFixed(2)}`;
    
    // 🔧 v8.15: Calcola costi lavoro suggeriti da righe preventivo
    const costiSuggeriti = COSTI_LAVORO.calcolaTotaliDaRighe(preventivo.righe);
    
    // Mostra suggerimenti
    document.getElementById('posaSuggerito').textContent = `sugg. €${costiSuggeriti.posa}`;
    document.getElementById('smontaggioSuggerito').textContent = `sugg. €${costiSuggeriti.smontaggio}`;
    document.getElementById('smaltimentoSuggerito').textContent = `sugg. €${costiSuggeriti.smaltimento}`;
    document.getElementById('componentiSuggerito').textContent = `sugg. €${costiSuggeriti.componenti}`;
    
    // Imposta input ai valori suggeriti (l'utente può modificare)
    document.getElementById('inputPosa').value = costiSuggeriti.posa;
    document.getElementById('inputSmontaggio').value = costiSuggeriti.smontaggio;
    document.getElementById('inputSmaltimento').value = costiSuggeriti.smaltimento;
    document.getElementById('inputComponenti').value = costiSuggeriti.componenti;
    
    // Salva anche i suggeriti per riferimento
    window._costiLavoroSuggeriti = costiSuggeriti;
    
    // v8.491: Ripristina voci extra salvate in currentData (se esistono)
    const vociSalvate = window.currentData?.vociExtra;
    if (vociSalvate) {
        console.log('📝 Ripristino voci extra salvate:', vociSalvate);
        
        // ENEA
        if (vociSalvate.enea) {
            const checkENEA = document.getElementById('checkENEA');
            const inputENEA = document.getElementById('inputENEA');
            if (checkENEA) checkENEA.checked = vociSalvate.enea.checked || false;
            if (inputENEA) {
                inputENEA.value = vociSalvate.enea.valore || 250;
                inputENEA.disabled = !vociSalvate.enea.checked;
            }
        }
        
        // Voce Extra 1 (campi sempre abilitati)
        if (vociSalvate.voce1) {
            const check1 = document.getElementById('checkVoceExtra1');
            const nome1 = document.getElementById('inputNomeVoceExtra1');
            const val1 = document.getElementById('inputVoceExtra1');
            const iva1 = document.getElementById('selectIVAVoceExtra1');
            if (check1) check1.checked = vociSalvate.voce1.checked || false;
            if (nome1) nome1.value = vociSalvate.voce1.nome || '';
            if (val1) val1.value = vociSalvate.voce1.valore || 0;
            if (iva1) iva1.value = vociSalvate.voce1.iva || 22;
        }
        
        // Voce Extra 2 (campi sempre abilitati)
        if (vociSalvate.voce2) {
            const check2 = document.getElementById('checkVoceExtra2');
            const nome2 = document.getElementById('inputNomeVoceExtra2');
            const val2 = document.getElementById('inputVoceExtra2');
            const iva2 = document.getElementById('selectIVAVoceExtra2');
            if (check2) check2.checked = vociSalvate.voce2.checked || false;
            if (nome2) nome2.value = vociSalvate.voce2.nome || '';
            if (val2) val2.value = vociSalvate.voce2.valore || 0;
            if (iva2) iva2.value = vociSalvate.voce2.iva || 22;
        }
    }
    
    // v8.492: Ripristina configPreventivo salvata (se esiste)
    // ✅ v8.493: Solo al PRIMO caricamento, non durante i ricalcoli manuali
    const configSalvata = window.currentData?.configPreventivo;
    if (configSalvata && !window._configPreventivoCarcato) {
        console.log('📝 Ripristino configPreventivo salvata:', configSalvata);
        window._configPreventivoCarcato = true; // Flag per evitare ripristini successivi
        
        // Tipo intervento e ricarico
        if (configSalvata.tipoIntervento) {
            const selTipo = document.getElementById('tipoInterventoSelect');
            if (selTipo) selTipo.value = configSalvata.tipoIntervento;
        }
        if (configSalvata.ricaricoPct !== undefined) {
            const inputRic = document.getElementById('ricaricoPct');
            if (inputRic) inputRic.value = configSalvata.ricaricoPct;
        }
        
        // Costi lavoro (sovrascrive suggeriti se presenti valori salvati)
        if (configSalvata.posa !== undefined) {
            document.getElementById('inputPosa').value = configSalvata.posa;
        }
        if (configSalvata.smontaggio !== undefined) {
            document.getElementById('inputSmontaggio').value = configSalvata.smontaggio;
        }
        if (configSalvata.smaltimento !== undefined) {
            document.getElementById('inputSmaltimento').value = configSalvata.smaltimento;
        }
        if (configSalvata.componenti !== undefined) {
            document.getElementById('inputComponenti').value = configSalvata.componenti;
        }
        
        // Servizi
        if (configSalvata.servizi) {
            const checkServ = document.getElementById('checkServizi');
            const inputServ = document.getElementById('inputServizi');
            if (checkServ) checkServ.checked = configSalvata.servizi.checked || false;
            if (inputServ) {
                inputServ.value = configSalvata.servizi.valore || 0;
                inputServ.disabled = !configSalvata.servizi.checked;
            }
        }
        
        // ✅ v8.493: Dati cliente letti da clientData (non più da configPreventivo.cliente)
        // Mantiene retrocompatibilità con vecchio formato
        const clientData = window.currentData?.clientData || configSalvata.cliente || {};
        if (clientData.nome) document.getElementById('clienteNome').value = clientData.nome;
        if (clientData.indirizzo) document.getElementById('clienteIndirizzo').value = clientData.indirizzo;
        if (clientData.telefono) document.getElementById('clienteTelefono').value = clientData.telefono;
        if (clientData.email) document.getElementById('clienteEmail').value = clientData.email;
        if (clientData.cf) document.getElementById('clienteCF').value = clientData.cf;
    }
    
    // Ricalcola totali con valori suggeriti
    ricalcolaTotaliPreventivo();
    
    console.log(`✅ Tabella preventivo popolata: ${preventivo.righe.length} righe`);
    console.log(`💰 Listino: €${totListino.toFixed(2)} | Netto: €${totNetto.toFixed(2)} | Cliente: €${totCliente.toFixed(2)}`);
    console.log(`🔧 Costi lavoro suggeriti: Posa €${costiSuggeriti.posa} | Smontaggio €${costiSuggeriti.smontaggio} | Smaltimento €${costiSuggeriti.smaltimento} | Componenti €${costiSuggeriti.componenti}`);
}

/**
 * 💰 v8.15: Ricalcola totali quando cambiano posa/smontaggio/smaltimento/componenti/ricarico
 */

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 MODULO IVA MISTA - BENI SIGNIFICATIVI (Art. 7 L. 488/1999) - v8.16
// ═══════════════════════════════════════════════════════════════════════════════
// Riferimenti normativi:
// - Art. 7, comma 1, lettera b) Legge 488/1999
// - D.M. 29 dicembre 1999 (elenco beni significativi)
// - Circolare Agenzia Entrate n. 15/E del 12/07/2018
// ═══════════════════════════════════════════════════════════════════════════════

const CLASSIFICAZIONE_FISCALE = {
    // ═══════════════════════════════════════════════════════════════
    // v8.486 FIX: BENI SIGNIFICATIVI secondo D.M. 29/12/1999
    // Art. 7, comma 1, lett. b) L. 488/1999 + Circolare AdE 15/E 2018
    // 
    // ELENCO TASSATIVO D.M. 29/12/1999:
    // "Infissi esterni e interni" = SOLO finestre, porte, portoncini
    // Persiane, scuri, tapparelle = ACCESSORI (non in elenco!)
    // ═══════════════════════════════════════════════════════════════
    beniSignificativi: [
        // Infissi esterni (D.M. 29/12/1999)
        'Infisso', 'Finestra', 'Portafinestra', 'Scorrevole',
        // Porte esterne e interne (D.M. 29/12/1999)
        'Porta', 'Portoncino', 'Blindata', 'Interna'
    ],
    // Parti che seguono il bene principale SE fornite insieme
    partiIntegrabili: ['Zanzariera'],
    // ACCESSORI e parti autonome → sempre IVA 10% in manutenzione
    partiAutonome: [
        // Oscuranti (NON sono beni significativi!)
        'Persiana', 'Scuro', 'Tapparella', 'Veneziana',
        // Altri accessori
        'Cassonetto', 'Grata', 'Inferriata', 'Motore', 'Accessorio', 'Componente'
    ],
    // Configurazione: zanzariere integrate con infisso
    zanzariereIntegrate: true
};

/**
 * Classifica un prodotto in base al tipo dalla riga preventivo
 */
function classificaProdottoFiscale(tipoRiga, fornitaConInfisso = true) {
    if (!tipoRiga) return 'parte_autonoma';
    const tipoUpper = tipoRiga.toUpperCase();
    
    // Controlla se è un bene significativo
    for (const bs of CLASSIFICAZIONE_FISCALE.beniSignificativi) {
        if (tipoUpper.includes(bs.toUpperCase())) {
            return 'bene_significativo';
        }
    }
    
    // Controlla zanzariere (caso speciale)
    if (tipoUpper.includes('ZANZARIERA')) {
        if (CLASSIFICAZIONE_FISCALE.zanzariereIntegrate && fornitaConInfisso) {
            return 'bene_significativo';
        }
        return 'parte_autonoma';
    }
    
    // Controlla parti autonome
    for (const pa of CLASSIFICAZIONE_FISCALE.partiAutonome) {
        if (tipoUpper.includes(pa.toUpperCase())) {
            return 'parte_autonoma';
        }
    }
    
    return 'parte_autonoma';
}

/**
 * Calcola la ripartizione IVA mista secondo normativa beni significativi
 * v8.488: CORREZIONE FORMULA secondo Circolare AdE 15/E del 18/07/2018
 * 
 * La circolare 15/E chiarisce che il VALORE FISCALE del bene significativo
 * NON è il prezzo di vendita, ma il COSTO DI ACQUISTO.
 * Il MARK-UP (margine commerciale) è considerato "servizio di vendita"
 * e quindi contribuisce al VALORE DELLA PRESTAZIONE.
 * 
 * Formula corretta:
 * - valoreFiscaleBeniSignif = costo acquisto (netto)
 * - valorePrestazione = partiAutonome + manodopera + markupBeniSignificativi
 * - Se valoreFiscale <= valorePrestazione → TUTTO al 10%
 * - Altrimenti → eccedenza al 22%
 */
function calcolaIVAMista(righe, lavori, ricaricoPct = 30, enea = 0, vociExtra10 = 0) {
    // Totali per PREZZO DI VENDITA (quello che va in fattura)
    let totaleBeniSignificativi = 0;      // Prezzo vendita BS
    let totalePartiAutonome = 0;          // Prezzo vendita PA
    
    // v8.488: Totali per COSTO ACQUISTO e MARK-UP (per calcolo fiscale)
    let costoAcquistoBeniSignif = 0;      // Costo acquisto BS
    let markupBeniSignif = 0;             // Mark-up sui BS
    
    let dettaglioBeniSignif = [];
    let dettaglioPartiAutonome = [];
    
    console.log('📊 calcolaIVAMista v8.491 (Circ. 15/E 2018) - Righe:', righe.length, '| Voci22:', enea, '| VociExtra10:', vociExtra10);
    
    righe.forEach(riga => {
        const prezzoVendita = parseFloat(riga._totaleCliente) || 0;
        const costoAcquisto = parseFloat(riga._totaleNetto) || prezzoVendita;  // Fallback se manca
        const markup = prezzoVendita - costoAcquisto;
        const classificazione = classificaProdottoFiscale(riga.tipo, true);
        
        console.log(`   - ${riga.tipo}: Netto €${costoAcquisto.toFixed(2)} → Cliente €${prezzoVendita.toFixed(2)} (mark-up €${markup.toFixed(2)}) [${classificazione}]`);
        
        if (classificazione === 'bene_significativo') {
            totaleBeniSignificativi += prezzoVendita;
            costoAcquistoBeniSignif += costoAcquisto;
            markupBeniSignif += markup;
            dettaglioBeniSignif.push({ 
                tipo: riga.tipo, 
                posizione: riga.posizione, 
                totale: prezzoVendita,
                costoAcquisto: costoAcquisto,
                markup: markup
            });
        } else {
            totalePartiAutonome += prezzoVendita;
            dettaglioPartiAutonome.push({ tipo: riga.tipo, posizione: riga.posizione, totale: prezzoVendita });
        }
    });
    
    // Calcola totale manodopera (già prezzi cliente passati)
    const totaleManodopera = (parseFloat(lavori.posa) || 0) +
                            (parseFloat(lavori.smontaggio) || 0) +
                            (parseFloat(lavori.smaltimento) || 0) +
                            (parseFloat(lavori.componenti) || 0);
    
    // v8.488: FORMULA CIRCOLARE 15/E 2018
    // Il MARK-UP sui beni significativi è considerato "servizio di vendita"
    // e va sommato al valore della prestazione
    const valorePrestazione = totalePartiAutonome + totaleManodopera + markupBeniSignif;
    
    // Il VALORE FISCALE dei beni significativi è il COSTO DI ACQUISTO
    const valoreFiscaleBeniSignif = costoAcquistoBeniSignif;
    
    const totaleIntervento = totaleBeniSignificativi + totalePartiAutonome + totaleManodopera + enea + vociExtra10;
    
    console.log(`📊 Circ.15/E: Costo Acquisto BS €${costoAcquistoBeniSignif.toFixed(2)} | Mark-up BS €${markupBeniSignif.toFixed(2)}`);
    console.log(`📊 Circ.15/E: Valore Fiscale BS €${valoreFiscaleBeniSignif.toFixed(2)} | Valore Prestazione €${valorePrestazione.toFixed(2)}`);
    
    // Applica formula normativa (Circ. 15/E 2018)
    // Se il valore fiscale (costo acquisto) <= valore prestazione → tutto al 10%
    let beniSignif10 = 0;
    let beniSignif22 = 0;
    
    if (valoreFiscaleBeniSignif <= valorePrestazione) {
        // TUTTO il prezzo di vendita va al 10%
        beniSignif10 = totaleBeniSignificativi;
        beniSignif22 = 0;
        console.log(`✅ Circ.15/E: €${valoreFiscaleBeniSignif.toFixed(2)} ≤ €${valorePrestazione.toFixed(2)} → TUTTO AL 10%`);
    } else {
        // Calcola proporzione: quanto del PREZZO DI VENDITA va al 22%
        // L'eccedenza fiscale va calcolata e poi riportata in proporzione sul prezzo vendita
        const eccedenzaFiscale = valoreFiscaleBeniSignif - valorePrestazione;
        const proporzioneEccedenza = eccedenzaFiscale / valoreFiscaleBeniSignif;
        beniSignif22 = totaleBeniSignificativi * proporzioneEccedenza;
        beniSignif10 = totaleBeniSignificativi - beniSignif22;
        console.log(`⚠️ Circ.15/E: Eccedenza fiscale €${eccedenzaFiscale.toFixed(2)} (${(proporzioneEccedenza*100).toFixed(1)}%) → Quota22 €${beniSignif22.toFixed(2)}`);
    }
    
    // v8.491: Calcola imponibili e IVA (ENEA/Servizi/VociExtra22 al 22%, VociExtra10 al 10%)
    const imponibile10 = beniSignif10 + totalePartiAutonome + totaleManodopera + vociExtra10;
    const imponibile22 = beniSignif22 + enea;
    
    const iva10 = imponibile10 * 0.10;
    const iva22 = imponibile22 * 0.22;
    const ivaTotale = iva10 + iva22;
    const totaleConIVA = totaleIntervento + ivaTotale;
    
    console.log(`📊 Risultato: Imponibile10 €${imponibile10.toFixed(2)} | Imponibile22 €${imponibile22.toFixed(2)} | IVA Totale €${ivaTotale.toFixed(2)}`);
    
    return {
        beniSignificativi: { 
            totale: totaleBeniSignificativi, 
            quota10: beniSignif10, 
            quota22: beniSignif22, 
            costoAcquisto: costoAcquistoBeniSignif,
            markup: markupBeniSignif,
            dettaglio: dettaglioBeniSignif 
        },
        partiAutonome: { totale: totalePartiAutonome, dettaglio: dettaglioPartiAutonome },
        manodopera: { totale: totaleManodopera, dettaglio: lavori },
        enea: enea,
        vociExtra10: vociExtra10,  // v8.491
        totaleIntervento, 
        valorePrestazione,
        valoreFiscaleBeniSignif,
        imponibile10, imponibile22,
        iva10, iva22, ivaTotale, totaleConIVA,
        haIVAMista: imponibile22 > 0
    };
}

/**
 * Verifica tipo IVA per intervento
 */
function getTipoIVAIntervento(tipoIntervento) {
    switch (tipoIntervento) {
        case 'manutenzione':
            return { applicaIVAMista: true, aliquotaUnica: null, note: 'IVA mista con beni significativi' };
        case 'ristrutturazione':
            return { applicaIVAMista: false, aliquotaUnica: 10, note: 'Ristrutturazione - IVA 10%' };
        case 'nuova_costruzione_prima':
            return { applicaIVAMista: false, aliquotaUnica: 4, note: 'Prima casa - IVA 4%' };
        case 'nuova_costruzione_altra':
            return { applicaIVAMista: false, aliquotaUnica: 10, note: 'Altra abitazione - IVA 10%' };
        case 'sola_fornitura':
            return { applicaIVAMista: false, aliquotaUnica: 22, note: 'Sola fornitura - IVA 22%' };
        default:
            return { applicaIVAMista: false, aliquotaUnica: 0, note: 'Nessuna IVA' };
    }
}

console.log('📊 Modulo IVA Mista caricato - v8.17');

// ═══════════════════════════════════════════════════════════════════════════════
// FINE MODULO IVA MISTA
// ═══════════════════════════════════════════════════════════════════════════════

function ricalcolaTotaliPreventivo() {
    const mat = window._preventivoMateriali;
    if (!mat) return;
    
    const ricaricoPct = parseFloat(document.getElementById('ricaricoPct')?.value || 30);
    const tipoIntervento = document.getElementById('tipoInterventoSelect')?.value || 'nessuna';
    
    // Tutti i costi lavoro dagli input
    const posa = parseFloat(document.getElementById('inputPosa')?.value || 0);
    const smontaggio = parseFloat(document.getElementById('inputSmontaggio')?.value || 0);
    const smaltimento = parseFloat(document.getElementById('inputSmaltimento')?.value || 0);
    const componenti = parseFloat(document.getElementById('inputComponenti')?.value || 0);
    
    // ENEA Ecobonus (v8.40)
    const eneaChecked = document.getElementById('checkENEA')?.checked || false;
    const eneaValore = eneaChecked ? parseFloat(document.getElementById('inputENEA')?.value || 0) : 0;
    
    // Servizi/Oneri aggiuntivi v8.485
    const serviziChecked = document.getElementById('checkServizi')?.checked || false;
    const serviziValore = serviziChecked ? parseFloat(document.getElementById('inputServizi')?.value || 0) : 0;
    
    // Voci Extra v8.491
    const voceExtra1Checked = document.getElementById('checkVoceExtra1')?.checked || false;
    const voceExtra1Valore = parseFloat(document.getElementById('inputVoceExtra1')?.value || 0);
    const voceExtra1Nome = document.getElementById('inputNomeVoceExtra1')?.value || '';
    const voceExtra1IVA = parseInt(document.getElementById('selectIVAVoceExtra1')?.value || 22);
    const voceExtra1Incluso = voceExtra1Checked ? voceExtra1Valore : 0;
    
    const voceExtra2Checked = document.getElementById('checkVoceExtra2')?.checked || false;
    const voceExtra2Valore = parseFloat(document.getElementById('inputVoceExtra2')?.value || 0);
    const voceExtra2Nome = document.getElementById('inputNomeVoceExtra2')?.value || '';
    const voceExtra2IVA = parseInt(document.getElementById('selectIVAVoceExtra2')?.value || 22);
    const voceExtra2Incluso = voceExtra2Checked ? voceExtra2Valore : 0;
    
    // Totale voci extra incluse nel conteggio
    const totaleVociExtraIncluse = voceExtra1Incluso + voceExtra2Incluso;
    
    // Totale voci al 22% fisso (ENEA + Servizi) - v8.491: + voci extra con IVA 22%
    const vociExtra22 = (voceExtra1Checked && voceExtra1IVA === 22 ? voceExtra1Valore : 0) + 
                        (voceExtra2Checked && voceExtra2IVA === 22 ? voceExtra2Valore : 0);
    const vociExtra10 = (voceExtra1Checked && voceExtra1IVA === 10 ? voceExtra1Valore : 0) + 
                        (voceExtra2Checked && voceExtra2IVA === 10 ? voceExtra2Valore : 0);
    const totaleVoci22 = eneaValore + serviziValore + vociExtra22;
    
    // Costi lavoro: netto = cliente = SENZA ricarico (v8.40)
    const posaNetto = posa;
    const posaCliente = posa;
    const smontaggioNetto = smontaggio;
    const smontaggioCliente = smontaggio;
    const smaltimentoNetto = smaltimento;
    const smaltimentoCliente = smaltimento;
    const componentiNetto = componenti;
    const componentiCliente = componenti;
    
    // Totale lavori
    const lavoriListino = posa + smontaggio + smaltimento + componenti;
    const lavoriNetto = posaNetto + smontaggioNetto + smaltimentoNetto + componentiNetto;
    const lavoriCliente = posaCliente + smontaggioCliente + smaltimentoCliente + componentiCliente;
    
    // Subtotali (incluso ENEA, Servizi e Voci Extra) - v8.491
    const subtotaleListino = mat.listino + lavoriListino + totaleVoci22 + vociExtra10;
    const subtotaleNetto = mat.netto + lavoriNetto + totaleVoci22 + vociExtra10;
    const subtotaleCliente = mat.cliente + lavoriCliente + totaleVoci22 + vociExtra10;
    
    // Margine
    const margineTotale = subtotaleCliente - subtotaleNetto;
    
    // Aggiorna DOM - Posa
    document.getElementById('totalePosaListino').textContent = `€ ${posa.toFixed(2)}`;
    document.getElementById('totalePosaNetto').textContent = `€ ${posaNetto.toFixed(2)}`;
    document.getElementById('totalePosaCliente').textContent = `€ ${posaCliente.toFixed(2)}`;
    
    // Smontaggio
    document.getElementById('totaleSmontaggioListino').textContent = `€ ${smontaggio.toFixed(2)}`;
    document.getElementById('totaleSmontaggioNetto').textContent = `€ ${smontaggioNetto.toFixed(2)}`;
    document.getElementById('totaleSmontaggioCliente').textContent = `€ ${smontaggioCliente.toFixed(2)}`;
    
    // Smaltimento
    document.getElementById('totaleSmaltimentoListino').textContent = `€ ${smaltimento.toFixed(2)}`;
    document.getElementById('totaleSmaltimentoNetto').textContent = `€ ${smaltimentoNetto.toFixed(2)}`;
    document.getElementById('totaleSmaltimentoCliente').textContent = `€ ${smaltimentoCliente.toFixed(2)}`;
    
    // Componenti
    document.getElementById('totaleComponentiListino').textContent = `€ ${componenti.toFixed(2)}`;
    document.getElementById('totaleComponentiNetto').textContent = `€ ${componentiNetto.toFixed(2)}`;
    document.getElementById('totaleComponentiCliente').textContent = `€ ${componentiCliente.toFixed(2)}`;
    
    // ENEA (v8.40)
    document.getElementById('totaleENEAListino').textContent = `€ ${eneaValore.toFixed(2)}`;
    document.getElementById('totaleENEANetto').textContent = `€ ${eneaValore.toFixed(2)}`;
    document.getElementById('totaleENEACliente').textContent = `€ ${eneaValore.toFixed(2)}`;
    const inputENEA = document.getElementById('inputENEA');
    if (inputENEA) inputENEA.disabled = !eneaChecked;
    
    // Servizi/Oneri v8.485
    document.getElementById('totaleServiziListino').textContent = `€ ${serviziValore.toFixed(2)}`;
    document.getElementById('totaleServiziNetto').textContent = `€ ${serviziValore.toFixed(2)}`;
    document.getElementById('totaleServiziCliente').textContent = `€ ${serviziValore.toFixed(2)}`;
    const inputServizi = document.getElementById('inputServizi');
    if (inputServizi) inputServizi.disabled = !serviziChecked;
    
    // Voci Extra v8.491 - campi sempre abilitati (come ENEA)
    document.getElementById('totaleVoceExtra1Listino').textContent = `€ ${voceExtra1Incluso.toFixed(2)}`;
    document.getElementById('totaleVoceExtra1Netto').textContent = `€ ${voceExtra1Incluso.toFixed(2)}`;
    document.getElementById('totaleVoceExtra1Cliente').textContent = `€ ${voceExtra1Incluso.toFixed(2)}`;
    
    document.getElementById('totaleVoceExtra2Listino').textContent = `€ ${voceExtra2Incluso.toFixed(2)}`;
    document.getElementById('totaleVoceExtra2Netto').textContent = `€ ${voceExtra2Incluso.toFixed(2)}`;
    document.getElementById('totaleVoceExtra2Cliente').textContent = `€ ${voceExtra2Incluso.toFixed(2)}`;
    
    // Salva dati voci extra per PDF v8.491 (salva sempre i valori, anche se non checked)
    window._vociExtra = {
        enea: { valore: parseFloat(document.getElementById('inputENEA')?.value || 0), checked: eneaChecked },
        voce1: { nome: voceExtra1Nome, valore: voceExtra1Valore, iva: voceExtra1IVA, checked: voceExtra1Checked },
        voce2: { nome: voceExtra2Nome, valore: voceExtra2Valore, iva: voceExtra2IVA, checked: voceExtra2Checked }
    };
    
    // v8.491: Salva anche in currentData per persistenza tra aggiornamenti preventivo
    if (window.currentData) {
        window.currentData.vociExtra = window._vociExtra;
        console.log('💾 Voci extra salvate in currentData:', window._vociExtra);
    }
    
    // Totale lavori
    document.getElementById('totaleLavoriListino').textContent = `€ ${lavoriListino.toFixed(2)}`;
    document.getElementById('totaleLavoriNetto').textContent = `€ ${lavoriNetto.toFixed(2)}`;
    document.getElementById('totaleLavoriCliente').textContent = `€ ${lavoriCliente.toFixed(2)}`;
    
    // Subtotali
    document.getElementById('subtotaleListino').textContent = `€ ${subtotaleListino.toFixed(2)}`;
    document.getElementById('subtotaleNetto').textContent = `€ ${subtotaleNetto.toFixed(2)}`;
    document.getElementById('subtotaleCliente').textContent = `€ ${subtotaleCliente.toFixed(2)}`;
    
    // Margine
    document.getElementById('totaleMargineLordo').textContent = `€ ${margineTotale.toFixed(2)}`;
    
    // ═══════════════════════════════════════════════════════════════════
    // 🆕 v8.16: GESTIONE IVA PER TIPO INTERVENTO
    // ═══════════════════════════════════════════════════════════════════
    
    // Nascondi tutte le righe IVA
    const righeIVA = [
        'rowSeparatoreFiscale', 'rowBeniSignif10', 'rowBeniSignif22',
        'rowPartiAutonome', 'rowManodoperaFiscale', 
        'rowENEAFiscale', 'rowServiziProfFiscale',  // v8.487: aggiunte righe ENEA e Servizi
        'rowSepImponibili',
        'rowImponibile10', 'rowImponibile22', 'rowIVA10', 'rowIVA22', 'rowIVA'
    ];
    righeIVA.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    
    // Aggiorna label tipo IVA
    const labelTipoIVA = document.getElementById('labelTipoIVA');
    
    // Determina tipo IVA da applicare
    const configIVA = getTipoIVAIntervento(tipoIntervento);
    
    let grandTotalCliente = subtotaleCliente;
    let grandTotalListino = subtotaleListino;
    let grandTotalNetto = subtotaleNetto;
    
    if (tipoIntervento === 'nessuna') {
        // Nessuna IVA
        if (labelTipoIVA) labelTipoIVA.textContent = '(senza IVA)';
        
    } else if (configIVA.applicaIVAMista) {
        // ═══════════════════════════════════════════════════════════════
        // IVA MISTA - BENI SIGNIFICATIVI
        // ═══════════════════════════════════════════════════════════════
        if (labelTipoIVA) labelTipoIVA.textContent = '📊 Beni signif.';
        
        // Usa le righe del preventivo salvate
        const righe = window.righePreventivo || [];
        
        // Calcola IVA mista (v8.491: ENEA + Servizi + VociExtra22 al 22%, VociExtra10 al 10%)
        const calcolo = calcolaIVAMista(righe, {
            posa: posaCliente,
            smontaggio: smontaggioCliente,
            smaltimento: smaltimentoCliente,
            componenti: componentiCliente
        }, ricaricoPct, totaleVoci22, vociExtra10);
        
        // Mostra righe riepilogo fiscale
        document.getElementById('rowSeparatoreFiscale').style.display = 'table-row';
        document.getElementById('rowBeniSignif10').style.display = 'table-row';
        document.getElementById('rowPartiAutonome').style.display = 'table-row';
        document.getElementById('rowManodoperaFiscale').style.display = 'table-row';
        
        // v8.487: Mostra righe ENEA e Servizi se presenti (sempre al 22%)
        if (eneaValore > 0) {
            document.getElementById('rowENEAFiscale').style.display = 'table-row';
            document.getElementById('valENEAFiscale').textContent = `€ ${eneaValore.toFixed(2)}`;
        }
        if (serviziValore > 0) {
            document.getElementById('rowServiziProfFiscale').style.display = 'table-row';
            document.getElementById('valServiziProfFiscale').textContent = `€ ${serviziValore.toFixed(2)}`;
        }
        
        document.getElementById('rowSepImponibili').style.display = 'table-row';
        document.getElementById('rowImponibile10').style.display = 'table-row';
        document.getElementById('rowIVA10').style.display = 'table-row';
        
        // Popola valori
        document.getElementById('valBeniSignif10').textContent = `€ ${calcolo.beniSignificativi.quota10.toFixed(2)}`;
        document.getElementById('valPartiAutonome').textContent = `€ ${calcolo.partiAutonome.totale.toFixed(2)}`;
        document.getElementById('valManodoperaFiscale').textContent = `€ ${calcolo.manodopera.totale.toFixed(2)}`;
        document.getElementById('valImponibile10').textContent = `€ ${calcolo.imponibile10.toFixed(2)}`;
        document.getElementById('valIVA10').textContent = `€ ${calcolo.iva10.toFixed(2)}`;
        
        // v8.487: Mostra righe 22% se ci sono beni signif quota22 OPPURE ENEA/Servizi
        const haImponibile22 = calcolo.beniSignificativi.quota22 > 0 || totaleVoci22 > 0;
        if (haImponibile22) {
            if (calcolo.beniSignificativi.quota22 > 0) {
                document.getElementById('rowBeniSignif22').style.display = 'table-row';
                document.getElementById('valBeniSignif22').textContent = `€ ${calcolo.beniSignificativi.quota22.toFixed(2)}`;
            }
            document.getElementById('rowImponibile22').style.display = 'table-row';
            document.getElementById('rowIVA22').style.display = 'table-row';
            
            document.getElementById('valImponibile22').textContent = `€ ${calcolo.imponibile22.toFixed(2)}`;
            document.getElementById('valIVA22').textContent = `€ ${calcolo.iva22.toFixed(2)}`;
        } else {
            // v8.491: Azzera i valori IVA 22% quando non ci sono voci
            document.getElementById('valImponibile22').textContent = '';
            document.getElementById('valIVA22').textContent = '';
            document.getElementById('valBeniSignif22').textContent = '';
        }
        
        grandTotalCliente = calcolo.totaleConIVA;
        
        // Salva calcolo per export
        window._calcoloIVAMista = calcolo;
        
        console.log('📊 IVA Mista calcolata:', calcolo);
        
    } else if (configIVA.aliquotaUnica > 0) {
        // ═══════════════════════════════════════════════════════════════
        // IVA ALIQUOTA UNICA (4%, 10%, 22%) - v8.40: ENEA sempre al 22%
        // ═══════════════════════════════════════════════════════════════
        const aliquota = configIVA.aliquotaUnica;
        if (labelTipoIVA) labelTipoIVA.textContent = `IVA ${aliquota}%`;
        
        // Mostra riga IVA singola
        const rowIVA = document.getElementById('rowIVA');
        if (rowIVA) rowIVA.style.display = 'table-row';
        document.getElementById('ivaPercent').textContent = aliquota;
        
        // v8.485: ENEA + Servizi sempre al 22%, resto all'aliquota selezionata
        const baseCliente = subtotaleCliente - totaleVoci22;
        const baseListino = subtotaleListino - totaleVoci22;
        const baseNetto = subtotaleNetto - totaleVoci22;
        
        const ivaBaseCliente = baseCliente * aliquota / 100;
        const ivaVoci22 = totaleVoci22 * 0.22;
        const ivaCliente = ivaBaseCliente + ivaVoci22;
        
        const ivaListino = baseListino * aliquota / 100 + ivaVoci22;
        const ivaNetto = baseNetto * aliquota / 100 + ivaVoci22;
        
        document.getElementById('totaleIVAListino').textContent = `€ ${ivaListino.toFixed(2)}`;
        document.getElementById('totaleIVANetto').textContent = `€ ${ivaNetto.toFixed(2)}`;
        document.getElementById('totaleIVACliente').textContent = `€ ${ivaCliente.toFixed(2)}`;
        
        grandTotalCliente = subtotaleCliente + ivaCliente;
        grandTotalListino = subtotaleListino + ivaListino;
        grandTotalNetto = subtotaleNetto + ivaNetto;
    }
    
    // Aggiorna totali finali
    document.getElementById('grandTotalListino').textContent = `€ ${grandTotalListino.toFixed(2)}`;
    document.getElementById('grandTotalNetto').textContent = `€ ${grandTotalNetto.toFixed(2)}`;
    document.getElementById('grandTotalCliente').textContent = `€ ${grandTotalCliente.toFixed(2)}`;
    
    // v8.492: Salva configPreventivo in currentData per persistenza
    salvaConfigPreventivo();
    
    console.log(`💰 Ricalcolo v8.492: Tipo=${tipoIntervento} | Subtot €${subtotaleCliente.toFixed(2)} | ENEA €${eneaValore.toFixed(2)} | Servizi €${serviziValore.toFixed(2)} | Extra1 €${voceExtra1Incluso.toFixed(2)} | Extra2 €${voceExtra2Incluso.toFixed(2)} | Tot €${grandTotalCliente.toFixed(2)}`);
}

/**
 * 💾 v8.492: Salva configurazione preventivo in currentData per persistenza nel JSON
 */
function salvaConfigPreventivo() {
    if (!window.currentData) return;
    
    const configPreventivo = {
        // Configurazione IVA
        tipoIntervento: document.getElementById('tipoInterventoSelect')?.value || 'nessuna',
        ricaricoPct: parseFloat(document.getElementById('ricaricoPct')?.value || 30),
        
        // Costi lavoro
        posa: parseFloat(document.getElementById('inputPosa')?.value || 0),
        smontaggio: parseFloat(document.getElementById('inputSmontaggio')?.value || 0),
        smaltimento: parseFloat(document.getElementById('inputSmaltimento')?.value || 0),
        componenti: parseFloat(document.getElementById('inputComponenti')?.value || 0),
        
        // Servizi
        servizi: {
            checked: document.getElementById('checkServizi')?.checked || false,
            valore: parseFloat(document.getElementById('inputServizi')?.value || 0)
        }
        // ✅ v8.493: Dati cliente salvati in clientData, non qui
    };
    
    window.currentData.configPreventivo = configPreventivo;
    
    // ✅ v8.493: Salva dati cliente nella struttura clientData esistente
    if (!window.currentData.clientData) {
        window.currentData.clientData = {};
    }
    
    // Aggiorna clientData con i valori inseriti nel preventivo
    const clienteNome = document.getElementById('clienteNome')?.value || '';
    const clienteIndirizzo = document.getElementById('clienteIndirizzo')?.value || '';
    const clienteTelefono = document.getElementById('clienteTelefono')?.value || '';
    const clienteEmail = document.getElementById('clienteEmail')?.value || '';
    const clienteCF = document.getElementById('clienteCF')?.value || '';
    
    // Salva solo se non vuoto (non sovrascrivere con valori vuoti)
    if (clienteNome) window.currentData.clientData.nome = clienteNome;
    if (clienteIndirizzo) window.currentData.clientData.indirizzo = clienteIndirizzo;
    if (clienteTelefono) window.currentData.clientData.telefono = clienteTelefono;
    if (clienteEmail) window.currentData.clientData.email = clienteEmail;
    if (clienteCF) window.currentData.clientData.cf = clienteCF;
    
    // 🆕 v8.510: Nuovi campi ENEA
    const clienteComune = document.getElementById('clienteComune')?.value || '';
    const clienteProvincia = document.getElementById('clienteProvincia')?.value || '';
    const clienteCAP = document.getElementById('clienteCAP')?.value || '';
    const clienteZonaClimatica = document.getElementById('clienteZonaClimatica')?.value || '';
    const clienteDetrazione = document.getElementById('clienteDetrazione')?.value || '';
    
    if (clienteComune) window.currentData.clientData.comune = clienteComune;
    if (clienteProvincia) window.currentData.clientData.provincia = clienteProvincia;
    if (clienteCAP) window.currentData.clientData.cap = clienteCAP;
    
    // Salva anche in immobile per struttura JSON v6
    if (!window.currentData.immobile) window.currentData.immobile = {};
    if (clienteZonaClimatica) window.currentData.immobile.zonaClimatica = clienteZonaClimatica;
    if (clienteDetrazione) window.currentData.immobile.tipoDetrazione = clienteDetrazione;
    if (clienteComune) window.currentData.immobile.comune = clienteComune;
    if (clienteProvincia) window.currentData.immobile.provincia = clienteProvincia;
    if (clienteCAP) window.currentData.immobile.cap = clienteCAP;
    
    // Aggiorna anche appState.rilievoData per export JSON
    if (appState.rilievoData) {
        appState.rilievoData.configPreventivo = configPreventivo;
        appState.rilievoData.clientData = window.currentData.clientData;
        appState.rilievoData.immobile = window.currentData.immobile;
    }
}

// ═══════════════════════════════════════════════════════════════════
// 🆕 v7.82 DETTAGLIO COSTI - BREAKDOWN SINGOLA RIGA
// ═══════════════════════════════════════════════════════════════════

/**
 * 🆕 v7.82: Estrae codice da stringa tipo "TA01 - Tipo ALUPROFIL MD 13x55" → "TA01"
 */
function estraiCodiceProdotto(stringa) {
    if (!stringa) return null;
    // Prende la parte prima del " - " o prima dello spazio se non c'è " - "
    const parti = String(stringa).split(' - ');
    return parti[0].trim();
}

/**
 * Mostra dettaglio costi per TAPPARELLA
 * @param {number} posIndex - Indice posizione (1-based)
 * @param {object} rigaPreventivo - Dati riga dal preventivo (opzionale)
 */
/**
 * 🆕 v7.89: Mostra dettaglio costi tapparella
 * USA SOLO I DATI GIÀ CALCOLATI NEL PREVENTIVO - NON RICALCOLA!
 * @param {number} posIndex - Indice posizione (1-based)
 * @param {object} rigaPreventivo - Dati riga dal preventivo
 */
function mostraDettaglioCostiTapparella(posIndex, rigaPreventivo = {}) {
    try {
        console.log(`📊 v7.89 Dettaglio Tapparella Pos ${posIndex} - DATI DA PREVENTIVO:`, rigaPreventivo);
        
        // 🆕 v7.89: USA DIRETTAMENTE I DATI DEL PREVENTIVO!
        // Non ricalcoliamo nulla, trascriviamo solo quello che c'è già
        const L_mm = rigaPreventivo.larghezza || 0;
        const H_mm = rigaPreventivo.altezza || 0;
        const superficie = rigaPreventivo.superficie || '0.00';
        const modelloTelo = rigaPreventivo.telaio || 'N/D';
        const azienda = rigaPreventivo.azienda || 'Plasticino';
        const ambiente = rigaPreventivo.ambiente || `Pos ${posIndex}`;
        
        // Prezzi dal preventivo (già calcolati)
        const prezzoTelo = parseFloat(rigaPreventivo.prezzoBase) || 0;
        const prezzoRullo = parseFloat(rigaPreventivo.supplementoTelaio) || 0;
        const prezzoFissi = parseFloat(rigaPreventivo.supplementoAnta) || 0;
        const prezzoSuppAltezza = parseFloat(rigaPreventivo.supplementoVetro) || 0;
        const prezzoGuida = parseFloat(rigaPreventivo.supplementoManiglia) || 0;
        const totale = parseFloat(rigaPreventivo.totale) || 0;
        const quantita = parseInt(rigaPreventivo.quantita) || 1;
        const prezzoUnitario = parseFloat(rigaPreventivo.prezzoUnitario) || totale;
        
        // Calcola prezzo al mq per visualizzazione
        const superficieMq = parseFloat(superficie) || 1;
        const prezzoMq = superficieMq > 0 ? (prezzoTelo / superficieMq) : 60;
        
        let dettaglioHTML = `
        <div style="padding: 1.5rem;">
            <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 1rem 1.5rem; border-radius: 0.5rem; margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h3 style="margin: 0; font-size: 1.25rem;">🎚️ Tapparella - Posizione ${posIndex}</h3>
                        <p style="margin: 0.25rem 0 0 0; opacity: 0.9;">${ambiente}</p>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 1.5rem; font-weight: 700;">€ ${totale.toFixed(2)}</div>
                        <div style="font-size: 0.875rem; opacity: 0.9;">Totale${quantita > 1 ? ` (${quantita} pz)` : ''}</div>
                    </div>
                </div>
            </div>
            
            <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 0.5rem; padding: 1rem; margin-bottom: 1rem;">
                <h4 style="margin: 0 0 0.75rem 0; color: #0369a1;">📐 Misure</h4>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; text-align: center;">
                    <div>
                        <div style="font-size: 0.75rem; color: #6b7280;">Larghezza</div>
                        <div style="font-size: 1.25rem; font-weight: 600;">${L_mm} mm</div>
                    </div>
                    <div>
                        <div style="font-size: 0.75rem; color: #6b7280;">Altezza</div>
                        <div style="font-size: 1.25rem; font-weight: 600;">${H_mm} mm</div>
                    </div>
                    <div>
                        <div style="font-size: 0.75rem; color: #6b7280;">Superficie</div>
                        <div style="font-size: 1.25rem; font-weight: 600;">${superficie} m²</div>
                    </div>
                </div>
            </div>
            
            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 0.5rem; overflow: hidden; margin-bottom: 1rem;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                    <thead>
                        <tr style="background: #f3f4f6;">
                            <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid #e5e7eb;">Componente</th>
                            <th style="padding: 0.75rem; text-align: center; border-bottom: 2px solid #e5e7eb;">Dettaglio</th>
                            <th style="padding: 0.75rem; text-align: right; border-bottom: 2px solid #e5e7eb;">Importo</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style="background: #fefce8;">
                            <td style="padding: 0.75rem; border-bottom: 1px solid #e5e7eb;">
                                <strong>🎨 Telo Avvolgibile</strong><br>
                                <span style="font-size: 0.8rem; color: #6b7280;">${modelloTelo}</span>
                            </td>
                            <td style="padding: 0.75rem; text-align: center; border-bottom: 1px solid #e5e7eb; font-family: monospace;">
                                ${superficie} m² × €${prezzoMq.toFixed(2)}/m²
                            </td>
                            <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #ca8a04;">
                                € ${prezzoTelo.toFixed(2)}
                            </td>
                        </tr>
                        
                        <tr>
                            <td style="padding: 0.75rem; border-bottom: 1px solid #e5e7eb;">
                                <strong>🔄 Rullo Ottagonale 60mm</strong><br>
                                <span style="font-size: 0.8rem; color: #6b7280;">COMP-01</span>
                            </td>
                            <td style="padding: 0.75rem; text-align: center; border-bottom: 1px solid #e5e7eb; font-family: monospace;">
                                ${(L_mm / 1000).toFixed(2)} m × €13.20/m
                            </td>
                            <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #2563eb;">
                                € ${prezzoRullo.toFixed(2)}
                            </td>
                        </tr>
                        
                        <tr style="background: #f9fafb;">
                            <td style="padding: 0.75rem; border-bottom: 1px solid #e5e7eb;">
                                <strong>🔧 Componenti Fissi</strong><br>
                                <span style="font-size: 0.8rem; color: #6b7280;">COMP-02 a COMP-10</span>
                            </td>
                            <td style="padding: 0.75rem; text-align: center; border-bottom: 1px solid #e5e7eb;">
                                <details style="cursor: pointer;">
                                    <summary style="font-size: 0.8rem; color: #6b7280;">Vedi dettaglio ▼</summary>
                                    <div style="text-align: left; margin-top: 0.5rem; font-size: 0.75rem; line-height: 1.4;">
                                        Calotta: €15.00<br>
                                        Avvolgitore: €10.00<br>
                                        Cuscinetto: €3.50<br>
                                        Supporti x2: €6.00<br>
                                        Ganci x2: €7.20<br>
                                        Placca: €5.00<br>
                                        Passacinghia: €1.70<br>
                                        Macchinetta: €18.00
                                    </div>
                                </details>
                            </td>
                            <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #059669;">
                                € ${prezzoFissi.toFixed(2)}
                            </td>
                        </tr>
                        
                        ${prezzoSuppAltezza > 0 ? `
                        <tr>
                            <td style="padding: 0.75rem; border-bottom: 1px solid #e5e7eb;">
                                <strong>📏 Supplemento Altezza</strong><br>
                                <span style="font-size: 0.8rem; color: #6b7280;">H > 300cm</span>
                            </td>
                            <td style="padding: 0.75rem; text-align: center; border-bottom: 1px solid #e5e7eb;">
                                -
                            </td>
                            <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #dc2626;">
                                € ${prezzoSuppAltezza.toFixed(2)}
                            </td>
                        </tr>
                        ` : ''}
                        
                        ${prezzoGuida > 0 ? `
                        <tr style="background: #fef3c7;">
                            <td style="padding: 0.75rem; border-bottom: 1px solid #e5e7eb;">
                                <strong>📏 Guida</strong>
                            </td>
                            <td style="padding: 0.75rem; text-align: center; border-bottom: 1px solid #e5e7eb;">
                                Coppia (CP)
                            </td>
                            <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #d97706;">
                                € ${prezzoGuida.toFixed(2)}
                            </td>
                        </tr>
                        ` : ''}
                        
                        <tr style="background: #dcfce7;">
                            <td colspan="2" style="padding: 1rem; text-align: right; font-weight: 700; font-size: 1.1rem;">
                                TOTALE TAPPARELLA
                            </td>
                            <td style="padding: 1rem; text-align: right; font-weight: 700; font-size: 1.25rem; color: #059669;">
                                € ${totale.toFixed(2)}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; font-size: 0.85rem;">
                <div style="background: #f9fafb; padding: 0.75rem; border-radius: 0.375rem;">
                    <strong>🏭 Azienda:</strong> ${azienda}
                </div>
                <div style="background: #f9fafb; padding: 0.75rem; border-radius: 0.375rem;">
                    <strong>🎨 Modello:</strong> ${modelloTelo}
                </div>
            </div>
        </div>
    `;
    
    // Mostra modal
    mostraModalDettaglioCosti('Tapparella', dettaglioHTML);
    } catch (e) {
        console.error('❌ Errore in mostraDettaglioCostiTapparella:', e);
        alert('Errore dettaglio costi: ' + e.message);
    }
}

/**
 * 🆕 v7.89: Mostra dettaglio costi INFISSO
 * USA SOLO I DATI GIÀ CALCOLATI NEL PREVENTIVO - NON RICALCOLA!
 */
function mostraDettaglioCostiInfisso(posIndex, rigaPreventivo = {}) {
    try {
        console.log(`📊 v7.89 Dettaglio Infisso Pos ${posIndex} - DATI DA PREVENTIVO:`, rigaPreventivo);
        
        // Dati dal preventivo
        const L_mm = rigaPreventivo.larghezza || 0;
        const H_mm = rigaPreventivo.altezza || 0;
        const superficie = rigaPreventivo.superficie || '0.00';
        const perimetro = rigaPreventivo.perimetro || '-';
        const telaio = rigaPreventivo.telaio || 'N/D';
        const tipoAnta = rigaPreventivo.tipoAnta || '';  // ✅ v8.10: Tipo anta separato
        const azienda = rigaPreventivo.azienda || 'N/D';
        const ambiente = rigaPreventivo.ambiente || `Pos ${posIndex}`;
        const tipo = rigaPreventivo.tipo || 'Infisso';
        const tipoFinstral = rigaPreventivo.tipoFinstral || '';  // ✅ v8.467
        const isScorrevole = rigaPreventivo.isScorrevole || false;  // ✅ v8.467
        const icona = isScorrevole ? '🚪' : '🪟';  // ✅ v8.467
        
        // Prezzi dal preventivo
        const prezzoBase = parseFloat(rigaPreventivo.prezzoBase) || 0;
        const suppTelaio = parseFloat(rigaPreventivo.supplementoTelaio) || 0;
        const suppAnta = parseFloat(rigaPreventivo.supplementoAnta) || 0;
        const suppFisso = parseFloat(rigaPreventivo.supplementoFisso) || 0;  // 🆕 v8.476
        const numFissi = parseInt(rigaPreventivo.numFissi) || 0;  // 🆕 v8.476
        const suppVetro = parseFloat(rigaPreventivo.supplementoVetro) || 0;
        const vetroHST = rigaPreventivo.vetroHST || '';  // 🆕 v8.480
        const suppColore = parseFloat(rigaPreventivo.supplementoColore) || 0;
        const suppManiglia = parseFloat(rigaPreventivo.supplementoManiglia) || 0;
        const manigliaHST = rigaPreventivo.manigliaHST || '';  // 🆕 v8.479
        const isFinSlide = rigaPreventivo.isFinSlide || false;  // 🆕 v8.479
        const suppMontante = parseFloat(rigaPreventivo.supplementoMontante) || 0;
        const suppSoglia = parseFloat(rigaPreventivo.supplementoSoglia) || 0;  // ✅ v8.10
        const suppManigliettaPF = parseFloat(rigaPreventivo.supplementoManigliettaPF) || 0;  // ✅ v8.10
        const prezzoUnitario = parseFloat(rigaPreventivo.prezzoUnitario) || 0;
        const quantita = parseInt(rigaPreventivo.quantita) || 1;
        const totale = parseFloat(rigaPreventivo.totale) || 0;
        
        let dettaglioHTML = `
        <div style="padding: 1.5rem;">
            <div style="background: linear-gradient(135deg, ${isScorrevole ? '#1e40af' : '#065f46'} 0%, ${isScorrevole ? '#3b82f6' : '#10b981'} 100%); color: white; padding: 1rem 1.5rem; border-radius: 0.5rem; margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h3 style="margin: 0; font-size: 1.25rem;">${icona} ${tipo} - Posizione ${posIndex}</h3>
                        <p style="margin: 0.25rem 0 0 0; opacity: 0.9;">${ambiente}${tipoFinstral ? ` • Tipo ${tipoFinstral}` : ''}</p>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 1.5rem; font-weight: 700;">€ ${totale.toFixed(2)}</div>
                        <div style="font-size: 0.875rem; opacity: 0.9;">Totale${quantita > 1 ? ` (${quantita} pz)` : ''}</div>
                    </div>
                </div>
            </div>
            
            <div style="background: #ecfdf5; border: 1px solid #6ee7b7; border-radius: 0.5rem; padding: 1rem; margin-bottom: 1rem;">
                <h4 style="margin: 0 0 0.75rem 0; color: #065f46;">📐 Misure</h4>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; text-align: center;">
                    <div>
                        <div style="font-size: 0.75rem; color: #6b7280;">Larghezza</div>
                        <div style="font-size: 1.25rem; font-weight: 600;">${L_mm} mm</div>
                    </div>
                    <div>
                        <div style="font-size: 0.75rem; color: #6b7280;">Altezza</div>
                        <div style="font-size: 1.25rem; font-weight: 600;">${H_mm} mm</div>
                    </div>
                    <div>
                        <div style="font-size: 0.75rem; color: #6b7280;">Superficie</div>
                        <div style="font-size: 1.25rem; font-weight: 600;">${superficie} m²</div>
                    </div>
                    <div>
                        <div style="font-size: 0.75rem; color: #6b7280;">Perimetro</div>
                        <div style="font-size: 1.25rem; font-weight: 600;">${perimetro} ml</div>
                    </div>
                </div>
            </div>
            
            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 0.5rem; overflow: hidden; margin-bottom: 1rem;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                    <thead>
                        <tr style="background: #f3f4f6;">
                            <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid #e5e7eb;">Componente</th>
                            <th style="padding: 0.75rem; text-align: right; border-bottom: 2px solid #e5e7eb;">Importo</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style="background: #ecfdf5;">
                            <td style="padding: 0.75rem; border-bottom: 1px solid #e5e7eb;">
                                <strong>📦 Prezzo Base Infisso</strong><br>
                                <span style="font-size: 0.8rem; color: #6b7280;">Da listino ${azienda}</span>
                            </td>
                            <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #065f46;">
                                € ${prezzoBase.toFixed(2)}
                            </td>
                        </tr>
                        
                        ${suppTelaio > 0 ? `
                        <tr>
                            <td style="padding: 0.75rem; border-bottom: 1px solid #e5e7eb;">
                                <strong>🔲 Supplemento Telaio</strong><br>
                                <span style="font-size: 0.8rem; color: #6b7280;">${telaio}${telaio && azienda?.toLowerCase() === 'finstral' ? 'N' : ''} - Forma ad L</span>
                            </td>
                            <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #2563eb;">
                                € ${suppTelaio.toFixed(2)}
                            </td>
                        </tr>
                        ` : ''}
                        
                        ${suppAnta > 0 ? `
                        <tr style="background: #f9fafb;">
                            <td style="padding: 0.75rem; border-bottom: 1px solid #e5e7eb;">
                                <strong>🚪 Supplemento Anta</strong><br>
                                <span style="font-size: 0.8rem; color: #6b7280;">${tipoAnta || 'Profilo battente'}</span>
                            </td>
                            <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #7c3aed;">
                                € ${suppAnta.toFixed(2)}
                            </td>
                        </tr>
                        ` : ''}
                        
                        ${suppFisso > 0 ? `
                        <tr style="background: #eff6ff;">
                            <td style="padding: 0.75rem; border-bottom: 1px solid #e5e7eb;">
                                <strong>🔲 Elemento Fisso</strong><br>
                                <span style="font-size: 0.8rem; color: #6b7280;">${numFissi} campo/i fisso/i</span>
                            </td>
                            <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #1d4ed8;">
                                € ${suppFisso.toFixed(2)}
                            </td>
                        </tr>
                        ` : ''}
                        
                        ${suppVetro > 0 ? `
                        <tr>
                            <td style="padding: 0.75rem; border-bottom: 1px solid #e5e7eb;">
                                <strong>🔷 ${isFinSlide ? 'Vetri HST' : 'Supplemento Vetro'}</strong>
                                ${isFinSlide && vetroHST ? `<br><span style="font-size: 0.8rem; color: #6b7280;">${vetroHST === 'Max-Valor3_46' ? 'Max-Valor 3 triplo 46mm' : vetroHST}</span>` : ''}
                            </td>
                            <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #0891b2;">
                                € ${suppVetro.toFixed(2)}
                            </td>
                        </tr>
                        ` : ''}
                        
                        ${suppColore > 0 ? `
                        <tr style="background: #fefce8;">
                            <td style="padding: 0.75rem; border-bottom: 1px solid #e5e7eb;">
                                <strong>🎨 Supplemento Colore</strong>
                            </td>
                            <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #ca8a04;">
                                € ${suppColore.toFixed(2)}
                            </td>
                        </tr>
                        ` : ''}
                        
                        ${suppManiglia > 0 ? `
                        <tr>
                            <td style="padding: 0.75rem; border-bottom: 1px solid #e5e7eb;">
                                <strong>🔧 ${isFinSlide ? 'Maniglia HST' : 'Maniglia/Ferramenta'}</strong>
                                ${isFinSlide && manigliaHST ? `<br><span style="font-size: 0.8rem; color: #6b7280;">${manigliaHST === 'serie2' ? 'Alluminio serie 2' : manigliaHST}</span>` : ''}
                            </td>
                            <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #dc2626;">
                                € ${suppManiglia.toFixed(2)}
                            </td>
                        </tr>
                        ` : ''}
                        
                        ${suppMontante > 0 ? `
                        <tr style="background: #f9fafb;">
                            <td style="padding: 0.75rem; border-bottom: 1px solid #e5e7eb;">
                                <strong>📏 Montante Centrale</strong>
                            </td>
                            <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #9333ea;">
                                € ${suppMontante.toFixed(2)}
                            </td>
                        </tr>
                        ` : ''}
                        
                        ${suppSoglia > 0 ? `
                        <tr>
                            <td style="padding: 0.75rem; border-bottom: 1px solid #e5e7eb;">
                                <strong>🚪 Soglia Ribassata</strong><br>
                                <span style="font-size: 0.8rem; color: #6b7280;">Codice 3 - Taglio termico</span>
                            </td>
                            <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #ea580c;">
                                € ${suppSoglia.toFixed(2)}
                            </td>
                        </tr>
                        ` : ''}
                        
                        ${suppManigliettaPF > 0 ? `
                        <tr style="background: #f9fafb;">
                            <td style="padding: 0.75rem; border-bottom: 1px solid #e5e7eb;">
                                <strong>🔑 Maniglietta Esterna</strong><br>
                                <span style="font-size: 0.8rem; color: #6b7280;">Per porta-finestra</span>
                            </td>
                            <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #be185d;">
                                € ${suppManigliettaPF.toFixed(2)}
                            </td>
                        </tr>
                        ` : ''}
                        
                        <tr style="background: #f0fdf4;">
                            <td style="padding: 0.75rem; border-bottom: 1px solid #e5e7eb; font-weight: 600;">
                                Prezzo Unitario
                            </td>
                            <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: 600;">
                                € ${prezzoUnitario.toFixed(2)}
                            </td>
                        </tr>
                        
                        ${quantita > 1 ? `
                        <tr>
                            <td style="padding: 0.75rem; border-bottom: 1px solid #e5e7eb;">
                                Quantità
                            </td>
                            <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid #e5e7eb;">
                                × ${quantita}
                            </td>
                        </tr>
                        ` : ''}
                        
                        <tr style="background: #dcfce7;">
                            <td style="padding: 1rem; font-weight: 700; font-size: 1.1rem;">
                                TOTALE INFISSO
                            </td>
                            <td style="padding: 1rem; text-align: right; font-weight: 700; font-size: 1.25rem; color: #059669;">
                                € ${totale.toFixed(2)}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr${tipoFinstral ? ' 1fr' : ''}; gap: 1rem; font-size: 0.85rem;">
                <div style="background: #f9fafb; padding: 0.75rem; border-radius: 0.375rem;">
                    <strong>🏭 Azienda:</strong> ${azienda}
                </div>
                <div style="background: #f9fafb; padding: 0.75rem; border-radius: 0.375rem;">
                    <strong>🔲 Telaio:</strong> ${telaio}
                </div>
                ${tipoFinstral ? `
                <div style="background: ${isScorrevole ? '#dbeafe' : '#f9fafb'}; padding: 0.75rem; border-radius: 0.375rem;">
                    <strong>📋 Tipo:</strong> ${tipoFinstral}${isScorrevole ? ' (Scorr.)' : ''}
                </div>
                ` : ''}
            </div>
            ${tipoAnta ? `
            <div style="margin-top: 0.5rem; font-size: 0.85rem;">
                <div style="background: #f0fdf4; padding: 0.75rem; border-radius: 0.375rem;">
                    <strong>🚪 Anta:</strong> ${tipoAnta}
                </div>
            </div>
            ` : ''}
        </div>
    `;
    
    mostraModalDettaglioCosti('Infisso', dettaglioHTML);
    } catch (e) {
        console.error('❌ Errore in mostraDettaglioCostiInfisso:', e);
        alert('Errore dettaglio costi: ' + e.message);
    }
}

/**
 * 🆕 v7.89: Mostra dettaglio costi PERSIANA
 * USA SOLO I DATI GIÀ CALCOLATI NEL PREVENTIVO - NON RICALCOLA!
 */
function mostraDettaglioCostiPersiana(posIndex, rigaPreventivo = {}) {
    try {
        console.log(`📊 v7.92 Dettaglio Persiana Pos ${posIndex} - DATI DA PREVENTIVO:`, rigaPreventivo);
        
        // Dati dal preventivo
        const L_mm = rigaPreventivo.larghezza || 0;
        const H_mm = rigaPreventivo.altezza || 0;
        const superficie = rigaPreventivo.superficie || '-';
        const modello = rigaPreventivo.telaio || 'N/D';
        const azienda = rigaPreventivo.azienda || 'P. Persiane';
        const ambiente = rigaPreventivo.ambiente || `Pos ${posIndex}`;
        const tipo = rigaPreventivo.tipo || 'Persiana';
        
        // Prezzi dal preventivo - MAPPING v7.92:
        const prezzoBase = parseFloat(rigaPreventivo.prezzoBase) || 0;
        const suppColore = parseFloat(rigaPreventivo.supplementoTelaio) || 0;
        const suppSpagnolette = parseFloat(rigaPreventivo.supplementoAnta) || 0;
        const cardini = parseFloat(rigaPreventivo.supplementoVetro) || 0;
        const imballo = parseFloat(rigaPreventivo.supplementoManiglia) || 0;
        const contributoGestione = parseFloat(rigaPreventivo.supplementoColore) || 0;
        const prezzoUnitario = parseFloat(rigaPreventivo.prezzoUnitario) || 0;
        const quantita = parseInt(rigaPreventivo.quantita) || 1;
        const totale = parseFloat(rigaPreventivo.totale) || 0;
        
        // Info extra
        const coloreInfo = rigaPreventivo._colore || 'N/D';
        const categoriaColore = rigaPreventivo._categoriaColore || 'N/D';
        
        let dettaglioHTML = `
        <div style="padding: 1.5rem;">
            <div style="background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%); color: white; padding: 1rem 1.5rem; border-radius: 0.5rem; margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h3 style="margin: 0; font-size: 1.25rem;">🚪 ${tipo} - Posizione ${posIndex}</h3>
                        <p style="margin: 0.25rem 0 0 0; opacity: 0.9;">${ambiente}</p>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 1.5rem; font-weight: 700;">€ ${totale.toFixed(2)}</div>
                        <div style="font-size: 0.875rem; opacity: 0.9;">Totale${quantita > 1 ? ` (${quantita} pz)` : ''}</div>
                    </div>
                </div>
            </div>
            
            <div style="background: #f5f3ff; border: 1px solid #c4b5fd; border-radius: 0.5rem; padding: 1rem; margin-bottom: 1rem;">
                <h4 style="margin: 0 0 0.75rem 0; color: #7c3aed;">📐 Misure</h4>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; text-align: center;">
                    <div>
                        <div style="font-size: 0.75rem; color: #6b7280;">Larghezza</div>
                        <div style="font-size: 1.25rem; font-weight: 600;">${L_mm} mm</div>
                    </div>
                    <div>
                        <div style="font-size: 0.75rem; color: #6b7280;">Altezza</div>
                        <div style="font-size: 1.25rem; font-weight: 600;">${H_mm} mm</div>
                    </div>
                    <div>
                        <div style="font-size: 0.75rem; color: #6b7280;">Superficie</div>
                        <div style="font-size: 1.25rem; font-weight: 600;">${superficie}</div>
                    </div>
                </div>
            </div>
            
            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 0.5rem; overflow: hidden; margin-bottom: 1rem;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                    <thead>
                        <tr style="background: #f3f4f6;">
                            <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid #e5e7eb;">Componente</th>
                            <th style="padding: 0.75rem; text-align: right; border-bottom: 2px solid #e5e7eb;">Importo</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style="background: #f5f3ff;">
                            <td style="padding: 0.75rem; border-bottom: 1px solid #e5e7eb;">
                                <strong>📦 Prezzo Base Persiana</strong><br>
                                <span style="font-size: 0.8rem; color: #6b7280;">Modello: ${modello}</span>
                            </td>
                            <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #7c3aed;">
                                € ${prezzoBase.toFixed(2)}
                            </td>
                        </tr>
                        
                        ${suppColore > 0 ? `
                        <tr style="background: #fefce8;">
                            <td style="padding: 0.75rem; border-bottom: 1px solid #e5e7eb;">
                                <strong>🎨 Maggiorazione Colore</strong><br>
                                <span style="font-size: 0.8rem; color: #6b7280;">${coloreInfo} (${categoriaColore})</span>
                            </td>
                            <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #ca8a04;">
                                € ${suppColore.toFixed(2)}
                            </td>
                        </tr>
                        ` : ''}
                        
                        ${suppSpagnolette > 0 ? `
                        <tr>
                            <td style="padding: 0.75rem; border-bottom: 1px solid #e5e7eb;">
                                <strong>🔧 Spagnolette</strong><br>
                                <span style="font-size: 0.8rem; color: #6b7280;">Per 2+ ante</span>
                            </td>
                            <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #059669;">
                                € ${suppSpagnolette.toFixed(2)}
                            </td>
                        </tr>
                        ` : ''}
                        
                        ${cardini > 0 ? `
                        <tr style="background: #f9fafb;">
                            <td style="padding: 0.75rem; border-bottom: 1px solid #e5e7eb;">
                                <strong>🔩 Cardini</strong><br>
                                <span style="font-size: 0.8rem; color: #6b7280;">C.SAF90 × 4 pz</span>
                            </td>
                            <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #6b7280;">
                                € ${cardini.toFixed(2)}
                            </td>
                        </tr>
                        ` : ''}
                        
                        ${imballo > 0 ? `
                        <tr>
                            <td style="padding: 0.75rem; border-bottom: 1px solid #e5e7eb;">
                                <strong>📦 Imballo</strong><br>
                                <span style="font-size: 0.8rem; color: #6b7280;">3% standard</span>
                            </td>
                            <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #6b7280;">
                                € ${imballo.toFixed(2)}
                            </td>
                        </tr>
                        ` : ''}
                        
                        ${contributoGestione > 0 ? `
                        <tr style="background: #fef3c7;">
                            <td style="padding: 0.75rem; border-bottom: 1px solid #e5e7eb;">
                                <strong>📋 Contributo Gestione</strong><br>
                                <span style="font-size: 0.8rem; color: #6b7280;">Fisso per ordine</span>
                            </td>
                            <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #d97706;">
                                € ${contributoGestione.toFixed(2)}
                            </td>
                        </tr>
                        ` : ''}
                        
                        <tr style="background: #faf5ff;">
                            <td style="padding: 0.75rem; border-bottom: 1px solid #e5e7eb; font-weight: 600;">
                                Prezzo Unitario
                            </td>
                            <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: 600;">
                                € ${prezzoUnitario.toFixed(2)}
                            </td>
                        </tr>
                        
                        ${quantita > 1 ? `
                        <tr>
                            <td style="padding: 0.75rem; border-bottom: 1px solid #e5e7eb;">
                                Quantità
                            </td>
                            <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid #e5e7eb;">
                                × ${quantita}
                            </td>
                        </tr>
                        ` : ''}
                        
                        <tr style="background: #ede9fe;">
                            <td style="padding: 1rem; font-weight: 700; font-size: 1.1rem;">
                                TOTALE PERSIANA
                            </td>
                            <td style="padding: 1rem; text-align: right; font-weight: 700; font-size: 1.25rem; color: #7c3aed;">
                                € ${totale.toFixed(2)}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; font-size: 0.85rem;">
                <div style="background: #f9fafb; padding: 0.75rem; border-radius: 0.375rem;">
                    <strong>🏭 Azienda:</strong> ${azienda}
                </div>
                <div style="background: #f9fafb; padding: 0.75rem; border-radius: 0.375rem;">
                    <strong>🚪 Modello:</strong> ${modello}
                </div>
            </div>
        </div>
    `;
    
    mostraModalDettaglioCosti('Persiana', dettaglioHTML);
    } catch (e) {
        console.error('❌ Errore in mostraDettaglioCostiPersiana:', e);
        alert('Errore dettaglio costi: ' + e.message);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔌 v8.09: DETTAGLIO COSTI MOTORE SOMFY
// ═══════════════════════════════════════════════════════════════════════════
function mostraDettaglioCostiMotore(posIndex, rigaPreventivo = {}) {
    try {
        console.log(`🔌 v8.09 Dettaglio Motore Pos ${posIndex} - DATI:`, rigaPreventivo);
        
        const ambiente = rigaPreventivo.ambiente || `Pos ${posIndex}`;
        const azienda = rigaPreventivo.azienda || 'Somfy';
        const modelloId = rigaPreventivo.telaio || 'N/D';
        const totale = parseFloat(rigaPreventivo.totale) || 0;
        const quantita = parseInt(rigaPreventivo.quantita) || 1;
        const prezzoUnitario = parseFloat(rigaPreventivo.prezzoUnitario) || totale;
        
        // Prezzi componenti dal preventivo
        const prezzoMotore = parseFloat(rigaPreventivo.prezzoBase) || 0;
        const prezzoComando = parseFloat(rigaPreventivo.supplementoTelaio) || 0;
        const prezzoSupporto = parseFloat(rigaPreventivo.supplementoAnta) || 0;
        const prezzoRuota = parseFloat(rigaPreventivo.supplementoVetro) || 0;
        
        // Dettaglio kit se disponibile
        const dettaglioKit = rigaPreventivo._dettaglioKit || [];
        const accessori = rigaPreventivo._accessori || {};
        const comandoId = rigaPreventivo._comandoId || '';
        
        // Cerca info nel database SOMFY
        const motoreDb = SOMFY_PREZZI.getPrezzoMotore(modelloId.toLowerCase().replace(/\s+/g, '_'));
        const nomeMotore = motoreDb?.nome || modelloId;
        const refMotore = motoreDb?.ref || '';
        const coppia = motoreDb?.coppia || '';
        const velocita = motoreDb?.velocita || '';
        
        let dettaglioHTML = `
        <div style="padding: 1.5rem;">
            <div style="background: linear-gradient(135deg, #ea580c 0%, #f97316 100%); color: white; padding: 1rem 1.5rem; border-radius: 0.5rem; margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h3 style="margin: 0; font-size: 1.25rem;">🔌 Motore - Posizione ${posIndex}</h3>
                        <p style="margin: 0.25rem 0 0 0; opacity: 0.9;">${ambiente}</p>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 1.5rem; font-weight: 700;">€ ${totale.toFixed(2)}</div>
                        <div style="font-size: 0.875rem; opacity: 0.9;">Totale${quantita > 1 ? ` (${quantita} pz)` : ''}</div>
                    </div>
                </div>
            </div>
            
            <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 0.5rem; padding: 1rem; margin-bottom: 1rem;">
                <h4 style="margin: 0 0 0.75rem 0; color: #c2410c;">⚡ Specifiche Motore</h4>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; text-align: center;">
                    <div>
                        <div style="font-size: 0.75rem; color: #6b7280;">Modello</div>
                        <div style="font-size: 1rem; font-weight: 600;">${nomeMotore}</div>
                        ${refMotore ? `<div style="font-size: 0.7rem; color: #9ca3af;">Ref: ${refMotore}</div>` : ''}
                    </div>
                    ${coppia ? `
                    <div>
                        <div style="font-size: 0.75rem; color: #6b7280;">Coppia</div>
                        <div style="font-size: 1.25rem; font-weight: 600;">${coppia} Nm</div>
                    </div>
                    ` : ''}
                    ${velocita ? `
                    <div>
                        <div style="font-size: 0.75rem; color: #6b7280;">Velocità</div>
                        <div style="font-size: 1.25rem; font-weight: 600;">${velocita} rpm</div>
                    </div>
                    ` : ''}
                </div>
            </div>
            
            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 0.5rem; overflow: hidden; margin-bottom: 1rem;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                    <thead>
                        <tr style="background: #f3f4f6;">
                            <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid #e5e7eb;">Componente</th>
                            <th style="padding: 0.75rem; text-align: right; border-bottom: 2px solid #e5e7eb;">Prezzo Listino</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style="background: #fff7ed;">
                            <td style="padding: 0.75rem; border-bottom: 1px solid #e5e7eb;">
                                <strong>🔌 Motore</strong><br>
                                <span style="font-size: 0.8rem; color: #6b7280;">${nomeMotore}</span>
                            </td>
                            <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #ea580c;">
                                € ${prezzoMotore.toFixed(2)}
                            </td>
                        </tr>
                        
                        ${prezzoComando > 0 ? `
                        <tr>
                            <td style="padding: 0.75rem; border-bottom: 1px solid #e5e7eb;">
                                <strong>🎮 Comando/Ricevitore</strong><br>
                                <span style="font-size: 0.8rem; color: #6b7280;">${comandoId || 'N/D'}</span>
                            </td>
                            <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #2563eb;">
                                € ${prezzoComando.toFixed(2)}
                            </td>
                        </tr>
                        ` : ''}
                        
                        ${accessori.supporto ? `
                        <tr style="background: #f9fafb;">
                            <td style="padding: 0.75rem; border-bottom: 1px solid #e5e7eb;">
                                <strong>🔩 Supporto Operatore</strong><br>
                                <span style="font-size: 0.8rem; color: #6b7280;">Ref: 9019821</span>
                            </td>
                            <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #059669;">
                                € ${prezzoSupporto.toFixed(2)}
                            </td>
                        </tr>
                        ` : ''}
                        
                        ${accessori.ruota_60 ? `
                        <tr>
                            <td style="padding: 0.75rem; border-bottom: 1px solid #e5e7eb;">
                                <strong>⚙️ Ruota Ottagonale 60mm</strong><br>
                                <span style="font-size: 0.8rem; color: #6b7280;">Ref: 9751001</span>
                            </td>
                            <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #059669;">
                                € ${prezzoRuota.toFixed(2)}
                            </td>
                        </tr>
                        ` : ''}
                        
                        ${accessori.corona_60 ? `
                        <tr style="background: #f9fafb;">
                            <td style="padding: 0.75rem; border-bottom: 1px solid #e5e7eb;">
                                <strong>👑 Corona Ottagonale 60</strong><br>
                                <span style="font-size: 0.8rem; color: #6b7280;">Ref: 9707025</span>
                            </td>
                            <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #059669;">
                                € ${(SOMFY_PREZZI.accessori.corona_60?.listino || 17.67).toFixed(2)}
                            </td>
                        </tr>
                        ` : ''}
                        
                        ${quantita > 1 ? `
                        <tr style="background: #fef3c7;">
                            <td style="padding: 0.75rem; border-bottom: 1px solid #e5e7eb;">
                                <strong>📦 Quantità</strong>
                            </td>
                            <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: 600;">
                                × ${quantita} pz
                            </td>
                        </tr>
                        ` : ''}
                        
                        <tr style="background: #ffedd5;">
                            <td style="padding: 1rem; font-weight: 700; font-size: 1.1rem;">
                                TOTALE MOTORE
                            </td>
                            <td style="padding: 1rem; text-align: right; font-weight: 700; font-size: 1.25rem; color: #ea580c;">
                                € ${totale.toFixed(2)}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; font-size: 0.85rem;">
                <div style="background: #f9fafb; padding: 0.75rem; border-radius: 0.375rem;">
                    <strong>🏭 Azienda:</strong> ${azienda}
                </div>
                <div style="background: #f9fafb; padding: 0.75rem; border-radius: 0.375rem;">
                    <strong>💡 Prezzo Unitario:</strong> € ${prezzoUnitario.toFixed(2)}
                </div>
            </div>
            
            <div style="margin-top: 1rem; padding: 0.75rem; background: #fef3c7; border-radius: 0.375rem; font-size: 0.8rem; color: #92400e;">
                <strong>⚠️ Nota:</strong> Prezzi da listino SOMFY 2025. Applicare sconto installatore per prezzo netto.
            </div>
        </div>
    `;
    
    mostraModalDettaglioCosti('Motore', dettaglioHTML);
    } catch (e) {
        console.error('❌ Errore in mostraDettaglioCostiMotore:', e);
        alert('Errore dettaglio costi: ' + e.message);
    }
}

// Esponi globalmente
window.mostraDettaglioCostiMotore = mostraDettaglioCostiMotore;

// 🔐 v7.98_07: DETTAGLIO COSTI BLINDATA
function mostraDettaglioCostiBlindato(posIndex, rigaPreventivo = {}) {
    try {
        console.log('🔐 mostraDettaglioCostiBlindato posizione:', posIndex);
        
        // Trova la posizione nei dati caricati
        const data = window.projectData || window.currentData;
        if (!data) {
            alert('Dati progetto non trovati');
            return;
        }
        
        const posizioni = data.positions || data.posizioni || [];
        const pos = posizioni[posIndex - 1];
        if (!pos) {
            alert('Posizione non trovata');
            return;
        }
        
        // Prendi i dati blindata (normalizzati)
        const bld = pos.blindata || pos.ingresso?.blindata;
        if (!bld) {
            alert('Dati blindata non trovati');
            return;
        }
        
        // Ricalcola prezzo per avere il dettaglio
        const prezzoCalcolato = calcolaPrezzoBlindataOikos(bld);
        const det = prezzoCalcolato.dettaglio || {};
        
        // Costruisci HTML del popup
        const contenutoHTML = `
            <div style="padding: 1rem;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                    <div style="background: #fff7ed; padding: 1rem; border-radius: 8px;">
                        <div style="font-size: 0.8rem; color: #9a3412;">Luce Netta Passaggio (LNP)</div>
                        <div style="font-size: 1.5rem; font-weight: bold; color: #c2410c;">${bld.LNP_L || 0} × ${bld.LNP_H || 0} mm</div>
                    </div>
                    <div style="background: #fef2f2; padding: 1rem; border-radius: 8px;">
                        <div style="font-size: 0.8rem; color: #991b1b;">Luce Calcolata</div>
                        <div style="font-size: 1.5rem; font-weight: bold; color: #dc2626;">${(bld.luceCalcolata || 'luce0').toUpperCase()}</div>
                    </div>
                </div>
                
                <div style="background: #f1f5f9; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                    <div style="font-weight: 600; margin-bottom: 0.5rem;">📋 Configurazione</div>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; font-size: 0.85rem;">
                        <div><strong>Versione:</strong> ${bld.versione || 'E3'}</div>
                        <div><strong>Tipo Anta:</strong> ${bld.tipoAnta || 'singola'}</div>
                        <div><strong>Apertura:</strong> ${bld.sensoApertura || 'SX'}</div>
                        <div><strong>Controtelaio:</strong> ${bld.controtelaio === 'si' ? 'Sì' : 'No'}</div>
                        <div><strong>Cilindro:</strong> ${bld.cilindro || 'BASIC'}</div>
                        <div><strong>Colore Telaio:</strong> ${bld.coloreTelaio || 'RAL8022'}</div>
                        <div><strong>Kit AAV:</strong> ${bld.kitAAV || 'N/D'}</div>
                        <div><strong>Termica:</strong> ${bld.termica || 'serie'}</div>
                        <div><strong>Acustica:</strong> ${bld.acustica || 'serie'}</div>
                    </div>
                </div>
                
                <div style="background: #f0fdf4; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                    <div style="font-weight: 600; margin-bottom: 0.5rem;">🎨 Rivestimenti</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; font-size: 0.85rem;">
                        <div>
                            <strong>Interno:</strong><br>
                            ${bld.rivestimentoInt?.linea || 'N/D'} - ${bld.rivestimentoInt?.modello || ''}<br>
                            ${bld.rivestimentoInt?.essenza || ''} ${bld.rivestimentoInt?.tinta || ''}
                        </div>
                        <div>
                            <strong>Esterno:</strong><br>
                            ${bld.rivestimentoEst?.linea || 'N/D'} - ${bld.rivestimentoEst?.modello || ''}<br>
                            ${bld.rivestimentoEst?.essenza || ''} ${bld.rivestimentoEst?.tinta || ''}
                        </div>
                    </div>
                </div>
                
                <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                    <thead>
                        <tr style="background: #e11d48; color: white;">
                            <th style="padding: 0.75rem; text-align: left;">Voce</th>
                            <th style="padding: 0.75rem; text-align: right;">Importo €</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style="background: #fff;">
                            <td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb;">Prezzo Base ${bld.versione || 'E3'}</td>
                            <td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb; text-align: right;">€ ${(det.prezzoBase || 0).toFixed(2)}</td>
                        </tr>
                        ${det.controtelaio > 0 ? `
                        <tr style="background: #f9fafb;">
                            <td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb;">Controtelaio</td>
                            <td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb; text-align: right;">€ ${det.controtelaio.toFixed(2)}</td>
                        </tr>
                        ` : ''}
                        <tr style="background: #fff;">
                            <td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb;">Cilindro ${bld.cilindro || 'BASIC'}</td>
                            <td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb; text-align: right;">€ ${(det.cilindro || 0).toFixed(2)}</td>
                        </tr>
                        ${det.colore > 0 ? `
                        <tr style="background: #f9fafb;">
                            <td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb;">Colore Telaio ${bld.coloreTelaio || ''}</td>
                            <td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb; text-align: right;">€ ${det.colore.toFixed(2)}</td>
                        </tr>
                        ` : ''}
                        ${det.rivestimenti > 0 ? `
                        <tr style="background: #fff;">
                            <td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb;">Rivestimenti INT + EST</td>
                            <td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb; text-align: right;">€ ${det.rivestimenti.toFixed(2)}</td>
                        </tr>
                        ` : ''}
                        ${det.kitAAV > 0 ? `
                        <tr style="background: #f9fafb;">
                            <td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb;">Kit AAV ${bld.kitAAV || ''}</td>
                            <td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb; text-align: right;">€ ${det.kitAAV.toFixed(2)}</td>
                        </tr>
                        ` : ''}
                        ${det.maniglie > 0 ? `
                        <tr style="background: #fff;">
                            <td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb;">🚪 Maniglie (INT: ${bld.manigliaInt || 'std'} ${bld.finituraInt || ''} + EST: ${bld.manigliaEst || 'std'} ${bld.finituraEst || ''})</td>
                            <td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb; text-align: right;">€ ${det.maniglie.toFixed(2)}</td>
                        </tr>
                        ` : ''}
                        ${det.chiaviExtra > 0 ? `
                        <tr style="background: #f9fafb;">
                            <td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb;">🔑 Chiavi extra (${parseInt(bld.numChiavi || 3) - 3} × €25)</td>
                            <td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb; text-align: right;">€ ${det.chiaviExtra.toFixed(2)}</td>
                        </tr>
                        ` : ''}
                        ${det.imbotti > 0 ? `
                        <tr style="background: #fff;">
                            <td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb;">📐 Imbotte Est. ${bld.imbotteEstAltezza || ''} × ${bld.imbotteEstLargh || ''} (${bld.imbotteEstEssenza || 'std'})</td>
                            <td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb; text-align: right;">€ ${det.imbotti.toFixed(2)}</td>
                        </tr>
                        ` : ''}
                        ${det.cornici > 0 ? `
                        <tr style="background: #f9fafb;">
                            <td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb;">🖼️ Cornici ${bld.corniciFermaPannello ? 'Ferma Pannello' : ''} ${bld.corniciInt ? '+ Interne' : ''}</td>
                            <td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb; text-align: right;">€ ${det.cornici.toFixed(2)}</td>
                        </tr>
                        ` : ''}
                        ${det.acustica > 0 ? `
                        <tr style="background: #fff;">
                            <td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb;">Maggiorazione Acustica</td>
                            <td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb; text-align: right;">€ ${det.acustica.toFixed(2)}</td>
                        </tr>
                        ` : ''}
                        ${det.termica > 0 ? `
                        <tr style="background: #f9fafb;">
                            <td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb;">Termica ${bld.termica || ''}</td>
                            <td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb; text-align: right;">€ ${det.termica.toFixed(2)}</td>
                        </tr>
                        ` : ''}
                        ${det.optional > 0 ? `
                        <tr style="background: #fff;">
                            <td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb;">Optional (vetro/sopraluce/fiancoluce)</td>
                            <td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb; text-align: right;">€ ${det.optional.toFixed(2)}</td>
                        </tr>
                        ` : ''}
                    </tbody>
                    <tfoot>
                        <tr style="background: #e11d48; color: white; font-weight: bold;">
                            <td style="padding: 0.75rem;">TOTALE BLINDATA</td>
                            <td style="padding: 0.75rem; text-align: right;">€ ${(prezzoCalcolato.totale || 0).toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
        
        // Usa la funzione modale generica
        mostraModalDettaglioCosti(`🔐 Dettaglio Blindata - Pos. ${posIndex}`, contenutoHTML);
        
    } catch (e) {
        console.error('❌ Errore in mostraDettaglioCostiBlindato:', e);
        alert('Errore dettaglio costi: ' + e.message);
    }
}

// ═══════════════════════════════════════════════════════════════════
// 🚪 v7.99 DETTAGLIO COSTI PORTONCINO FIN-DOOR
// ═══════════════════════════════════════════════════════════════════
function mostraDettaglioCostiPortoncino(posIndex, rigaPreventivo = {}) {
    try {
        console.log('🚪 mostraDettaglioCostiPortoncino posizione:', posIndex);
        
        const data = window.projectData || window.currentData;
        if (!data) { alert('Dati progetto non trovati'); return; }
        
        const posizioni = data.positions || data.posizioni || [];
        const pos = posizioni[posIndex - 1];
        if (!pos) { alert('Posizione non trovata'); return; }
        
        const ptc = pos.portoncino || pos.ingresso?.portoncino;
        if (!ptc) { alert('Dati portoncino non trovati'); return; }
        
        const prezzoCalcolato = (typeof calcolaPrezzoPortoncinoFindoor === 'function') 
            ? calcolaPrezzoPortoncinoFindoor(ptc) 
            : _calcolaPortoncinoStub(ptc, parseInt(ptc.BRM_L)||0, parseInt(ptc.BRM_H)||0);
        
        const tipiApertura = {
            '720': 'Porta singola', '625': 'Porta singola (var.)', '621': 'Porta + laterale sx',
            '622': 'Porta + laterale dx', '633': 'Porta + 2 laterali', '636': 'Doppia porta',
            '624': 'Porta + sopraluce', '623': 'Porta + anta sup.'
        };
        
        const contenutoHTML = `
            <div style="padding: 1rem;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                    <div style="background: #fdf4ff; padding: 1rem; border-radius: 8px;">
                        <div style="font-size: 0.8rem; color: #86198f;">Misure BRM</div>
                        <div style="font-size: 1.5rem; font-weight: bold; color: #a21caf;">${ptc.BRM_L || 0} × ${ptc.BRM_H || 0} mm</div>
                    </div>
                    <div style="background: #fce7f3; padding: 1rem; border-radius: 8px;">
                        <div style="font-size: 0.8rem; color: #9d174d;">Tipo Apertura</div>
                        <div style="font-size: 1.5rem; font-weight: bold; color: #be185d;">${ptc.tipoApertura || '720'}</div>
                        <div style="font-size: 0.75rem; color: #9d174d;">${tipiApertura[ptc.tipoApertura] || 'Porta singola'}</div>
                    </div>
                </div>
                
                <div style="background: #f1f5f9; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                    <div style="font-weight: 600; margin-bottom: 0.5rem;">📋 Configurazione</div>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; font-size: 0.85rem;">
                        <div><strong>Mat. Int:</strong> ${ptc.materialeInt || 'PVC'}</div>
                        <div><strong>Mat. Est:</strong> ${ptc.materialeEst || 'PVC'}</div>
                        <div><strong>Modello:</strong> ${ptc.modelloAnta || '01'}</div>
                        <div><strong>Apertura:</strong> ${ptc.versoApertura || ptc.direzioneApertura || '-'} + ${ptc.sensoApertura || ptc.latoCerniere || '-'}</div>
                        <div><strong>Cilindro:</strong> ${ptc.cilindro || '1P'}</div>
                    </div>
                </div>
                
                <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                    <thead>
                        <tr style="background: #db2777; color: white;">
                            <th style="padding: 0.75rem; text-align: left;">Voce</th>
                            <th style="padding: 0.75rem; text-align: right;">€</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style="background: #fff;"><td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb;">Prezzo Base</td><td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb; text-align: right;">€ ${(prezzoCalcolato.prezzoBase || 0).toFixed(2)}</td></tr>
                        ${prezzoCalcolato.supplementoModello > 0 ? `<tr style="background: #f9fafb;"><td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb;">Modello Anta ${ptc.modelloAnta}</td><td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb; text-align: right;">€ ${prezzoCalcolato.supplementoModello.toFixed(2)}</td></tr>` : ''}
                        ${prezzoCalcolato.supplementoColoreInt > 0 ? `<tr style="background: #fff;"><td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb;">Colore Int (${ptc.gruppoColoreInt})</td><td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb; text-align: right;">€ ${prezzoCalcolato.supplementoColoreInt.toFixed(2)}</td></tr>` : ''}
                        ${prezzoCalcolato.supplementoColoreEst > 0 ? `<tr style="background: #f9fafb;"><td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb;">Colore Est (${ptc.gruppoColoreEst})</td><td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb; text-align: right;">€ ${prezzoCalcolato.supplementoColoreEst.toFixed(2)}</td></tr>` : ''}
                        ${prezzoCalcolato.maniglia > 0 ? `<tr style="background: #fff;"><td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb;">🚪 Maniglia ${ptc.codManiglia}</td><td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb; text-align: right;">€ ${prezzoCalcolato.maniglia.toFixed(2)}</td></tr>` : ''}
                        ${prezzoCalcolato.cilindro > 0 ? `<tr style="background: #f9fafb;"><td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb;">🔑 Cilindro ${ptc.cilindro}</td><td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb; text-align: right;">€ ${prezzoCalcolato.cilindro.toFixed(2)}</td></tr>` : ''}
                        ${prezzoCalcolato.cerniere > 0 ? `<tr style="background: #fff;"><td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb;">⚙️ Cerniere scomparsa</td><td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb; text-align: right;">€ ${prezzoCalcolato.cerniere.toFixed(2)}</td></tr>` : ''}
                        ${prezzoCalcolato.fonoassorbente > 0 ? `<tr style="background: #f9fafb;"><td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb;">🔇 Fonoassorbente 42dB</td><td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb; text-align: right;">€ ${prezzoCalcolato.fonoassorbente.toFixed(2)}</td></tr>` : ''}
                        ${prezzoCalcolato.moltiplicatoreTipo !== 1 ? `<tr style="background: #fef3c7;"><td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb; font-style: italic;">📐 Moltiplicatore ×${prezzoCalcolato.moltiplicatoreTipo}</td><td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb; text-align: right; font-style: italic;">applicato</td></tr>` : ''}
                    </tbody>
                    <tfoot>
                        <tr style="background: #db2777; color: white; font-weight: bold;">
                            <td style="padding: 0.75rem;">TOTALE PORTONCINO</td>
                            <td style="padding: 0.75rem; text-align: right;">€ ${(prezzoCalcolato.totale || 0).toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
        
        mostraModalDettaglioCosti(`🚪 Dettaglio Portoncino - Pos. ${posIndex}`, contenutoHTML);
        
    } catch (e) {
        console.error('❌ Errore in mostraDettaglioCostiPortoncino:', e);
        alert('Errore dettaglio costi: ' + e.message);
    }
}

window.mostraDettaglioCostiTapparella = mostraDettaglioCostiTapparella;
window.mostraDettaglioCostiPersiana = mostraDettaglioCostiPersiana;
window.mostraDettaglioCostiInfisso = mostraDettaglioCostiInfisso;
window.mostraDettaglioCostiBlindato = mostraDettaglioCostiBlindato;
window.mostraDettaglioCostiPortoncino = mostraDettaglioCostiPortoncino;

// ═══════════════════════════════════════════════════════════════════════════
// 📦 v7.996: DETTAGLIO COSTI CASSONETTO FINSTRAL
// ═══════════════════════════════════════════════════════════════════════════
function mostraDettaglioCostiCassonetto(posIndex, rigaPreventivo = {}) {
    try {
        console.log(`📦 Dettaglio Cassonetto Pos ${posIndex}:`, rigaPreventivo);
        
        const L_mm = rigaPreventivo.larghezza || 0;
        const A_mm = rigaPreventivo.altezza || 0;
        const B_mm = rigaPreventivo.B || 0;
        const azienda = rigaPreventivo.azienda || 'Finstral';
        const ambiente = rigaPreventivo.ambiente || `Pos ${posIndex}`;
        const materiale = rigaPreventivo.materialeCass || rigaPreventivo.materiale || 'PVC';
        const codiceCass = rigaPreventivo.codiceCass || '148';
        const gruppoColore = rigaPreventivo.gruppoColoreCass || 'bianco';
        const isolamento = rigaPreventivo.codiceIsolamento || null;
        const quantita = parseInt(rigaPreventivo.quantita) || 1;
        
        // Ricalcola per dettaglio
        const calcolo = calcolaPrezzoCassonettoFinstral({
            L: L_mm,
            A: A_mm,
            B: B_mm,
            materialeCass: materiale,
            codiceCass: codiceCass,
            gruppoColoreCass: gruppoColore,
            codiceIsolamento: isolamento
        });
        
        const prezzoBase = calcolo.dettaglio?.prezzoBase || 0;
        const suppIsolamento = calcolo.dettaglio?.supplementoIsolamento || 0;
        const numIsolamenti = calcolo.dettaglio?.numeroIsolamenti || 0;
        const prezzoUnitario = calcolo.prezzo || 0;
        const totale = prezzoUnitario * quantita;
        const LArr = calcolo.parametri?.LArrotondato || L_mm;
        const AArr = calcolo.parametri?.AArrotondato || A_mm;
        
        let dettaglioHTML = `
        <div style="padding: 1.5rem;">
            <div style="background: linear-gradient(135deg, #ea580c 0%, #f97316 100%); color: white; padding: 1rem 1.5rem; border-radius: 0.5rem; margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h3 style="margin: 0; font-size: 1.25rem;">📦 Cassonetto - Posizione ${posIndex}</h3>
                        <p style="margin: 0.25rem 0 0 0; opacity: 0.9;">${ambiente} - ${azienda}</p>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 1.5rem; font-weight: 700;">€ ${totale.toFixed(2)}</div>
                        <div style="font-size: 0.875rem; opacity: 0.9;">Totale${quantita > 1 ? ` (${quantita} pz)` : ''}</div>
                    </div>
                </div>
            </div>
            
            <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 0.5rem; padding: 1rem; margin-bottom: 1rem;">
                <h4 style="margin: 0 0 0.75rem 0; color: #c2410c;">⚙️ Configurazione</h4>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem; font-size: 0.9rem;">
                    <div><strong>Materiale:</strong> ${materiale}</div>
                    <div><strong>Codice:</strong> ${codiceCass}</div>
                    <div><strong>Colore:</strong> ${gruppoColore}</div>
                    <div><strong>Isolamento:</strong> ${isolamento || 'No'}</div>
                </div>
            </div>
            
            <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 0.5rem; padding: 1rem; margin-bottom: 1rem;">
                <h4 style="margin: 0 0 0.75rem 0; color: #0369a1;">📐 Misure (Reali → Listino)</h4>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; text-align: center;">
                    <div>
                        <div style="font-size: 0.75rem; color: #6b7280;">Larghezza L</div>
                        <div style="font-size: 1.1rem; font-weight: 600;">${L_mm} → ${LArr} mm</div>
                    </div>
                    <div>
                        <div style="font-size: 0.75rem; color: #6b7280;">Altezza A</div>
                        <div style="font-size: 1.1rem; font-weight: 600;">${A_mm} → ${AArr} mm</div>
                    </div>
                    <div>
                        <div style="font-size: 0.75rem; color: #6b7280;">Profondità B</div>
                        <div style="font-size: 1.1rem; font-weight: 600;">${B_mm} mm</div>
                    </div>
                </div>
            </div>
            
            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 0.5rem; overflow: hidden; margin-bottom: 1rem;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                    <thead>
                        <tr style="background: #f3f4f6;">
                            <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid #e5e7eb;">Componente</th>
                            <th style="padding: 0.75rem; text-align: center; border-bottom: 2px solid #e5e7eb;">Dettaglio</th>
                            <th style="padding: 0.75rem; text-align: right; border-bottom: 2px solid #e5e7eb;">Importo</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style="background: #fef3c7;">
                            <td style="padding: 0.75rem; border-bottom: 1px solid #e5e7eb;">
                                <strong>📦 Corpo Cassonetto</strong><br>
                                <span style="font-size: 0.8rem; color: #6b7280;">${materiale} cod. ${codiceCass} - ${gruppoColore}</span>
                            </td>
                            <td style="padding: 0.75rem; text-align: center; border-bottom: 1px solid #e5e7eb; font-family: monospace;">
                                L${LArr} × A${AArr}
                            </td>
                            <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #ca8a04;">
                                € ${prezzoBase.toFixed(2)}
                            </td>
                        </tr>
                        ${suppIsolamento > 0 ? `
                        <tr>
                            <td style="padding: 0.75rem; border-bottom: 1px solid #e5e7eb;">
                                <strong>🧊 Isolamento Termico</strong><br>
                                <span style="font-size: 0.8rem; color: #6b7280;">Cod. ${isolamento} (Usb 0,87 W/m²K)</span>
                            </td>
                            <td style="padding: 0.75rem; text-align: center; border-bottom: 1px solid #e5e7eb; font-family: monospace;">
                                ${numIsolamenti} pz × €${(suppIsolamento/numIsolamenti).toFixed(2)}
                            </td>
                            <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #0891b2;">
                                € ${suppIsolamento.toFixed(2)}
                            </td>
                        </tr>
                        ` : ''}
                    </tbody>
                    <tfoot>
                        <tr style="background: #f0fdf4;">
                            <td colspan="2" style="padding: 0.75rem; font-weight: 700; color: #166534;">
                                TOTALE CASSONETTO ${quantita > 1 ? `(× ${quantita} pz)` : ''}
                            </td>
                            <td style="padding: 0.75rem; text-align: right; font-size: 1.25rem; font-weight: 700; color: #166534;">
                                € ${totale.toFixed(2)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            
            <div style="background: #fefce8; border: 1px solid #fef08a; border-radius: 0.5rem; padding: 0.75rem; font-size: 0.8rem; color: #854d0e;">
                <strong>📋 Note:</strong> Listino Finstral EUR 2025/3. Per misure intermedie vale la casella superiore.
                ${L_mm > 2750 ? '<br>⚠️ L > 2750mm: coperchio consegnato in due parti.' : ''}
                ${materiale === 'LEGNO' && L_mm > 2240 ? '<br>⚠️ Legno: larghezza max 2240mm!' : ''}
            </div>
        </div>
        `;
        
        mostraModalDettaglioCosti('📦 Dettaglio Costi Cassonetto', dettaglioHTML);
        
    } catch (e) {
        console.error('❌ Errore mostraDettaglioCostiCassonetto:', e);
        alert('Errore dettaglio cassonetto: ' + e.message);
    }
}

window.mostraDettaglioCostiCassonetto = mostraDettaglioCostiCassonetto;

// 🔒 v8.54: Dettaglio costi grata
function mostraDettaglioCostiGrata(posIndex, rigaPreventivo = {}) {
    const dettaglio = rigaPreventivo._dettaglioGrata;
    const L = rigaPreventivo.larghezza || 0;
    const H = rigaPreventivo.altezza || 0;
    
    let html = `
        <div style="padding: 16px;">
            <h3 style="margin-bottom: 12px;">🔒 Grata - Posizione ${posIndex}</h3>
            <table style="width: 100%; border-collapse: collapse;">
                <tr style="background: #f9fafb;"><td style="padding: 8px; font-weight: 600;">Tipo</td><td style="padding: 8px;">${rigaPreventivo.tipo || '-'}</td></tr>
                <tr><td style="padding: 8px; font-weight: 600;">Azienda</td><td style="padding: 8px;">${rigaPreventivo.azienda || '-'}</td></tr>
                <tr style="background: #f9fafb;"><td style="padding: 8px; font-weight: 600;">Modello</td><td style="padding: 8px;">${rigaPreventivo.telaio || '-'}</td></tr>
                <tr><td style="padding: 8px; font-weight: 600;">Dimensioni BRM</td><td style="padding: 8px;">${L} × ${H} mm</td></tr>
    `;
    
    if (dettaglio) {
        html += `
                <tr style="background: #f0fdf4;"><td style="padding: 8px; font-weight: 600;">Prezzo base</td><td style="padding: 8px;">€ ${(dettaglio.prezzoBase || dettaglio.prezzo || 0).toFixed(2)}</td></tr>
                ${dettaglio.supplementoColore ? `<tr><td style="padding: 8px; font-weight: 600;">Suppl. colore</td><td style="padding: 8px;">€ ${dettaglio.supplementoColore.toFixed(2)}</td></tr>` : ''}
                ${dettaglio.supplementoAccessori ? `<tr style="background: #f9fafb;"><td style="padding: 8px; font-weight: 600;">Accessori</td><td style="padding: 8px;">€ ${dettaglio.supplementoAccessori.toFixed(2)}</td></tr>` : ''}
                ${dettaglio.dettaglio ? `<tr><td colspan="2" style="padding: 8px; font-size: 0.85rem; color: #6b7280;">${dettaglio.dettaglio}</td></tr>` : ''}
        `;
    } else {
        html += `<tr style="background: #fef2f2;"><td colspan="2" style="padding: 8px; color: #991b1b;">⚠️ Dettaglio calcolo non disponibile</td></tr>`;
    }
    
    html += `
                <tr style="background: #dcfce7; font-weight: 700;"><td style="padding: 8px;">TOTALE</td><td style="padding: 8px;">€ ${rigaPreventivo.prezzoUnitario || '0.00'}</td></tr>
            </table>
        </div>
    `;
    
    mostraModalDettaglioCosti('🔒 Dettaglio Costi Grata', html);
}
window.mostraDettaglioCostiGrata = mostraDettaglioCostiGrata;

// 🦟 v8.66: DETTAGLIO COSTI ZANZARIERA
function mostraDettaglioCostiZanzariera(posIndex, rigaPreventivo = {}) {
    try {
        console.log(`🦟 Dettaglio Zanzariera Pos ${posIndex}:`, rigaPreventivo);
        
        const ambiente = rigaPreventivo.ambiente || `Pos ${posIndex}`;
        const azienda = rigaPreventivo.azienda || '-';
        const modello = rigaPreventivo.telaio || '-';
        const totale = parseFloat(rigaPreventivo.totale) || 0;
        const quantita = parseInt(rigaPreventivo.quantita) || 1;
        const prezzoUnitario = parseFloat(rigaPreventivo.prezzoUnitario) || totale;
        const L = rigaPreventivo.larghezza || 0;
        const H = rigaPreventivo.altezza || 0;
        const mq = rigaPreventivo.superficie || '-';
        const fascia = rigaPreventivo.perimetro || '-';  // fascia colore salvata in "perimetro"
        
        // Dettaglio calcolo Palagina
        const det = rigaPreventivo._dettaglioPalagina || {};
        const prezzoBase = parseFloat(rigaPreventivo.prezzoBase) || 0;
        const suppRete = parseFloat(rigaPreventivo.supplementoTelaio) || 0;
        const totAccessori = parseFloat(rigaPreventivo.supplementoAnta) || 0;
        const prezzoMq = det.prezzoMq || 0;
        const minMq = det.minMq || 0;
        const mqReali = det.mqReali || 0;
        
        let dettaglioHTML = `
        <div style="padding: 1.5rem;">
            <div style="background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%); color: white; padding: 1rem 1.5rem; border-radius: 0.5rem; margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h3 style="margin: 0; font-size: 1.25rem;">🦟 Zanzariera - Posizione ${posIndex}</h3>
                        <p style="margin: 0.25rem 0 0 0; opacity: 0.9;">${ambiente}</p>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 1.5rem; font-weight: 700;">€ ${totale.toFixed(2)}</div>
                        <div style="font-size: 0.875rem; opacity: 0.9;">Totale${quantita > 1 ? ` (${quantita} pz)` : ''}</div>
                    </div>
                </div>
            </div>
            
            <div style="background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 0.5rem; padding: 1rem; margin-bottom: 1rem;">
                <h4 style="margin: 0 0 0.75rem 0; color: #0f766e;">📐 Dimensioni e Modello</h4>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; text-align: center;">
                    <div>
                        <div style="font-size: 0.75rem; color: #6b7280;">Modello</div>
                        <div style="font-size: 1rem; font-weight: 600;">${modello}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.75rem; color: #6b7280;">Dimensioni</div>
                        <div style="font-size: 1rem; font-weight: 600;">${L} × ${H} mm</div>
                    </div>
                    <div>
                        <div style="font-size: 0.75rem; color: #6b7280;">m² fatturati</div>
                        <div style="font-size: 1.25rem; font-weight: 600;">${mq}</div>
                        ${mqReali ? `<div style="font-size: 0.7rem; color: #9ca3af;">reali: ${mqReali}</div>` : ''}
                    </div>
                    <div>
                        <div style="font-size: 0.75rem; color: #6b7280;">Fascia</div>
                        <div style="font-size: 1.25rem; font-weight: 600;">${fascia}</div>
                    </div>
                </div>
            </div>
            
            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 0.5rem; overflow: hidden; margin-bottom: 1rem;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.875rem;">
                    <thead>
                        <tr style="background: #f9fafb;">
                            <th style="text-align: left; padding: 0.625rem 1rem;">Voce</th>
                            <th style="text-align: right; padding: 0.625rem 1rem;">Importo</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style="border-top: 1px solid #e5e7eb;">
                            <td style="padding: 0.625rem 1rem;">Prezzo base ${prezzoMq ? `(€${prezzoMq}/m² × ${mq} m²)` : ''}</td>
                            <td style="text-align: right; padding: 0.625rem 1rem; font-weight: 600;">€ ${prezzoBase.toFixed(2)}</td>
                        </tr>
                        ${suppRete > 0 ? `
                        <tr style="border-top: 1px solid #e5e7eb;">
                            <td style="padding: 0.625rem 1rem;">Supplemento rete</td>
                            <td style="text-align: right; padding: 0.625rem 1rem;">€ ${suppRete.toFixed(2)}</td>
                        </tr>` : ''}
                        ${totAccessori > 0 ? `
                        <tr style="border-top: 1px solid #e5e7eb;">
                            <td style="padding: 0.625rem 1rem;">Accessori</td>
                            <td style="text-align: right; padding: 0.625rem 1rem;">€ ${totAccessori.toFixed(2)}</td>
                        </tr>` : ''}
                        <tr style="border-top: 2px solid #0d9488; background: #f0fdfa;">
                            <td style="padding: 0.75rem 1rem; font-weight: 700;">Prezzo unitario</td>
                            <td style="text-align: right; padding: 0.75rem 1rem; font-weight: 700; font-size: 1.1rem; color: #0d9488;">€ ${prezzoUnitario}</td>
                        </tr>
                        ${quantita > 1 ? `
                        <tr style="border-top: 1px solid #e5e7eb;">
                            <td style="padding: 0.625rem 1rem;">× ${quantita} pezzi</td>
                            <td style="text-align: right; padding: 0.625rem 1rem; font-weight: 700; font-size: 1.1rem;">€ ${totale.toFixed(2)}</td>
                        </tr>` : ''}
                    </tbody>
                </table>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; font-size: 0.85rem;">
                <div style="background: #f9fafb; padding: 0.75rem; border-radius: 0.375rem;">
                    <strong>🏭 Azienda:</strong> ${azienda}
                </div>
                <div style="background: #f9fafb; padding: 0.75rem; border-radius: 0.375rem;">
                    <strong>📏 Min m²:</strong> ${minMq || '-'}
                </div>
            </div>
            
            ${rigaPreventivo.note ? `
            <div style="margin-top: 1rem; padding: 0.75rem; background: #fef3c7; border-radius: 0.375rem; font-size: 0.8rem; color: #92400e;">
                <strong>📝 Note:</strong> ${rigaPreventivo.note}
            </div>` : ''}
        </div>
    `;
    
    mostraModalDettaglioCosti('Zanzariera', dettaglioHTML);
    } catch (e) {
        console.error('❌ Errore in mostraDettaglioCostiZanzariera:', e);
        alert('Errore dettaglio costi: ' + e.message);
    }
}
window.mostraDettaglioCostiZanzariera = mostraDettaglioCostiZanzariera;

/**
 * 🆕 v7.90: Mostra modal generico per dettaglio costi
 */
function mostraModalDettaglioCosti(tipoTitolo, contenutoHTML) {
    // Rimuovi modal esistente se presente
    const existingModal = document.getElementById('modalDettaglioCosti');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Crea overlay e modal
    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'modalDettaglioCosti';
    modalOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        border-radius: 0.75rem;
        max-width: 700px;
        width: 90%;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
        position: relative;
    `;
    
    // Header con titolo e X di chiusura
    const header = document.createElement('div');
    header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 1.5rem;
        border-bottom: 1px solid #e5e7eb;
        background: #f9fafb;
        border-radius: 0.75rem 0.75rem 0 0;
    `;
    header.innerHTML = `
        <h2 style="margin: 0; font-size: 1.25rem; color: #1f2937;">💰 Dettaglio Costi - ${tipoTitolo}</h2>
        <button onclick="window.chiudiModalDettaglioCosti()" style="
            background: none;
            border: none;
            font-size: 1.5rem;
            cursor: pointer;
            color: #6b7280;
            padding: 0.25rem;
            line-height: 1;
        " title="Chiudi">×</button>
    `;
    
    // Corpo del modal
    const body = document.createElement('div');
    body.innerHTML = contenutoHTML;
    
    modalContent.appendChild(header);
    modalContent.appendChild(body);
    modalOverlay.appendChild(modalContent);
    
    // Chiudi cliccando fuori
    modalOverlay.onclick = function(e) {
        if (e.target === modalOverlay) {
            window.chiudiModalDettaglioCosti();
        }
    };
    
    // Chiudi con ESC
    document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape') {
            window.chiudiModalDettaglioCosti();
            document.removeEventListener('keydown', escHandler);
        }
    });
    
    document.body.appendChild(modalOverlay);
    console.log(`📋 Modal dettaglio ${tipoTitolo} aperto`);
}

/**
 * Chiude il modal dettaglio costi
 */
function chiudiModalDettaglioCosti() {
    const modal = document.getElementById('modalDettaglioCosti');
    if (modal) {
        modal.remove();
        console.log('📋 Modal dettaglio chiuso');
    }
}

window.mostraModalDettaglioCosti = mostraModalDettaglioCosti;
window.chiudiModalDettaglioCosti = chiudiModalDettaglioCosti;

// Variabile globale per memorizzare le righe del preventivo per il click
// 🐛 v8.21 FIX: Deve essere window.righePreventivo per essere accessibile ovunque
window.righePreventivo = [];

// Funzione: Ricalcola preventivo (chiamata da select IVA)
// ✅ v8.468: Funzione ricalcola con validazione
function ricalcolaPreventivo(skipValidazione = false) {
    const currentData = window.currentData;
    if (!currentData || !currentData.positions) {
        console.warn('⚠️ Nessun dato progetto caricato');
        return;
    }
    
    // Se skipValidazione è true, procedi direttamente
    if (skipValidazione) {
        renderVistaPreventivo(currentData);
        console.log('🔄 Preventivo ricalcolato (validazione saltata)');
        return;
    }
    
    // Esegui validazione
    const validazione = validaProgetto(currentData.positions, {
        configInfissi: currentData.configInfissi,
        configPersiane: currentData.configPersiane,
        configTapparelle: currentData.configTapparelle,
        configCassonetti: currentData.configCassonetti
    });
    
    console.log('📋 Validazione progetto:', validazione);
    
    // Se ci sono errori critici o warning, mostra popup
    if (validazione.conErrori > 0 || validazione.conWarning > 0) {
        mostraPopupValidazione(validazione, () => {
            // Callback quando utente clicca "Procedi"
            renderVistaPreventivo(currentData);
            console.log('🔄 Preventivo ricalcolato dopo validazione');
        });
    } else {
        // Tutto ok, procedi direttamente
        renderVistaPreventivo(currentData);
        console.log('🔄 Preventivo ricalcolato (tutto completo)');
    }
}

// Alias per compatibilità
window.ricalcolaPreventivo = ricalcolaPreventivo;

// Funzione: Export Excel preventivo (TODO)
function exportPreventivoExcel() {
    console.log('📊 Export Excel preventivo...');
    alert('Funzione Export Excel da implementare con libreria XLSX');
    // TODO: Implementare export con SheetJS
}

// Helper: Normalizza nome azienda (case-insensitive)
function normalizeAziendaName(azienda) {
    // Gestisci casi speciali
    if (!azienda || azienda.trim() === '') {
        return {
            key: 'azienda non specificata',
            display: 'Azienda Non Specificata'
        };
    }
    
    // Converti in lowercase per normalizzazione
    const normalized = azienda.toLowerCase().trim();
    
    // Capitalizza prima lettera di ogni parola per display
    const displayName = normalized
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    
    return {
        key: normalized,      // Per raggruppamento (es: "finstral")
        display: displayName  // Per visualizzazione (es: "Finstral")
    };
}

// Helper: Raggruppa prodotti per azienda
function groupProductsByAzienda(posizioni) {
    const aziendeMap = new Map();
    
    // Helper per creare struttura azienda vuota
    function createEmptyAzienda(displayName) {
        // 🆕 v8.55: Totali DINAMICI da PRODOTTI_CONFIG
        const totali = {};
        PRODOTTI_CONFIG.forEach(cfg => { totali[cfg.totaleKey] = 0; });
        return {
            displayName: displayName,
            prodotti: [],
            totali: totali,
            posizioniCoinvolte: new Set()
        };
    }
    
    // ✅ v7.73: OTTIENI PREZZI DA PREVENTIVO (fonte unica)
    // 🆕 v8.474: ANCHE MISURE dal preventivo (fonte unica)
    // Crea mappa prezzi da righe preventivo per consistenza tra viste
    const prezziMap = new Map();
    
    // Chiama calcolaPreventivo se abbiamo projectData/currentData
    if ((projectData && projectData.posizioni) || (currentData && currentData.posizioni)) {
        const dataPerPreventivo = projectData || currentData;
        try {
            const preventivo = calcolaPreventivo(dataPerPreventivo);
            if (preventivo && preventivo.righe) {
                preventivo.righe.forEach(riga => {
                    // 🆕 v8.55: Tipo prodotto DINAMICO da PRODOTTI_CONFIG
                    let tipoProdotto = 'unknown';
                    const tipoLower = riga.tipo.toLowerCase();
                    const tipoNoSpaces = tipoLower.replace(/\s+/g, '');
                    // ✅ v8.59: PRIMA controlla prodotti specifici, POI alias infisso
                    // (evita che "Persiana F2" venga catturato da includes('f2'))
                    // Step 1: Cerca keyword specifico prodotto (persiana, tapparella, grata...)
                    for (const cfg of PRODOTTI_CONFIG) {
                        if (cfg.key !== 'infisso' && (tipoLower.includes(cfg.key.toLowerCase()) || tipoNoSpaces.includes(cfg.key.toLowerCase()) || tipoLower.includes(cfg.label.toLowerCase()))) {
                            tipoProdotto = cfg.key;
                            break;
                        }
                    }
                    // Step 2: Se nessun prodotto specifico trovato, check infisso + alias
                    if (tipoProdotto === 'unknown') {
                        if (tipoLower.includes('infisso') || tipoLower.includes('hst') || tipoLower.includes('scorrevole') || tipoLower.includes('pf') || tipoLower.includes('f1') || tipoLower.includes('f2')) {
                            tipoProdotto = 'infisso';
                        }
                    }
                    
                    const chiave = `${riga.posizione}-${tipoProdotto}`;
                    prezziMap.set(chiave, {
                        prezzoUnitario: parseFloat(riga.prezzoUnitario) || 0,
                        prezzoTotale: parseFloat(riga.totale) || 0,
                        quantita: riga.quantita || 1,
                        // 🆕 v8.474: Aggiungi misure dal preventivo
                        larghezza: parseInt(riga.larghezza) || 0,
                        altezza: parseInt(riga.altezza) || 0,
                        modello: riga.tipo || 'N/D',
                        tipoAnta: riga.tipoAnta || '',
                        telaio: riga.telaio || '',
                        brmStimato: riga.brmStimato || false,
                        brmOrigine: riga.brmOrigine || 'BRM'
                    });
                });
                console.log(`✅ v8.474 prezziMap caricata: ${prezziMap.size} prodotti con misure`);
            }
        } catch (err) {
            console.warn('⚠️ v8.474 Errore caricamento prezzi/misure da preventivo:', err);
        }
    }
    
    posizioni.forEach((pos, posIndex) => {
        // 🆕 v8.57: DINAMICO - processa TUTTI i prodotti da PRODOTTI_CONFIG
        PRODOTTI_CONFIG.map(c => c.key).forEach(tipoProdotto => {
            // 🆕 v8.55: Estrai prodotto usando PRODOTTI_CONFIG
            const cfgProdotto = PRODOTTI_CONFIG.find(c => c.key === tipoProdotto);
            const prodotto = cfgProdotto ? getProdottoData(pos, cfgProdotto) : pos[tipoProdotto];
            
            // ✅ Usa PRODOTTI_CONFIG per determinare presenza e quantità
            let quantitaProdotto = 0;
            let hasProdotto = false;
            
            if (cfgProdotto) {
                hasProdotto = prodottoPresente(pos, cfgProdotto);
                quantitaProdotto = hasProdotto ? getQtaProdotto(pos, cfgProdotto) : 0;
            } else if (tipoProdotto === 'blindata') {
                // Blindata: esiste se l'oggetto ha dati validi (LNP può essere stringa)
                hasProdotto = prodotto && (parseInt(prodotto.LNP_L) > 0 || parseInt(prodotto.LNP_H) > 0 || prodotto.versione);
                quantitaProdotto = hasProdotto ? 1 : 0;
            } else {
                quantitaProdotto = prodotto ? (parseInt(prodotto.quantita || prodotto.qta) || 1) : 0;
                hasProdotto = prodotto && quantitaProdotto > 0;
            }
            
            if (hasProdotto) {
                // ═══════════════════════════════════════════════════════════════════════
                // 🔌 v7.999: GESTIONE SPECIALE TAPPARELLE + MOTORI
                // ═══════════════════════════════════════════════════════════════════════
                if (tipoProdotto === 'tapparella') {
                    const serveTapparella = prodotto.serveTapparella === true;
                    const serveMotore = prodotto.serveMotore === true;
                    
                    // === PRODOTTO 1: TAPPARELLA (se serveTapparella=true) ===
                    if (serveTapparella) {
                        const aziendaTap = prodotto.azienda || 'Plasticino';
                        const { key: aziendaKey, display: aziendaDisplay } = normalizeAziendaName(aziendaTap);
                        
                        if (!aziendeMap.has(aziendaKey)) {
                            aziendeMap.set(aziendaKey, createEmptyAzienda(aziendaDisplay));
                        }
                        const aziendaData = aziendeMap.get(aziendaKey);
                        
                        // Misure
                        let misureL = parseInt(prodotto.BRM_L) || 0;
                        let misureH = parseInt(prodotto.BRM_H) || 0;
                        
                        // Prezzo tapparella
                        let prezzoTap = null;
                        const chiavePrezzo = `${posIndex + 1}-tapparella`;
                        const prezzoFromMap = prezziMap.get(chiavePrezzo);
                        if (prezzoFromMap) {
                            prezzoTap = prezzoFromMap.prezzoUnitario;
                        }
                        
                        aziendaData.prodotti.push({
                            tipo: 'tapparella',
                            posizione: pos.ambiente || pos.nome || pos.stanza || pos.id,
                            quantita: quantitaProdotto,
                            brm: { L: misureL, H: misureH },
                            fonteMisure: { L: 'BRM_L', H: 'BRM_H', valL: misureL, valH: misureH },
                            modello: prodotto.modello || 'N/D',
                            configurazione: `${prodotto.guida ? 'Guida: ' + prodotto.guida.split(' - ')[0] : ''} ${prodotto.colore || ''}`.trim() || 'Standard',
                            colore: prodotto.colore || 'N/D',
                            note: prodotto.note || '',
                            prezzoUnitario: prezzoTap,
                            prezzoTotale: prezzoTap ? prezzoTap * quantitaProdotto : null,
                            larghezza: misureL,
                            altezza: misureH
                        });
                        
                        aziendaData.totali.tapparelle += quantitaProdotto;
                        aziendaData.posizioniCoinvolte.add(pos.id);
                    }
                    
                    // === PRODOTTO 2: MOTORE SOMFY (se serveMotore=true) ===
                    if (serveMotore && prodotto.motori && prodotto.motori.length > 0) {
                        const aziendaMotore = prodotto.motoreAzienda || 'Somfy';
                        const { key: aziendaKeyMot, display: aziendaDisplayMot } = normalizeAziendaName(aziendaMotore);
                        
                        if (!aziendeMap.has(aziendaKeyMot)) {
                            aziendeMap.set(aziendaKeyMot, createEmptyAzienda(aziendaDisplayMot));
                        }
                        const aziendaDataMot = aziendeMap.get(aziendaKeyMot);
                        
                        const motoreInfo = prodotto.motori[0];
                        const modelloMotore = motoreInfo.modelloId || prodotto.motoreModelloDefault || 'oximo_20';
                        const comandoId = motoreInfo.comandoId || prodotto.comandoDefault || '';
                        
                        // Calcola prezzo kit motore
                        const prezzoKit = SOMFY_PREZZI.calcolaPrezzoKit(motoreInfo);
                        
                        // Genera descrizione configurazione
                        let configParts = [];
                        const motoreDb = SOMFY_PREZZI.getPrezzoMotore(modelloMotore);
                        if (motoreDb) configParts.push(motoreDb.nome.split(' ')[0] + ' ' + motoreDb.nome.split(' ')[1]);
                        const comandoDb = SOMFY_PREZZI.getPrezzoComando(comandoId);
                        if (comandoDb) configParts.push('+ ' + comandoDb.nome.split('+')[0].trim());
                        if (motoreInfo.accessori?.supporto) configParts.push('+ Supporto');
                        if (motoreInfo.accessori?.ruota_60) configParts.push('+ Ruota 60');
                        
                        aziendaDataMot.prodotti.push({
                            tipo: 'motore',
                            posizione: pos.ambiente || pos.nome || pos.stanza || pos.id,
                            quantita: quantitaProdotto,
                            brm: { L: 0, H: 0 },
                            fonteMisure: { L: '-', H: '-', valL: 0, valH: 0 },
                            modello: modelloMotore.replace(/_/g, ' ').toUpperCase(),
                            configurazione: configParts.join(' | ') || 'Solo motore',
                            colore: '-',
                            note: motoreInfo.note || '',
                            prezzoUnitario: prezzoKit.totale,
                            prezzoTotale: prezzoKit.totale * quantitaProdotto,
                            larghezza: 0,
                            altezza: 0,
                            dettaglioPrezzo: prezzoKit.dettaglio  // Per popup dettaglio
                        });
                        
                        aziendaDataMot.totali.motori += quantitaProdotto;
                        aziendaDataMot.posizioniCoinvolte.add(pos.id);
                    }
                    
                    // Se né tapparella né motore, skip
                    return;
                }
                // ═══════════════════════════════════════════════════════════════════════
                
                // Per tutti gli altri prodotti (infissi, persiane, etc.)
                let aziendaRaw;
                if (tipoProdotto === 'blindata') {
                    aziendaRaw = prodotto.azienda || 'Oikos';
                } else {
                    aziendaRaw = prodotto.azienda || 'Azienda Non Specificata';
                }
                
                // ✅ FIX CASE-INSENSITIVE: Normalizza nome azienda
                const { key: aziendaKey, display: aziendaDisplay } = normalizeAziendaName(aziendaRaw);
                
                // Inizializza azienda se non esiste
                if (!aziendeMap.has(aziendaKey)) {
                    aziendeMap.set(aziendaKey, createEmptyAzienda(aziendaDisplay));
                }
                
                const aziendaData = aziendeMap.get(aziendaKey);
                
                // ✅ v7.73: USA PREZZI DA PREVENTIVO (fonte unica)
                let prezzoUnitario = null;
                let prezzoTotale = null;
                
                // Chiave per lookup: posizione (1-based) + tipo prodotto
                const chiavePrezzo = `${posIndex + 1}-${tipoProdotto}`;
                const prezzoFromMap = prezziMap.get(chiavePrezzo);
                
                if (prezzoFromMap && prezzoFromMap.prezzoUnitario > 0) {
                    // ✅ USA PREZZO GIÀ CALCOLATO DA PREVENTIVO
                    prezzoUnitario = prezzoFromMap.prezzoUnitario;
                    prezzoTotale = prezzoFromMap.prezzoTotale;
                    console.log(`✅ v7.73 Prezzo da Preventivo [${chiavePrezzo}]: €${prezzoUnitario.toFixed(2)} × ${quantitaProdotto} = €${prezzoTotale.toFixed(2)}`);
                } else {
                    // ⚠️ FALLBACK: Calcola se non presente in mappa
                    console.log(`⚠️ v7.73 Prezzo non in mappa [${chiavePrezzo}], uso fallback`);
                    
                    // FALLBACK per tapparelle
                    if (tipoProdotto === 'tapparella') {
                        const aziendaLower = (prodotto.azienda || '').toLowerCase();
                        if (LISTINO_PLASTICINO.aziende.includes(aziendaLower) || aziendaLower.includes('plasticino') || aziendaLower.includes('solar') || aziendaLower.includes('estella')) {
                            const L_cm = parseInt(prodotto.brm?.L) || parseInt(prodotto.larghezza) || parseInt(pos.L) || 0;
                            const H_cm = parseInt(prodotto.brm?.H) || parseInt(prodotto.altezza) || parseInt(pos.H) || 0;
                            if (L_cm > 0 && H_cm > 0) {
                                const calcolo = calcolaPrezzoPLASTICINO(L_cm, H_cm, prodotto.modello || null, prodotto.colore_tipo || null);
                                // 🆕 v7.81: Aggiungi guida
                                let prezzoGuida = 0;
                                if (prodotto.guida && prodotto.guida !== '') {
                                    const guidaCalc = calcolaPrezzoGuida(prodotto.guida, prodotto.coloreGuida || 'Argento', H_cm * 10);
                                    prezzoGuida = guidaCalc.prezzo || 0;
                                }
                                prezzoUnitario = calcolo.totale + prezzoGuida;
                                prezzoTotale = prezzoUnitario * quantitaProdotto;
                            }
                        }
                    }
                    
                    // FALLBACK per infissi
                    if (tipoProdotto === 'infisso') {
                        const aziendaLower = (prodotto.azienda || '').toLowerCase();
                        if (aziendaLower.includes('finstral')) {
                            let L_mm = parseInt(pos.misure?.LVT) || parseInt(prodotto.BRM_L) || parseInt(prodotto.brm?.L) || parseInt(prodotto.larghezza) || 0;
                            let H_mm = parseInt(pos.misure?.HVT) || parseInt(prodotto.BRM_H) || parseInt(prodotto.brm?.H) || parseInt(prodotto.altezza) || 0;
                            if (L_mm > 0 && H_mm > 0) {
                                // ✅ v8.461: Usa codiceModello o numero ante
                                let tipoFinstral = "101";
                                const tipoInfisso = (prodotto.tipo || '').toLowerCase();
                                const codiceModello = prodotto.codiceModello || '';
                                const numAnte = estraiNumeroAnte(prodotto.tipo);
                                
                                if (codiceModello && /^\d{3}$/.test(codiceModello)) {
                                    tipoFinstral = codiceModello;
                                } else if (numAnte >= 3) {
                                    tipoFinstral = "420";
                                } else if (numAnte === 2) {
                                    tipoFinstral = "401";
                                } else if (tipoInfisso.includes('fisso') || tipoInfisso.includes('f0')) {
                                    tipoFinstral = "102";
                                }
                                
                                const calcolo = calcolaPrezzoFinstral({
                                    tipo: tipoFinstral,
                                    larghezza: L_mm,
                                    altezza: H_mm,
                                    telaio: prodotto.telaio || "967",
                                    materiale: (prodotto.materiale || '').toLowerCase().includes('alluminio') ? 'alluminio' : 'pvc'
                                });
                                if (!calcolo.errore) {
                                    prezzoUnitario = calcolo.totale;
                                    prezzoTotale = calcolo.totale * quantitaProdotto;
                                }
                            }
                        }
                    }
                }
                
                // ✅ v7.73: Calcola misure corrette CON FONTE per debug
                // 🆕 v8.474: PRIMA prova a usare misure da prezziMap (fonte unica dal preventivo)
                // 🔐 v7.98: Per blindata usa LNP_L/LNP_H
                let misureL = 0, misureH = 0;
                let fonteL = '', fonteH = '';
                let modelloEffettivo = 'N/D';
                
                // 🆕 v8.474: USA MISURE DA PREVENTIVO SE DISPONIBILI
                if (prezzoFromMap && prezzoFromMap.larghezza > 0 && prezzoFromMap.altezza > 0) {
                    misureL = prezzoFromMap.larghezza;
                    misureH = prezzoFromMap.altezza;
                    fonteL = 'PREV';
                    fonteH = 'PREV';
                    modelloEffettivo = prezzoFromMap.modello || 'N/D';
                    console.log(`✅ v8.474 Misure da Preventivo [${chiavePrezzo}]: ${misureL}×${misureH} mm, modello: ${modelloEffettivo}`);
                } else if (tipoProdotto === 'blindata') {
                    // Blindata usa LNP (Luce Netta Passaggio)
                    misureL = parseInt(prodotto.LNP_L) || 0;
                    misureH = parseInt(prodotto.LNP_H) || 0;
                    fonteL = 'LNP_L';
                    fonteH = 'LNP_H';
                } else {
                    // 🆕 v8.473: Fallback BRM intelligente
                    // Se BRM_L è esplicitamente null, non usare brm.L (potrebbe essere vecchio valore)
                    
                    // LARGHEZZA
                    if (prodotto.BRM_L && parseInt(prodotto.BRM_L) > 0) {
                        misureL = parseInt(prodotto.BRM_L);
                        fonteL = 'BRM_L';
                    } else if (prodotto.BRM_L !== null && prodotto.brm?.L && parseInt(prodotto.brm.L) > 0) {
                        misureL = parseInt(prodotto.brm.L);
                        fonteL = 'brm.L';
                    } else if (pos.misure?.LF) {
                        // Fallback: LF + 100
                        misureL = parseInt(pos.misure.LF) + 100;
                        fonteL = 'LF+100';
                    } else if (pos.misure?.LVT) {
                        misureL = parseInt(pos.misure.LVT) + 100;
                        fonteL = 'LVT+100';
                    } else if (prodotto.larghezza) {
                        misureL = parseInt(prodotto.larghezza);
                        fonteL = 'larg';
                    }
                    
                    // ALTEZZA
                    if (prodotto.BRM_H && parseInt(prodotto.BRM_H) > 0) {
                        misureH = parseInt(prodotto.BRM_H);
                        fonteH = 'BRM_H';
                    } else if (prodotto.BRM_H !== null && prodotto.brm?.H && parseInt(prodotto.brm.H) > 0) {
                        misureH = parseInt(prodotto.brm.H);
                        fonteH = 'brm.H';
                    } else if (pos.misure?.HF) {
                        // Fallback: HF + 50
                        misureH = parseInt(pos.misure.HF) + 50;
                        fonteH = 'HF+50';
                    } else if (pos.misure?.HVT) {
                        misureH = parseInt(pos.misure.HVT) + 50;
                        fonteH = 'HVT+50';
                    } else if (prodotto.altezza) {
                        misureH = parseInt(prodotto.altezza);
                        fonteH = 'alt';
                    }
                }
                
                // Aggiungi prodotto (NON tapparelle - già gestite sopra)
                // 🆕 v8.474: modelloEffettivo già impostato da prezziMap se disponibile
                // Calcola solo se non è già stato impostato
                if (modelloEffettivo === 'N/D') {
                    if (tipoProdotto === 'blindata') {
                        modelloEffettivo = prodotto.versione || 'E3';
                    } else if (tipoProdotto === 'cassonetto') {
                        const mat = prodotto.materialeCass || 'PVC';
                        const cod = prodotto.codiceCass || '';
                        modelloEffettivo = cod ? `${mat} ${cod}` : mat;
                    } else if (prodotto.codiceModello?.startsWith('FS')) {
                        // FIN-Slide (HST)
                        modelloEffettivo = `HST ${prodotto.codiceModello.replace('FS', '')}`;
                    } else if (prodotto.tipo) {
                        modelloEffettivo = prodotto.tipo;
                    }
                }
                
                aziendaData.prodotti.push({
                    tipo: tipoProdotto,
                    posizione: pos.ambiente || pos.nome || pos.stanza || pos.id,
                    quantita: quantitaProdotto,
                    brm: { L: misureL, H: misureH },
                    fonteMisure: { L: fonteL, H: fonteH, valL: misureL, valH: misureH },
                    modello: modelloEffettivo,
                    configurazione: tipoProdotto === 'blindata' ? 
                        `${prodotto.tipoAnta === 'doppia' ? '2 Ante' : '1 Anta'} | ${prodotto.sensoApertura || ''} | ${prodotto.controtelaio === 'si' ? 'Con CT' : 'Senza CT'}` :
                        (tipoProdotto === 'cassonetto' ? 
                            (prodotto.isolamentoPosaclima ? 'Con Posaclima' : 'Standard') :
                            getProdottoConfigString(prodotto)),
                    // ✅ v8.11: Per cassonetto usa coloreCass
                    colore: tipoProdotto === 'blindata' ? (prodotto.coloreTelaio || 'RAL8022') : 
                            (tipoProdotto === 'cassonetto' ? (prodotto.coloreCass || 'Bianco') :
                            (prodotto.finitura_int || prodotto.colore || 'N/D')),
                    note: prodotto.note || '',
                    prezzoUnitario: prezzoUnitario,
                    prezzoTotale: prezzoTotale,
                    larghezza: misureL,
                    altezza: misureH
                });
                
                // 🆕 v8.55: Aggiorna totali DINAMICAMENTE
                if (cfgProdotto && aziendaData.totali[cfgProdotto.totaleKey] !== undefined) {
                    aziendaData.totali[cfgProdotto.totaleKey] += quantitaProdotto;
                }
                
                // Aggiungi posizione coinvolta
                aziendaData.posizioniCoinvolte.add(pos.id);
            }
        });
    });
    
    return aziendeMap;
}

// Helper: Ottieni stringa configurazione prodotto
function getProdottoConfigString(prodotto) {
    const parts = [];
    
    if (prodotto.apertura) parts.push(formatAperturaLabel(prodotto.apertura));
    if (prodotto.motorizzazione === 'si') parts.push('Motorizzata');
    if (prodotto.allarme === 'si') parts.push('Con Allarme');
    if (prodotto.materiale) parts.push(prodotto.materiale);
    
    return parts.length > 0 ? parts.join(' | ') : 'Standard';
}

// 🔌 v7.998: Helper per configurazione motore
function getMotoreConfigString(prodotto) {
    const parts = [];
    const motoreInfo = prodotto.motori?.[0] || {};
    
    // Accessori
    if (motoreInfo.accessori?.supporto) parts.push('+ Supporto');
    if (motoreInfo.accessori?.ruota_60) parts.push('+ Ruota 60');
    if (motoreInfo.accessori?.corona_60) parts.push('+ Corona');
    
    // Comando
    if (motoreInfo.comandoId) parts.push(`Cmd: ${motoreInfo.comandoId}`);
    
    return parts.length > 0 ? parts.join(' | ') : 'Solo motore';
}

// Helper: Format apertura label
function formatAperturaLabel(apertura) {
    const labels = {
        'battente_1_anta': '1 Anta',
        'battente_2_ante': '2 Ante',
        'scorrevole': 'Scorrevole',
        'vasistas': 'Vasistas',
        'ribalta': 'Ribalta',
        'basculante': 'Basculante'
    };
    return labels[apertura] || apertura;
}

// 🆕 Render configurazioni prodotti per specifica azienda
// ============================================================================
// 🔄 v8.03: CONFIGURAZIONE SPECIFICA PER AZIENDA
// Mostra SOLO la configurazione relativa ai prodotti di questa azienda
// ============================================================================
function renderConfigurazioniProdottiAzienda(aziendaData, projectData) {
    if (!projectData) return '';
    
    const aziendaNameLower = (aziendaData.displayName || '').toLowerCase();
    const configurazioni = [];
    
    // INFISSI - Solo se questa azienda ha infissi
    if (aziendaData.totali.infissi > 0 && projectData.configInfissi) {
        const cfg = projectData.configInfissi;
        configurazioni.push({
            tipo: 'Infissi',
            icon: '🪟',
            color: '#0ea5e9',
            bgColor: '#f0f9ff',
            fields: [
                { label: 'Azienda', value: cfg.azienda },
                { label: 'Telaio', value: cfg.telaio },
                { label: 'Tipo Anta', value: cfg.tipoAnta },
                { label: 'Finitura INT', value: cfg.finIntMateriale && cfg.finIntCodice ? 
                    `${cfg.finIntMateriale} + ${cfg.finIntCodice}${cfg.finIntDescrizione ? ' - ' + cfg.finIntDescrizione : ''}` : cfg.coloreInterno },
                { label: 'Finitura EST', value: cfg.finEstMateriale && cfg.finEstCodice ? 
                    `${cfg.finEstMateriale} + ${cfg.finEstCodice}${cfg.finEstDescrizione ? ' - ' + cfg.finEstDescrizione : ''}` : cfg.coloreEsterno },
                { label: 'Vetro', value: cfg.vetro },
                { label: 'Maniglia', value: cfg.maniglia },
                { label: 'Tagli Telaio', value: cfg.tagliTelaio },
                { label: 'Allarme', value: cfg.allarme }
            ].filter(f => f.value && f.value !== 'N/D')
        });
    }
    
    // TAPPARELLE - Solo se questa azienda ha tapparelle
    if (aziendaData.totali.tapparelle > 0 && projectData.configTapparelle) {
        const cfg = projectData.configTapparelle;
        configurazioni.push({
            tipo: 'Tapparelle',
            icon: '🔽',
            color: '#10b981',
            bgColor: '#ecfdf5',
            fields: [
                { label: 'Azienda', value: cfg.azienda },
                { label: 'Modello', value: cfg.modello },
                { label: 'Colore', value: cfg.colore },
                { label: 'Tipo Guida', value: cfg.guidaTipo },
                { label: 'Colore Guida', value: cfg.guidaColore }
            ].filter(f => f.value && f.value !== 'N/D')
        });
    }
    
    // MOTORI - Solo se questa azienda ha motori (Somfy)
    if (aziendaData.totali.motori > 0) {
        configurazioni.push({
            tipo: 'Motori',
            icon: '🔌',
            color: '#f59e0b',
            bgColor: '#fffbeb',
            fields: [
                { label: 'Azienda', value: 'Somfy' },
                { label: 'Linea', value: 'Oximo io' },
                { label: 'Tecnologia', value: 'Radio io-homecontrol®' }
            ]
        });
    }
    
    // CASSONETTI - Solo se questa azienda ha cassonetti
    if (aziendaData.totali.cassonetti > 0 && projectData.configCassonetti) {
        const cfg = projectData.configCassonetti;
        configurazioni.push({
            tipo: 'Cassonetti',
            icon: '📦',
            color: '#8b5cf6',
            bgColor: '#f5f3ff',
            fields: [
                { label: 'Azienda', value: cfg.azienda },
                { label: 'Tipo', value: cfg.tipo },
                { label: 'Materiale', value: cfg.materiale },
                { label: 'Finitura', value: cfg.finitura },
                { label: 'Coibentazione', value: cfg.coibentazione }
            ].filter(f => f.value && f.value !== 'N/D')
        });
    }
    
    // PERSIANE - Solo se questa azienda ha persiane
    if (aziendaData.totali.persiane > 0 && projectData.configPersiane) {
        const cfg = projectData.configPersiane;
        configurazioni.push({
            tipo: 'Persiane',
            icon: '🪟',
            color: '#ec4899',
            bgColor: '#fdf2f8',
            fields: [
                { label: 'Azienda', value: cfg.azienda },
                { label: 'Modello', value: cfg.modello },
                { label: 'Colore', value: cfg.colore },
                { label: 'Materiale', value: cfg.materiale }
            ].filter(f => f.value && f.value !== 'N/D')
        });
    }
    
    // ZANZARIERE - Solo se questa azienda ha zanzariere
    if (aziendaData.totali.zanzariere > 0 && projectData.configZanzariere) {
        const cfg = projectData.configZanzariere;
        configurazioni.push({
            tipo: 'Zanzariere',
            icon: '🦟',
            color: '#06b6d4',
            bgColor: '#ecfeff',
            fields: [
                { label: 'Azienda', value: cfg.azienda },
                { label: 'Modello PF', value: cfg.modelloPF },
                { label: 'Modello F', value: cfg.modelloF },
                { label: 'Colore', value: cfg.colore }
            ].filter(f => f.value && f.value !== 'N/D')
        });
    }
    
    // BLINDATE - Solo se questa azienda ha blindate
    if (aziendaData.totali.blindate > 0 && projectData.configBlindate) {
        const cfg = projectData.configBlindate;
        configurazioni.push({
            tipo: 'Blindate',
            icon: '🔐',
            color: '#dc2626',
            bgColor: '#fef2f2',
            fields: [
                { label: 'Azienda', value: cfg.azienda || 'Oikos' },
                { label: 'Versione', value: cfg.versione },
                { label: 'Classe', value: cfg.classe },
                { label: 'Pannello EST', value: cfg.pannelloEst },
                { label: 'Pannello INT', value: cfg.pannelloInt }
            ].filter(f => f.value && f.value !== 'N/D')
        });
    }
    
    // Se non ci sono configurazioni, non mostrare nulla
    if (configurazioni.length === 0) return '';
    
    // 🔄 v8.03: Genera HTML con box separati per ogni tipo prodotto
    return `
        <div class="azienda-configurazioni">
            <h3 class="azienda-config-title">
                ⚙️ Configurazione Prodotti ${aziendaData.displayName}
            </h3>
            <div class="azienda-config-grid">
                ${configurazioni.map(config => `
                    <div class="azienda-config-box" style="background: ${config.bgColor}; border-left: 4px solid ${config.color};">
                        <div class="azienda-config-header" style="color: ${config.color};">
                            <span>${config.icon}</span> ${config.tipo}
                        </div>
                        <div class="azienda-config-fields">
                            ${config.fields.map(field => `
                                <div class="azienda-config-field">
                                    <span class="azienda-config-label">${field.label}:</span>
                                    <span class="azienda-config-value">${field.value}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// Render singola card azienda
function renderAziendaCard(aziendaName, aziendaData, projectData) {
    const totaleProdotti = aziendaData.prodotti.length;
    const totaleQuantita = aziendaData.prodotti.reduce((sum, p) => sum + p.quantita, 0);
    const posizioniCount = aziendaData.posizioniCoinvolte.size;
    const totaleEuro = aziendaData.prodotti.reduce((sum, p) => sum + (p.prezzoTotale || 0), 0);
    
    // 💰 v8.14: Calcola totale netto con sconto fornitore
    const scontoFornitore = SCONTI_FORNITORI.getSconto(aziendaName);
    const totaleNetto = totaleEuro * (1 - scontoFornitore / 100);
    
    // 🆕 v8.55: Badge DINAMICI da PRODOTTI_CONFIG
    const badges = [];
    PRODOTTI_CONFIG.forEach(cfg => {
        const n = aziendaData.totali[cfg.totaleKey] || 0;
        if (n > 0) badges.push({ label: `${n} ${cfg.label}`, class: cfg.totaleKey });
    });
    
    // 🆕 v8.03: Estrai configurazioni prodotti per questa azienda
    const configHTML = renderConfigurazioniProdottiAzienda(aziendaData, projectData);
    
    return `
        <div class="azienda-card">
            <div class="azienda-header" style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
                <div class="azienda-header-left">
                    <div class="azienda-name" style="font-size: 1.4rem;">
                        <span class="azienda-name-icon">🏭</span>
                        ${aziendaName}
                    </div>
                    <div class="azienda-badges" style="margin-top: 0.5rem;">
                        ${badges.map(badge => `
                            <span class="azienda-badge ${badge.class}">${badge.label}</span>
                        `).join('')}
                    </div>
                </div>
                <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                    <div style="background: #fef3c7; color: #92400e; padding: 0.75rem 1rem; border-radius: 8px; text-align: right;">
                        <div style="font-size: 0.7rem; text-transform: uppercase;">Listino</div>
                        <div style="font-size: 1.2rem; font-weight: 700;">€ ${totaleEuro.toFixed(2)}</div>
                        <div style="font-size: 0.7rem;">-${scontoFornitore}%</div>
                    </div>
                    <div class="azienda-totale-box" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 0.75rem 1rem; border-radius: 8px; text-align: right;">
                        <div style="font-size: 0.7rem; text-transform: uppercase; opacity: 0.9;">Tuo Costo</div>
                        <div style="font-size: 1.4rem; font-weight: 700;">€ ${totaleNetto.toFixed(2)}</div>
                        <div style="font-size: 0.7rem; opacity: 0.85;">${totaleQuantita} pz</div>
                    </div>
                </div>
            </div>

            ${configHTML}

            <h3 style="font-size: 1rem; font-weight: 600; color: #1f2937; margin: 1.5rem 0 1rem; display: flex; align-items: center; gap: 0.5rem;">
                📋 Lista Prodotti
            </h3>
            <div style="overflow-x: auto;">
                <table class="azienda-prodotti-table-v2">
                    <thead>
                        <tr>
                            <th style="width: 100px;">Tipo</th>
                            <th>Modello</th>
                            <th style="width: 120px;">Misure (mm)</th>
                            <th style="width: 50px; text-align: center;">Qty</th>
                            <th style="width: 90px; text-align: right;">Listino</th>
                            <th style="width: 90px; text-align: right; background: #d1fae5;">Netto</th>
                            <th style="width: 100px;">Posizione</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${aziendaData.prodotti.map(prod => {
                            const prezzoNetto = (prod.prezzoTotale || 0) * (1 - scontoFornitore / 100);
                            return `
                            <tr>
                                <td>
                                    <span class="product-type-badge ${prod.tipo}">
                                        ${prod.tipo.charAt(0).toUpperCase() + prod.tipo.slice(1)}
                                    </span>
                                </td>
                                <td>
                                    <div style="font-weight: 600; color: #1f2937;">${prod.modello}</div>
                                    ${prod.configurazione && prod.configurazione !== 'Standard' ? 
                                        `<div style="font-size: 0.8rem; color: #6b7280; margin-top: 2px;">${prod.configurazione}</div>` : ''}
                                </td>
                                <td style="font-family: monospace; font-weight: 500;">
                                    ${prod.larghezza && prod.altezza && prod.larghezza > 0 ? 
                                        `${prod.larghezza} × ${prod.altezza}` : 
                                        '-'}
                                </td>
                                <td style="text-align: center; font-weight: 600; color: #10b981;">${prod.quantita}</td>
                                <td style="text-align: right; font-weight: 500; color: #92400e;">
                                    ${prod.prezzoTotale !== null && prod.prezzoTotale > 0 ? 
                                        `€ ${prod.prezzoTotale.toFixed(2)}` : '-'}
                                </td>
                                <td style="text-align: right; font-weight: 700; color: #059669; background: #ecfdf5;">
                                    ${prezzoNetto > 0 ? `€ ${prezzoNetto.toFixed(2)}` : '-'}
                                </td>
                                <td>
                                    <span class="position-tag">${prod.posizione}</span>
                                </td>
                            </tr>
                        `}).join('')}
                    </tbody>
                    <tfoot>
                        <tr class="azienda-totale-row">
                            <td colspan="3" style="font-weight: 700; color: #065f46;">
                                TOTALE ${aziendaName.toUpperCase()}
                            </td>
                            <td style="text-align: center; font-weight: 700; color: #065f46;">${totaleQuantita}</td>
                            <td style="text-align: right; font-weight: 600; color: #92400e;">
                                € ${totaleEuro.toFixed(2)}
                            </td>
                            <td style="text-align: right; font-weight: 700; font-size: 1.1rem; color: #059669; background: #d1fae5;">
                                € ${totaleNetto.toFixed(2)}
                            </td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div class="azienda-actions" style="margin-top: 1.5rem;">
                <button class="azienda-action-btn primary" onclick="exportAziendaExcel('${aziendaName}')">
                    📊 Export Excel
                </button>
                <button class="azienda-action-btn" onclick="copyAziendaText('${aziendaName}')">
                    📋 Copia Testo
                </button>
                <button class="azienda-action-btn" onclick="window.print()">
                    🖨️ Stampa
                </button>
            </div>

            <div class="azienda-note" style="margin-top: 1.5rem;">
                <div class="azienda-note-title">
                    📝 Note Fornitore
                </div>
                <textarea 
                    placeholder="Aggiungi note per questo fornitore (tempi consegna, condizioni, referente, numero ordine Odoo...)"
                    id="note-${aziendaName.replace(/\s+/g, '-')}"
                    onchange="saveAziendaNote('${aziendaName}', this.value)"
                ></textarea>
            </div>
        </div>
    `;
}

// Funzioni export (stub - da implementare completamente se necessario)
function exportAziendaExcel(aziendaName) {
    console.log(`📊 Export Excel per ${aziendaName} - Da implementare`);
    alert(`Funzione Export Excel per ${aziendaName}\nDa implementare con libreria XLSX`);
}

function copyAziendaText(aziendaName) {
    console.log(`📋 Copia testo per ${aziendaName}`);
    alert(`Testo copiato per ${aziendaName}!\n(Implementare copia negli appunti)`);
}

function saveAziendaNote(aziendaName, note) {
    console.log(`💾 Salvataggio note per ${aziendaName}:`, note);
    // Salva in localStorage
    const notesKey = `azienda-notes-${aziendaName}`;
    localStorage.setItem(notesKey, note);
}

// ============================================================================
// POPOLA FILTRI PIANO E STANZA
// ============================================================================
function populateFilters() {
    const pianiSet = new Set();
    const stanzeSet = new Set();
    
    allPositionsData.forEach(pos => {
        if (pos.piano) pianiSet.add(pos.piano);
        if (pos.stanza) stanzeSet.add(pos.stanza);
    });
    
    // Popola select piano
    const filterPiano = document.getElementById('filterPiano');
    filterPiano.innerHTML = '<option value="">Tutti i piani</option>';
    Array.from(pianiSet).sort().forEach(piano => {
        filterPiano.innerHTML += `<option value="${piano}">${piano}</option>`;
    });
    
    // Popola select stanza
    const filterStanza = document.getElementById('filterStanza');
    filterStanza.innerHTML = '<option value="">Tutte le stanze</option>';
    Array.from(stanzeSet).sort().forEach(stanza => {
        filterStanza.innerHTML += `<option value="${stanza}">${stanza}</option>`;
    });
}

// ============================================================================
// FILTRA POSIZIONI
// ============================================================================
function filterPositions() {
    const piano = document.getElementById('filterPiano').value;
    const stanza = document.getElementById('filterStanza').value;
    
    filteredPositions = allPositionsData.filter(pos => {
        const matchPiano = !piano || pos.piano === piano;
        const matchStanza = !stanza || pos.stanza === stanza;
        return matchPiano && matchStanza;
    });
    
    // Reset index
    currentPositionIndex = 0;
    
    // Re-render
    renderPositionsList();
    if (filteredPositions.length > 0) {
        renderPositionDetail(0);
    }
}

// ============================================================================
// RENDER LISTA POSIZIONI SIDEBAR
// ============================================================================
function renderPositionsList() {
    const container = document.getElementById('positionsList');
    const countSpan = document.getElementById('positionsCount');
    
    countSpan.textContent = `(${filteredPositions.length})`;
    
    // 🆕 v8.67: Messaggio quando 0 posizioni
    if (filteredPositions.length === 0) {
        container.innerHTML = `
            <div style="padding: 1.5rem; text-align: center; color: #94a3b8;">
                <div style="font-size: 2rem; margin-bottom: 0.5rem;">📋</div>
                <div style="font-size: 0.9rem; margin-bottom: 0.75rem;">Nessuna posizione</div>
                <div style="font-size: 0.8rem; color: #cbd5e1;">Clicca <strong>+ Nuova</strong> per aggiungere</div>
            </div>
        `;
        // Pulisci anche il dettaglio
        const detailCard = document.getElementById('positionDetailCard');
        if (detailCard) {
            detailCard.innerHTML = `
                <div style="padding: 3rem; text-align: center; color: #94a3b8;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">🏗️</div>
                    <h3 style="color: #64748b; margin-bottom: 0.5rem;">Progetto Vuoto</h3>
                    <p style="font-size: 0.9rem;">Aggiungi la prima posizione con il pulsante <strong>+ Nuova</strong></p>
                </div>
            `;
        }
        return;
    }
    
    container.innerHTML = filteredPositions.map((pos, index) => `
        <div class="position-list-item ${index === currentPositionIndex ? 'active' : ''}" 
             onclick="selectPosition(${index})">
            <div class="position-item-details" style="padding: 0.75rem;">
                <strong>${pos.ambiente || pos.nome || pos.stanza || 'Posizione ' + (index + 1)}</strong>
            </div>
        </div>
    `).join('');
}

// ============================================================================
// SELEZIONA POSIZIONE
// ============================================================================
function selectPosition(index) {
    currentPositionIndex = index;
    renderPositionsList();
    renderPositionDetail(index);
    
    // Scroll to top della card
    document.querySelector('.position-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ============================================================================
// RENDER CONFIG GLOBALE INFISSI
// ============================================================================
/**
 * 🚫 v7.94: Funzione DEPRECATA - Config globale ora è dentro i tabs
 * @deprecated Use renderConfigGlobaleInTab() instead
 */
function renderConfigGlobale() {
    console.log('⚠️ v7.94: renderConfigGlobale() DEPRECATA - Config ora dentro i tabs prodotto');
    // Non fare nulla - la config globale ora è dentro ogni tab
    return;
}

function toggleConfigGlobale() {
    const content = document.getElementById('configContent');
    const toggle = document.getElementById('configToggle');
    
    if (!content || !toggle) return;
    
    content.classList.toggle('collapsed');
    toggle.classList.toggle('collapsed');
}

/**
 * 🆕 v7.94: Toggle per config globale dentro i tabs
 */
function toggleConfigGlobaleTab(tipo) {
    const content = document.getElementById(`configContent_${tipo}`);
    const toggle = document.getElementById(`configToggle_${tipo}`);
    
    if (!content || !toggle) return;
    
    content.classList.toggle('collapsed');
    toggle.classList.toggle('collapsed');
}

/**
 * 🆕 v7.94: Genera HTML per Configurazione Globale DENTRO il tab prodotto
 */
function renderConfigGlobaleInTab(tipo, config) {
    if (!config || Object.keys(config).length === 0) {
        return `
            <div class="config-globale-intab">
                <div class="config-globale-header-intab" onclick="toggleConfigGlobaleTab('${tipo}')">
                    <div class="config-globale-title-intab">
                        <span>⚙️</span>
                        <span>CONFIGURAZIONE GLOBALE ${tipo.toUpperCase()}</span>
                    </div>
                    <div class="config-globale-toggle-intab" id="configToggle_${tipo}">▼</div>
                </div>
                <div class="config-globale-content-intab" id="configContent_${tipo}">
                    <p style="color: #9ca3af; font-style: italic; padding: 1rem;">Nessuna configurazione globale</p>
                </div>
            </div>
        `;
    }
    
    let items = [];
    
    if (tipo === 'infisso') {
        // Costruisci finitura INT completa
        const finIntCompleta = config.finituraInt ? 
            `${config.finituraInt}${config.coloreInt ? ' + ' + config.coloreInt : ''}` : 'N/D';
        const finEstCompleta = config.finituraEst ? 
            `${config.finituraEst}${config.coloreEst ? ' + ' + config.coloreEst : ''}` : 'N/D';
        const manigliaCompleta = config.maniglia ? 
            `${config.maniglia}${config.coloreManiglia ? ' + ' + config.coloreManiglia : ''}` : 'N/D';
        const tagliCompleti = config.tagliTelaio ? 
            `${config.tagliTelaio}${config.codTagli?.length > 0 ? ' [' + config.codTagli.join(', ') + ']' : ''}` : 'N/D';
        
        items = [
            { label: '🏭 AZIENDA', value: config.azienda || 'N/D' },
            { label: '🪟 TELAIO', value: config.telaio || 'N/D' },
            { label: '🎨 FINITURA INT', value: finIntCompleta },
            { label: '🎨 FINITURA EST', value: finEstCompleta },
            { label: '📐 TIPO ANTA', value: config.tipoAnta || 'N/D' },
            { label: '💎 VETRO', value: config.vetro || 'N/D' },
            { label: '🔧 MANIGLIA', value: manigliaCompleta },
            { label: '✂️ TAGLI TELAIO', value: tagliCompleti },
            { label: '🔔 ALLARME', value: config.allarme || 'N/D' }
        ];
    } else if (tipo === 'persiana') {
        items = [
            { label: '🏭 AZIENDA', value: config.azienda || 'N/D' },
            { label: '📋 MODELLO', value: config.modello || 'N/D' },
            { label: '🎨 COLORE PERSIANA', value: config.colorePersiana || 'N/D' },
            { label: '🔧 FISSAGGIO', value: config.fissaggio || 'N/D' }
        ];
        
        // Mostra colore telaio SOLO se ha un valore (esportato solo se fissaggio=telaio)
        if (config.coloreTelaio) {
            items.push({ label: '🎨 COLORE TELAIO', value: config.coloreTelaio });
        }
        
        items.push(
            { label: '📐 TIPO', value: config.tipo || 'N/D' },
            { label: '🚪 APERTURA', value: config.apertura || 'N/D' },
            { label: '📏 BATTUTA', value: config.battuta || 'N/D' }
        );
    } else if (tipo === 'tapparella') {
        items = [
            { label: '🏭 AZIENDA', value: config.azienda || 'N/D' },
            { label: '📋 MODELLO TELO', value: config.modelloTelo || 'N/D' },
            { label: '🎨 COLORE TELO', value: config.coloreTelo || 'N/D' },
            { label: '⚙️ TIPO MANOVRA', value: config.tipoManovra || 'N/D' },
            { label: '🔧 MOTORE', value: config.motore || 'N/D' }
        ];
    } else if (tipo === 'cassonetto') {
        // 🔧 v8.11: Usa campi corretti da configCassonetti
        const modelloCompleto = config.materialeCass && config.codiceCass 
            ? `${config.materialeCass} ${config.codiceCass}` 
            : (config.modello || 'N/D');
        const coloreCompleto = config.coloreCass || config.gruppoColoreCass || config.colore || 'N/D';
        const isolamento = config.codiceIsolamento || 'N/D';
        
        items = [
            { label: '🏭 AZIENDA', value: config.azienda || 'N/D' },
            { label: '📋 MODELLO', value: modelloCompleto },
            { label: '🎨 COLORE', value: coloreCompleto },
            { label: '📐 TIPO', value: config.tipo || 'N/D' },
            { label: '🧊 ISOLAMENTO', value: isolamento }
        ];
    } else if (tipo === 'zanzariera') {
        items = [
            { label: '🏭 AZIENDA', value: config.azienda || 'N/D' },
            { label: '📋 MODELLO', value: config.modello || 'N/D' },
            { label: '🎨 COLORE', value: config.colore || 'N/D' },
            { label: '📐 TIPO', value: config.tipo || 'N/D' }
        ];
    }
    
    return `
        <div class="config-globale-intab">
            <div class="config-globale-header-intab" onclick="toggleConfigGlobaleTab('${tipo}')">
                <div class="config-globale-title-intab">
                    <span>⚙️</span>
                    <span>CONFIGURAZIONE GLOBALE ${tipo.toUpperCase()}</span>
                </div>
                <div class="config-globale-toggle-intab" id="configToggle_${tipo}">▼</div>
            </div>
            <div class="config-globale-content-intab" id="configContent_${tipo}">
                ${items.map(item => `
                    <div class="config-item-intab">
                        <div class="config-item-label-intab">${item.label}</div>
                        <div class="config-item-value-intab ${item.value === 'N/D' ? 'empty' : ''}">${item.value}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// ============================================================================
// ✅ v7.73: FUNZIONI MENU CONFIGURAZIONE PRODOTTI
// ============================================================================

/**
 * Switch tra tab categorie
 */
function switchConfigTab(categoria) {
    // Rimuovi active da tutti i tab e pannelli
    document.querySelectorAll('.config-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.config-panel').forEach(panel => panel.classList.remove('active'));
    
    // Attiva tab cliccato
    const tabs = document.querySelectorAll('.config-tab');
    tabs.forEach(tab => {
        if (tab.textContent.toLowerCase().includes(categoria.substring(0, 4))) {
            tab.classList.add('active');
        }
    });
    
    // Attiva pannello
    const panelId = `configPanel${categoria.charAt(0).toUpperCase() + categoria.slice(1)}`;
    const panel = document.getElementById(panelId);
    if (panel) {
        panel.classList.add('active');
        renderConfigPanel(categoria);
    }
}

/**
 * Render pannello configurazione
 */
function renderConfigPanel(categoria) {
    const panelId = `configPanel${categoria.charAt(0).toUpperCase() + categoria.slice(1)}`;
    const panel = document.getElementById(panelId);
    
    if (!panel || !DATABASE_CONFIGURAZIONI[categoria]) return;
    
    const config = DATABASE_CONFIGURAZIONI[categoria];
    const valoriSalvati = configCorrente[categoria] || {};
    
    console.log(`📋 v7.80 renderConfigPanel(${categoria}):`, JSON.stringify(valoriSalvati));
    
    // Helper per escape HTML
    const escapeHtml = (str) => {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };
    
    let html = '<div class="config-fields-grid">';
    
    for (const [campo, configCampo] of Object.entries(config)) {
        const valoreSalvato = valoriSalvati[campo] || '';
        
        // Opzioni dal config
        let opzioni = configCampo.options || [];
        
        // v7.80: Matching migliorato - cerca esatto o contenuto
        const valoreLower = (valoreSalvato || '').toString().toLowerCase().trim();
        let matchedOption = null;
        let isInOptions = false;
        
        if (valoreLower) {
            // Prima cerca match esatto
            matchedOption = opzioni.find(opt => opt.toLowerCase() === valoreLower);
            
            // Se non trovato, cerca match parziale
            if (!matchedOption) {
                matchedOption = opzioni.find(opt => 
                    opt.toLowerCase().includes(valoreLower) || 
                    valoreLower.includes(opt.toLowerCase())
                );
            }
            
            isInOptions = !!matchedOption;
        }
        
        const isCustom = valoreSalvato && !isInOptions;
        
        console.log(`   📌 ${campo}: "${valoreSalvato}" → match: ${matchedOption || 'CUSTOM'}`);
        
        html += `
            <div class="config-field ${valoreSalvato ? 'modified' : ''}" data-campo="${campo}">
                <div class="config-field-label">${configCampo.label}</div>
                <select class="config-select" 
                        onchange="handleConfigSelect(this, '${categoria}', '${campo}')"
                        data-categoria="${categoria}"
                        data-campo="${campo}">
                    <option value="">-- Seleziona --</option>
                    ${opzioni.map(opt => {
                        const isSelected = matchedOption && opt.toLowerCase() === matchedOption.toLowerCase();
                        return `<option value="${escapeHtml(opt)}" ${isSelected ? 'selected' : ''}>${escapeHtml(opt)}</option>`;
                    }).join('')}
                    ${configCampo.allowCustom ? `<option value="__custom__" ${isCustom ? 'selected' : ''}>✏️ Altro...</option>` : ''}
                </select>
                ${configCampo.allowCustom ? `
                    <input type="text" 
                           class="config-custom-input ${isCustom ? '' : 'hidden'}"
                           placeholder="Inserisci valore..."
                           value="${escapeHtml(isCustom ? valoreSalvato : '')}"
                           onchange="handleConfigCustomInput(this, '${categoria}', '${campo}')"
                           data-categoria="${categoria}"
                           data-campo="${campo}">
                ` : ''}
            </div>
        `;
    }
    
    html += '</div>';
    panel.innerHTML = html;
}

/**
 * Gestione selezione da dropdown
 */
function handleConfigSelect(select, categoria, campo) {
    const value = select.value;
    const customInput = select.parentElement.querySelector('.config-custom-input');
    
    if (value === '__custom__') {
        if (customInput) {
            customInput.classList.remove('hidden');
            customInput.focus();
        }
    } else {
        if (customInput) {
            customInput.classList.add('hidden');
            customInput.value = '';
        }
        
        if (!configCorrente[categoria]) configCorrente[categoria] = {};
        configCorrente[categoria][campo] = value;
        
        // Aggiorna UI
        const fieldElement = select.closest('.config-field');
        if (value) {
            fieldElement.classList.add('modified');
        } else {
            fieldElement.classList.remove('modified');
        }
        
        console.log(`📝 Config ${categoria}.${campo} = "${value}"`);
        
        // Gestione campo collegato rivestimentoEst → coloreEst
        if (categoria === 'infissi' && campo === 'rivestimentoEst') {
            aggiornaOpzioniColoreEsterno(value);
        }
    }
}

/**
 * Gestione input custom
 */
function handleConfigCustomInput(input, categoria, campo) {
    const value = input.value.trim();
    
    if (!configCorrente[categoria]) configCorrente[categoria] = {};
    configCorrente[categoria][campo] = value;
    
    const fieldElement = input.closest('.config-field');
    if (value) {
        fieldElement.classList.add('modified');
    } else {
        fieldElement.classList.remove('modified');
    }
    
    console.log(`📝 Config ${categoria}.${campo} = "${value}" (custom)`);
}

/**
 * Aggiorna opzioni colore esterno in base al rivestimento
 */
function aggiornaOpzioniColoreEsterno(rivestimento) {
    const config = DATABASE_CONFIGURAZIONI.infissi.coloreEst;
    const selectColoreEst = document.querySelector('[data-categoria="infissi"][data-campo="coloreEst"]');
    
    if (!selectColoreEst) return;
    
    const isAlluminio = rivestimento && !rivestimento.toUpperCase().startsWith('NO');
    const opzioni = isAlluminio ? config.optionsAlluminio : config.optionsPVC;
    const labelTipo = isAlluminio ? '(Alu ◇◆)' : '(PVC ○●)';
    
    const valoreCorrente = configCorrente.infissi?.coloreEst || '';
    
    let html = `<option value="">-- Seleziona ${labelTipo} --</option>`;
    opzioni.forEach(opt => {
        html += `<option value="${opt}" ${valoreCorrente === opt ? 'selected' : ''}>${opt}</option>`;
    });
    if (config.allowCustom) {
        html += `<option value="__custom__">✏️ Altro...</option>`;
    }
    
    selectColoreEst.innerHTML = html;
    
    const labelElement = selectColoreEst.closest('.config-field')?.querySelector('.config-field-label');
    if (labelElement) {
        labelElement.textContent = `🎨 Colore Est ${labelTipo}`;
    }
    
    console.log(`🔄 Colore Est aggiornato per ${isAlluminio ? 'Alluminio' : 'PVC'}`);
}

/**
 * Salva configurazione globale
 */
function salvaConfigGlobaleMenu() {
    if (!projectData) {
        showAlert('error', '❌ Nessun progetto caricato');
        return;
    }
    
    projectData.configInfissi = configCorrente.infissi;
    projectData.configPersiane = configCorrente.persiane;
    projectData.configTapparelle = configCorrente.tapparelle;
    projectData.configCassonetti = configCorrente.cassonetti;
    projectData.configZanzariere = configCorrente.zanzariere;
    
    showAlert('success', '✅ Configurazione globale salvata!');
    console.log('💾 Configurazione salvata:', configCorrente);
}

/**
 * Reset configurazione
 */
function resetConfigGlobaleMenu() {
    if (!confirm('Resettare tutti i valori di configurazione?')) return;
    
    configCorrente = {
        infissi: {},
        persiane: {},
        tapparelle: {},
        cassonetti: {},
        zanzariere: {}
    };
    
    // Re-render pannello attivo
    const activePanel = document.querySelector('.config-panel.active');
    if (activePanel) {
        const categoria = activePanel.id.replace('configPanel', '').toLowerCase();
        renderConfigPanel(categoria);
    }
    
    showAlert('success', '🔄 Configurazione resettata');
}

/**
 * Inizializza menu configurazione
 */
function initConfigMenu() {
    console.log('🔄 v8.17 initConfigMenu() chiamato');
    console.log('   📦 projectData exists:', !!projectData);
    console.log('   📦 projectData.configInfissi:', projectData?.configInfissi);
    
    // Mostra container (opzionale - potrebbe non esistere in tutte le viste)
    const container = document.getElementById('configMenuContainer');
    if (container) {
        container.style.display = 'block';
    } else {
        // v8.16: Non è un errore, il container potrebbe non essere presente in questa vista
        console.log('ℹ️ configMenuContainer non presente (normale in alcune viste)');
    }
    
    // ✅ v7.80: Carica config da progetto
    if (projectData && projectData.configInfissi) {
        configCorrente = {
            infissi: { ...projectData.configInfissi },
            persiane: { ...(projectData.configPersiane || {}) },
            tapparelle: { ...(projectData.configTapparelle || {}) },
            cassonetti: { ...(projectData.configCassonetti || {}) },
            zanzariere: { ...(projectData.configZanzariere || {}) }
        };
        
        console.log('✅ v7.80 configCorrente caricato:');
        console.log('   📦 azienda:', configCorrente.infissi.azienda);
        console.log('   📦 telaio:', configCorrente.infissi.telaio);
    } else {
        console.warn('⚠️ v7.80 projectData o configInfissi mancante!');
        configCorrente = {
            infissi: {},
            persiane: {},
            tapparelle: {},
            cassonetti: {},
            zanzariere: {}
        };
    }
    
    // Render pannello iniziale
    renderConfigPanel('infissi');
    
    console.log('⚙️ Menu configurazione inizializzato v7.80');
}

// ============================================================================
// v7.997: CONFIGURAZIONE PRODOTTI GLOBALE - VERSIONE UFFICIO
// ============================================================================

/**
 * Switch tab configurazione - versione Ufficio
 */
function switchConfigTabUfficio(categoria) {
    // Rimuovi active da tutti i tab e pannelli UFFICIO
    document.querySelectorAll('#configGlobaleUfficioContainer .config-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('#configGlobaleUfficioContainer .config-panel').forEach(panel => panel.classList.remove('active'));
    
    // Attiva tab cliccato
    const tabs = document.querySelectorAll('#configGlobaleUfficioContainer .config-tab');
    tabs.forEach(tab => {
        if (tab.textContent.toLowerCase().includes(categoria.substring(0, 4))) {
            tab.classList.add('active');
        }
    });
    
    // Attiva pannello
    const panelId = `configPanel${categoria.charAt(0).toUpperCase() + categoria.slice(1)}Ufficio`;
    const panel = document.getElementById(panelId);
    if (panel) {
        panel.classList.add('active');
        renderConfigPanelUfficio(categoria);
    }
}

/**
 * Render pannello configurazione - versione Ufficio
 */
function renderConfigPanelUfficio(categoria) {
    const panelId = `configPanel${categoria.charAt(0).toUpperCase() + categoria.slice(1)}Ufficio`;
    const panel = document.getElementById(panelId);
    
    if (!panel || !DATABASE_CONFIGURAZIONI[categoria]) return;
    
    const config = DATABASE_CONFIGURAZIONI[categoria];
    const valoriSalvati = configCorrente[categoria] || {};
    
    console.log(`📋 v7.997 renderConfigPanelUfficio(${categoria}):`, JSON.stringify(valoriSalvati));
    
    // Helper per escape HTML
    const escapeHtml = (str) => {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };
    
    let html = '<div class="config-fields-grid">';
    
    for (const [campo, configCampo] of Object.entries(config)) {
        const valoreSalvato = valoriSalvati[campo] || '';
        
        // Opzioni dal config
        let opzioni = configCampo.options || [];
        
        // Matching migliorato
        const valoreLower = (valoreSalvato || '').toString().toLowerCase().trim();
        let matchedOption = null;
        
        if (valoreLower) {
            matchedOption = opzioni.find(opt => opt.toLowerCase() === valoreLower);
            if (!matchedOption) {
                matchedOption = opzioni.find(opt => 
                    opt.toLowerCase().includes(valoreLower) || 
                    valoreLower.includes(opt.toLowerCase())
                );
            }
        }
        
        const isInOptions = !!matchedOption;
        const displayValue = matchedOption || valoreSalvato;
        const hasValue = displayValue && displayValue.trim() !== '';
        const checkmark = hasValue ? '✓' : '';
        const labelClass = hasValue ? 'config-label filled' : 'config-label';
        
        html += `
            <div class="config-field">
                <label class="${labelClass}">
                    ${configCampo.icon || ''} ${configCampo.label} ${checkmark}
                </label>
                <select class="config-select" 
                        data-categoria="${categoria}" 
                        data-campo="${campo}"
                        onchange="updateConfigFieldUfficio(this)">
                    <option value="">-- Seleziona --</option>
                    ${opzioni.map(opt => `
                        <option value="${escapeHtml(opt)}" ${opt.toLowerCase() === (matchedOption || '').toLowerCase() ? 'selected' : ''}>
                            ${escapeHtml(opt)}
                        </option>
                    `).join('')}
                </select>
            </div>
        `;
    }
    
    html += '</div>';
    panel.innerHTML = html;
}

/**
 * Update campo configurazione - versione Ufficio
 */
function updateConfigFieldUfficio(select) {
    const categoria = select.dataset.categoria;
    const campo = select.dataset.campo;
    const valore = select.value;
    
    if (!configCorrente[categoria]) {
        configCorrente[categoria] = {};
    }
    
    configCorrente[categoria][campo] = valore;
    
    // Aggiorna label con checkmark
    const label = select.previousElementSibling;
    if (valore) {
        label.classList.add('filled');
        if (!label.textContent.includes('✓')) {
            label.textContent = label.textContent + ' ✓';
        }
    } else {
        label.classList.remove('filled');
        label.textContent = label.textContent.replace(' ✓', '');
    }
    
    console.log(`📝 Config Ufficio: ${categoria}.${campo} = ${valore}`);
}

/**
 * Salva configurazione - versione Ufficio
 */
function salvaConfigGlobaleMenuUfficio() {
    if (!projectData) {
        showAlert('error', '❌ Nessun progetto caricato');
        return;
    }
    
    projectData.configInfissi = configCorrente.infissi;
    projectData.configPersiane = configCorrente.persiane;
    projectData.configTapparelle = configCorrente.tapparelle;
    projectData.configCassonetti = configCorrente.cassonetti;
    projectData.configZanzariere = configCorrente.zanzariere;
    
    showAlert('success', '✅ Configurazione globale salvata!');
    console.log('💾 Configurazione salvata da Ufficio:', configCorrente);
}

/**
 * Reset configurazione - versione Ufficio
 */
function resetConfigGlobaleMenuUfficio() {
    if (!confirm('Resettare tutti i valori di configurazione?')) return;
    
    configCorrente = {
        infissi: {},
        persiane: {},
        tapparelle: {},
        cassonetti: {},
        zanzariere: {}
    };
    
    // Re-render pannello attivo
    const activePanel = document.querySelector('#configGlobaleUfficioContainer .config-panel.active');
    if (activePanel) {
        const categoria = activePanel.id.replace('configPanel', '').replace('Ufficio', '').toLowerCase();
        renderConfigPanelUfficio(categoria);
    }
    
    showAlert('success', '🔄 Configurazione resettata');
}

/**
 * Inizializza menu configurazione Ufficio
 */
function initConfigMenuUfficio() {
    console.log('🔄 v7.997 initConfigMenuUfficio() chiamato');
    
    const container = document.getElementById('configGlobaleUfficioContainer');
    if (!container) {
        console.error('❌ configGlobaleUfficioContainer non trovato!');
        return;
    }
    
    // Mostra container
    container.style.display = 'block';
    
    // Carica config da progetto
    if (projectData && projectData.configInfissi) {
        configCorrente = {
            infissi: { ...projectData.configInfissi },
            persiane: { ...(projectData.configPersiane || {}) },
            tapparelle: { ...(projectData.configTapparelle || {}) },
            cassonetti: { ...(projectData.configCassonetti || {}) },
            zanzariere: { ...(projectData.configZanzariere || {}) }
        };
    }
    
    // Render pannello iniziale
    renderConfigPanelUfficio('infissi');
    
    console.log('⚙️ Menu configurazione Ufficio inizializzato v7.997');
}

// ============================================================================
// RENDER DETTAGLIO POSIZIONE
// ============================================================================
function renderPositionDetail(index) {
    if (index < 0 || index >= filteredPositions.length) return;
    
    const pos = filteredPositions[index];
    const container = document.getElementById('positionDetailCard');
    
    // 🔄 v8.02: Nuovo ordine - Prodotti PRIMA, poi sezioni tecniche collassabili
    container.innerHTML = `
        ${renderPositionHeader(pos)}
        ${renderPositionProducts(pos)}
        ${renderPositionMeasuresCollapsible(pos)}
        ${renderPositionWallCharsCollapsible(pos)}
        ${renderPositionPreexisting(pos)}
        ${renderPositionNotes(pos)}
        ${renderPositionNavigation(index)}
    `;
    
    // Setup tabs prodotti
    setupProductTabs();
}

// ============================================================================
// SEZIONE A: HEADER POSIZIONE
// ============================================================================
function renderPositionHeader(pos) {
    return `
        <div class="position-header">
            <div class="position-id-large">${pos.ambiente || pos.nome || pos.stanza || 'Posizione'}</div>
            <div class="position-location">
                <span class="position-location-item">📍 Piano: ${pos.piano || 'N/D'}</span>
                <span class="position-location-item">|</span>
                <span class="position-location-item">🚪 N/D</span>
            </div>
            <div class="position-qty">Quantità: ${PRODOTTI_CONFIG.reduce((s, c) => s + (prodottoPresente(pos, c) ? getQtaProdotto(pos, c) : 0), 0) || 1}</div>
        </div>
    `;
}

// ============================================================================
// SEZIONE B: MISURE COMPLETE - COLLASSABILE v8.02
// ============================================================================
function renderPositionMeasuresCollapsible(pos) {
    const m = pos.misure || {};
    
    // 🔧 Helper per convertire valore (evita [object Object])
    const getVal = (val) => {
        if (val === null || val === undefined) return null;
        if (typeof val === 'object') return null;
        return val;
    };
    
    const mainMeasures = [
        { label: 'Larghezza Vecchio Telaio (LVT)', value: getVal(m.LVT) },
        { label: 'Altezza Vecchio Telaio (HVT)', value: getVal(m.HVT) },
        { label: 'Larghezza Foro (LF)', value: getVal(m.LF) },
        { label: 'Altezza Foro (HF)', value: getVal(m.HF) },
        { label: 'Larghezza Massima Muro Int (TMV)', value: getVal(m.TMV) },
        { label: 'Altezza Massima Muro Int (HMT)', value: getVal(m.HMT) }
    ];
    
    const additionalMeasures = [
        { label: 'Larghezza Variabile (LVAR)', value: getVal(m.LVAR) },
        { label: 'Altezza Variabile (HVAR)', value: getVal(m.HVAR) },
        { label: 'Altezza Soffitto (HSoffitto)', value: getVal(m.HSoffitto) },
        { label: 'H Parapetto-Soffitto', value: getVal(m.HParapettoSoffitto) },
        { label: 'H Pavimento-Parapetto', value: getVal(m.HPavimentoParapetto) },
        { label: 'Dislivello Piana Sopra', value: getVal(m.profPianaSopra) },
        { label: 'Dislivello Piana Sotto', value: getVal(m.profPianaSotto) }
    ];
    
    // Conta misure disponibili
    const mainCount = mainMeasures.filter(m => m.value != null).length;
    const addCount = additionalMeasures.filter(m => m.value != null).length;
    const totalCount = mainCount + addCount;
    
    // Se non ci sono misure, non mostrare nulla
    if (totalCount === 0) return '';
    
    const uniqueId = 'measures_' + Math.random().toString(36).substr(2, 9);
    
    return `
        <div class="position-section collapsible-section">
            <h3 class="position-section-title collapsible-header" onclick="toggleCollapsible('${uniqueId}')" style="cursor: pointer; user-select: none;">
                <span class="position-section-icon">📏</span>
                Misure Complete
                <span style="margin-left: auto; display: flex; align-items: center; gap: 0.5rem;">
                    <span class="collapsible-count" style="background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem;">${totalCount} misure</span>
                    <span class="collapsible-arrow" id="arrow_${uniqueId}" style="transition: transform 0.3s;">▼</span>
                </span>
            </h3>
            <div class="collapsible-content" id="${uniqueId}" style="display: none; padding-top: 1rem;">
                ${mainCount > 0 ? `
                    <h4 style="font-size: 0.95rem; font-weight: 600; color: #6b7280; margin-bottom: 1rem;">
                        Misure Principali
                    </h4>
                    <table class="measures-table">
                        <tbody>
                            ${mainMeasures.filter(m => m.value != null).map(m => `
                                <tr>
                                    <td class="measure-label">${m.label}</td>
                                    <td class="measure-value">
                                        <span class="measure-highlight">${m.value} mm</span>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : ''}
                
                ${addCount > 0 ? `
                    <h4 style="font-size: 0.95rem; font-weight: 600; color: #6b7280; margin: 1.5rem 0 1rem;">
                        Misure Aggiuntive
                    </h4>
                    <table class="measures-table">
                        <tbody>
                            ${additionalMeasures.filter(m => m.value != null).map(m => `
                                <tr>
                                    <td class="measure-label">${m.label}</td>
                                    <td class="measure-value">${m.value} mm</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : ''}
            </div>
        </div>
    `;
}

// ============================================================================
// SEZIONE C: CARATTERISTICHE MURO - COLLASSABILE v8.02
// ============================================================================
function renderPositionWallCharsCollapsible(pos) {
    const override = pos.caratteristiche_muro_override || {};
    const global = currentData?.caratteristiche_muro_globali || {};
    const hasOverride = Object.keys(override).length > 0;
    
    // Usa override se presente, altrimenti globale
    const chars = hasOverride ? override : global;
    
    const items = [
        { label: 'Telaio', value: chars.telaio_larghezza && chars.telaio_altezza ? 
            `${chars.telaio_larghezza} × ${chars.telaio_altezza} mm` : null },
        { label: 'Falso Esistente', value: chars.falso_esistente || null },
        { label: 'Spessore Falso', value: chars.spessore_falso ? `${chars.spessore_falso} mm` : null },
        { label: 'Profondità Muro INT', value: chars.prof_muro_int ? `${chars.prof_muro_int} mm` : null },
        { label: 'Profondità Muro EST', value: chars.prof_muro_est ? `${chars.prof_muro_est} mm` : null },
        { label: 'Guida Tipo', value: chars.guida_tipo || null },
        { label: 'Coprifilo', value: chars.coprifilo_larghezza ? `${chars.coprifilo_larghezza} mm` : null },
        { label: 'Battuta Sup. Tapparella', value: chars.battuta_superiore_tapparella ? 
            `${chars.battuta_superiore_tapparella} mm` : null }
    ];
    
    // Conta solo valori reali (non N/D)
    const validItems = items.filter(item => item.value !== null);
    
    // 🔄 v8.02: Se TUTTI sono null/N/D, NON mostrare la sezione
    if (validItems.length === 0) return '';
    
    const uniqueId = 'wallchars_' + Math.random().toString(36).substr(2, 9);
    
    return `
        <div class="position-section collapsible-section">
            <h3 class="position-section-title collapsible-header" onclick="toggleCollapsible('${uniqueId}')" style="cursor: pointer; user-select: none;">
                <span class="position-section-icon">🧱</span>
                Caratteristiche Muro
                ${hasOverride ? '<span class="override-badge">OVERRIDE</span>' : ''}
                <span style="margin-left: auto; display: flex; align-items: center; gap: 0.5rem;">
                    <span class="collapsible-count" style="background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem;">${validItems.length} dati</span>
                    <span class="collapsible-arrow" id="arrow_${uniqueId}" style="transition: transform 0.3s;">▼</span>
                </span>
            </h3>
            <div class="collapsible-content" id="${uniqueId}" style="display: none; padding-top: 1rem;">
                <div class="wall-chars-grid">
                    ${validItems.map(item => `
                        <div class="wall-char-item">
                            <div class="wall-char-label">${item.label}</div>
                            <div class="wall-char-value">${item.value}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

// 🔄 v8.02: Funzione toggle per sezioni collassabili
function toggleCollapsible(id) {
    const content = document.getElementById(id);
    const arrow = document.getElementById('arrow_' + id);
    
    if (content.style.display === 'none') {
        content.style.display = 'block';
        if (arrow) arrow.style.transform = 'rotate(180deg)';
    } else {
        content.style.display = 'none';
        if (arrow) arrow.style.transform = 'rotate(0deg)';
    }
}

// ============================================================================
// SEZIONE B LEGACY: MISURE COMPLETE (mantenuta per compatibilità)
// ============================================================================
function renderPositionMeasures(pos) {
    return renderPositionMeasuresCollapsible(pos);
}

// ============================================================================
// SEZIONE C LEGACY: CARATTERISTICHE MURO (mantenuta per compatibilità)
// ============================================================================
function renderPositionWallChars(pos) {
    return renderPositionWallCharsCollapsible(pos);
}

// ============================================================================
// SEZIONE D: PRODOTTI E CONFIGURAZIONI
// ============================================================================
function renderPositionProducts(pos) {
    // ✅ v8.58: DINAMICO da PRODOTTI_CONFIG
    const hasProdotti = PRODOTTI_CONFIG.some(cfg => prodottoPresente(pos, cfg));
    
    if (!hasProdotti) {
        return `
            <div class="position-section">
                <h3 class="position-section-title">
                    <span class="position-section-icon">📦</span>
                    Prodotti e Configurazioni
                </h3>
                <p style="color: #6b7280; font-style: italic;">Nessun prodotto configurato</p>
            </div>
        `;
    }
    
    // 🆕 v8.55: DINAMICO da PRODOTTI_CONFIG - qualsiasi prodotto appare automaticamente
    const prodottiDisponibili = PRODOTTI_CONFIG
        .filter(cfg => prodottoPresente(pos, cfg))
        .map(cfg => ({ key: cfg.key, label: `${cfg.icon} ${cfg.label}`, data: getProdottoData(pos, cfg) }));
    
    // Il primo è active
    const primoProdottoKey = prodottiDisponibili.length > 0 ? prodottiDisponibili[0].key : 'infisso';
    
    // Genera tabs
    const tabsHTML = prodottiDisponibili
        .map(p => `<button class="product-tab ${p.key === primoProdottoKey ? 'active' : ''}" onclick="switchProductTab('${p.key}', event)">${p.label}</button>`)
        .join('');
    
    // Genera contenuti - SOLO il primo è active
    // 🆕 v8.471: Passa pos.misure per fallback BRM intelligente
    const contenutiHTML = prodottiDisponibili
        .map(p => renderProductContent(p.key, p.data, p.key === primoProdottoKey, pos.misure))
        .join('');
    
    return `
        <div class="position-section">
            <h3 class="position-section-title">
                <span class="position-section-icon">📦</span>
                Prodotti e Configurazioni
            </h3>
            
            <div class="products-tabs">
                ${tabsHTML}
            </div>
            
            ${contenutiHTML}
        </div>
    `;
}

function renderProductContent(tipo, prodotto, isActive, posMisure = {}) {
    // 🔐 v7.98: Blindata non usa quantita
    if (tipo === 'blindata') {
        return renderBlindataContent(prodotto, isActive);
    }
    
    // 🚪 v7.98: Portoncino non usa quantita
    if (tipo === 'portoncino') {
        return renderPortoncinoContent(prodotto, isActive);
    }
    
    // 🔌 v8.00: Motore - tab separato
    if (tipo === 'motore') {
        return renderMotoreContent(prodotto, isActive);
    }
    
    // 🔒 v8.54: Grata di sicurezza
    if (tipo === 'grata') {
        return renderGrataContent(prodotto, isActive, posMisure);
    }
    
    // 🆕 v7.82: Supporta sia qta che quantita
    const qty = parseInt(prodotto?.quantita) || parseInt(prodotto?.qta) || 0;
    if (!prodotto || qty === 0) return '';
    
    // 🔧 v8.54: BRM centralizzato via getProductBRM (offset infissi +100/+50 per display)
    const isInfisso = (tipo === 'infisso');
    const brm = getProductBRM(prodotto, { misure: posMisure }, isInfisso ? { L: 100, H: 50 } : null);
    
    // Per INFISSI: usa nuovo design con override detection
    if (tipo === 'infisso') {
        return renderInfissoContent(prodotto, brm, isActive);
    }
    
    // 🆕 v8.55: Config globale DINAMICA - cerca config[Tipo] in projectData
    let configGlobale = {};
    const configKeys = [`config${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`, `config${tipo.charAt(0).toUpperCase() + tipo.slice(1)}e`, `config${tipo.charAt(0).toUpperCase() + tipo.slice(1)}i`];
    for (const ck of configKeys) {
        if (projectData?.[ck]) { configGlobale = projectData[ck]; break; }
    }
    
    const configGlobaleHTML = renderConfigGlobaleInTab(tipo, configGlobale);
    
    // Per ALTRI PRODOTTI: rendering completo originale
    return `
        <div class="product-content ${isActive ? 'active' : ''}" data-product="${tipo}">
            
            ${configGlobaleHTML}
            
            ${brm.L || brm.H ? `
                <div class="brm-box" ${brm.stimato ? 'style="border: 2px dashed #f59e0b; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);"' : ''}>
                    <div class="brm-title">
                        📐 Misure BRM ${tipo.toUpperCase()}
                        ${brm.stimato ? `<span style="font-size: 0.75rem; color: #92400e; margin-left: 0.5rem;">⚠️ Stimato da ${brm.origine}</span>` : ''}
                    </div>
                    <div class="brm-grid">
                        ${brm.L ? `
                            <div class="brm-item" ${brm.stimato ? 'style="background: #fef3c7;"' : ''}>
                                <div class="brm-label">L (Larghezza) ${brm.stimato ? '⚠️' : ''}</div>
                                <div class="brm-value">${brm.L} mm</div>
                            </div>
                        ` : ''}
                        ${brm.H ? `
                            <div class="brm-item" ${brm.stimato ? 'style="background: #fef3c7;"' : ''}>
                                <div class="brm-label">H (Altezza) ${brm.stimato ? '⚠️' : ''}</div>
                                <div class="brm-value">${brm.H} mm</div>
                            </div>
                        ` : ''}
                        ${brm.C ? `
                            <div class="brm-item">
                                <div class="brm-label">C (Profondità)</div>
                                <div class="brm-value">${brm.C} mm</div>
                            </div>
                        ` : ''}
                        ${brm.B ? `
                            <div class="brm-item">
                                <div class="brm-label">B (Base)</div>
                                <div class="brm-value">${brm.B} mm</div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            ` : ''}
            
            <div class="wall-chars-grid" style="margin-top: 1.5rem;">
                ${prodotto.quantita ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">Quantità</div>
                        <div class="wall-char-value">${prodotto.quantita}</div>
                    </div>
                ` : ''}
                ${(prodotto.tipo || prodotto.apertura) && tipo === 'infisso' ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">Tipo Infisso</div>
                        <div class="wall-char-value">${prodotto.tipo || ''}${prodotto.tipo && prodotto.apertura ? ' + ' : ''}${prodotto.apertura || ''}</div>
                    </div>
                ` : ''}
                ${prodotto.tipo && tipo !== 'infisso' ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">${
                            tipo === 'persiana' ? 'Tipo Persiana' :
                            tipo === 'tapparella' ? 'Tipo Tapparella' :
                            tipo === 'zanzariera' ? 'Tipo Zanzariera' :
                            tipo === 'cassonetto' ? 'Tipo Cassonetto' : 'Tipo'
                        }</div>
                        <div class="wall-char-value">${prodotto.tipo}</div>
                    </div>
                ` : ''}
                ${prodotto.azienda ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">Azienda</div>
                        <div class="wall-char-value">${prodotto.azienda}</div>
                    </div>
                ` : ''}
                ${prodotto.telaio && tipo === 'infisso' ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">Telaio</div>
                        <div class="wall-char-value">${prodotto.telaio}</div>
                    </div>
                ` : ''}
                ${prodotto.apertura && tipo !== 'infisso' ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">Apertura</div>
                        <div class="wall-char-value">${prodotto.apertura}</div>
                    </div>
                ` : ''}
                ${prodotto.finitura_int ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">Finitura INT</div>
                        <div class="wall-char-value">${prodotto.finitura_int}</div>
                    </div>
                ` : ''}
                ${prodotto.finitura_est ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">Finitura EST</div>
                        <div class="wall-char-value">${prodotto.finitura_est}</div>
                    </div>
                ` : ''}
                ${prodotto.colore ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">Colore</div>
                        <div class="wall-char-value">${prodotto.colore}</div>
                    </div>
                ` : ''}
                ${prodotto.motorizzazione ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">Motorizzazione</div>
                        <div class="wall-char-value">${prodotto.motorizzazione}</div>
                    </div>
                ` : ''}
                ${prodotto.tipoInfissoAssociato ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">${tipo === 'persiana' ? 'Tipo Infisso Associato' : 'Tipo Infisso'}</div>
                        <div class="wall-char-value">${prodotto.tipoInfissoAssociato === 'F' ? 'Finestra' : 'Porta Finestra'}</div>
                    </div>
                ` : ''}
                ${prodotto.tagliTelaio ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">Tagli Telaio</div>
                        <div class="wall-char-value">${prodotto.tagliTelaio}</div>
                    </div>
                ` : ''}
                ${prodotto.codTagli && prodotto.codTagli.length > 0 ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">Codici Taglio</div>
                        <div class="wall-char-value">${prodotto.codTagli.join(', ')}</div>
                    </div>
                ` : ''}
                ${prodotto.vetro ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">Vetro</div>
                        <div class="wall-char-value">${prodotto.vetro}</div>
                    </div>
                ` : ''}
                ${prodotto.tipoAnta ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">Tipo Anta</div>
                        <div class="wall-char-value">${prodotto.tipoAnta}</div>
                    </div>
                ` : ''}
                ${prodotto.telaio && tipo !== 'infisso' ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">Telaio</div>
                        <div class="wall-char-value">${prodotto.telaio}</div>
                    </div>
                ` : ''}
                ${prodotto.finituraInt ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">Finitura Interna</div>
                        <div class="wall-char-value">${prodotto.finituraInt}</div>
                    </div>
                ` : ''}
                ${prodotto.finituraEst ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">Finitura Esterna</div>
                        <div class="wall-char-value">${prodotto.finituraEst}</div>
                    </div>
                ` : ''}
                ${prodotto.coloreInt ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">Colore Interno</div>
                        <div class="wall-char-value">${prodotto.coloreInt}</div>
                    </div>
                ` : ''}
                ${prodotto.coloreEst ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">Colore Esterno</div>
                        <div class="wall-char-value">${prodotto.coloreEst}</div>
                    </div>
                ` : ''}
                ${prodotto.maniglia ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">Maniglia</div>
                        <div class="wall-char-value">${prodotto.maniglia}</div>
                    </div>
                ` : ''}
                ${prodotto.coloreManiglia ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">Colore Maniglia</div>
                        <div class="wall-char-value">${prodotto.coloreManiglia}</div>
                    </div>
                ` : ''}
                ${prodotto.allarme ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">Allarme</div>
                        <div class="wall-char-value">${prodotto.allarme}</div>
                    </div>
                ` : ''}
                ${prodotto.materiale ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">Materiale</div>
                        <div class="wall-char-value">${prodotto.materiale}</div>
                    </div>
                ` : ''}
                ${prodotto.modello ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">Modello</div>
                        <div class="wall-char-value">${prodotto.modello}</div>
                    </div>
                ` : ''}
                ${prodotto.sistema ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">Sistema</div>
                        <div class="wall-char-value">${prodotto.sistema}</div>
                    </div>
                ` : ''}
                ${prodotto.coibentazione ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">Isolamento Posaclima</div>
                        <div class="wall-char-value">${prodotto.coibentazione}</div>
                    </div>
                ` : ''}
                ${prodotto.maglia ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">Maglia</div>
                        <div class="wall-char-value">${prodotto.maglia}</div>
                    </div>
                ` : ''}
                ${prodotto.guida ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">Guida</div>
                        <div class="wall-char-value">${prodotto.guida}</div>
                    </div>
                ` : ''}
                ${prodotto.profilo ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">Profilo</div>
                        <div class="wall-char-value">${prodotto.profilo}</div>
                    </div>
                ` : ''}
                ${prodotto.accessori ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">Accessori</div>
                        <div class="wall-char-value">${prodotto.accessori}</div>
                    </div>
                ` : ''}
                ${prodotto.note ? `
                    <div class="wall-char-item" style="grid-column: 1 / -1;">
                        <div class="wall-char-label">📝 Note</div>
                        <div class="wall-char-value">${prodotto.note}</div>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

// ============================================================================
// 🔌 v8.00: RENDER MOTORE CONTENT - TAB SEPARATO
// ============================================================================
function renderMotoreContent(tapparella, isActive) {
    if (!tapparella || !tapparella.serveMotore) return '';
    
    const motori = tapparella.motori || [];
    const motoreInfo = motori[0] || {};
    const modelloId = motoreInfo.modelloId || tapparella.motoreModelloDefault || 'oximo_20';
    const comandoId = motoreInfo.comandoId || tapparella.comandoDefault || '';
    const accessori = motoreInfo.accessori || {};
    const quantita = getQta(tapparella) || 1;
    
    // Ottieni info dai database
    const motoreDb = SOMFY_PREZZI.getPrezzoMotore(modelloId);
    const comandoDb = SOMFY_PREZZI.getPrezzoComando(comandoId);
    
    // Calcola prezzo kit
    const prezzoKit = SOMFY_PREZZI.calcolaPrezzoKit(motoreInfo);
    
    return `
        <div class="product-content ${isActive ? 'active' : ''}" data-product="motore">
            
            <div style="padding: 1rem; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; border: 2px solid #f59e0b; margin-bottom: 1.5rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <span style="font-size: 2rem;">🔌</span>
                    <div>
                        <div style="font-size: 1.2rem; font-weight: 700; color: #92400e;">Motore ${tapparella.motoreAzienda || 'Somfy'}</div>
                        <div style="font-size: 0.9rem; color: #b45309;">Quantità: ${quantita}</div>
                    </div>
                </div>
            </div>
            
            <div class="wall-chars-grid">
                <div class="wall-char-item">
                    <div class="wall-char-label">🏭 Azienda</div>
                    <div class="wall-char-value">${tapparella.motoreAzienda || 'Somfy'}</div>
                </div>
                <div class="wall-char-item">
                    <div class="wall-char-label">⚙️ Modello</div>
                    <div class="wall-char-value">${motoreDb?.nome || modelloId.replace(/_/g, ' ').toUpperCase()}</div>
                </div>
                ${motoreDb?.coppia ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">💪 Coppia</div>
                        <div class="wall-char-value">${motoreDb.coppia} Nm</div>
                    </div>
                ` : ''}
                ${motoreDb?.velocita ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">🔄 Velocità</div>
                        <div class="wall-char-value">${motoreDb.velocita} rpm</div>
                    </div>
                ` : ''}
                ${comandoDb ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">🎮 Comando</div>
                        <div class="wall-char-value">${comandoDb.nome}</div>
                    </div>
                ` : ''}
                ${accessori.supporto ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">🔧 Supporto</div>
                        <div class="wall-char-value" style="color: #059669;">✅ Incluso</div>
                    </div>
                ` : ''}
                ${accessori.ruota_60 ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">⚙️ Ruota 60mm</div>
                        <div class="wall-char-value" style="color: #059669;">✅ Inclusa</div>
                    </div>
                ` : ''}
                ${accessori.corona_60 ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">👑 Corona 60</div>
                        <div class="wall-char-value" style="color: #059669;">✅ Inclusa</div>
                    </div>
                ` : ''}
                ${motoreInfo.note ? `
                    <div class="wall-char-item" style="grid-column: 1 / -1;">
                        <div class="wall-char-label">📝 Note</div>
                        <div class="wall-char-value">${motoreInfo.note}</div>
                    </div>
                ` : ''}
            </div>
            
            <div style="margin-top: 1.5rem; padding: 1.25rem; background: #fffbeb; border-radius: 12px; border: 1px solid #fcd34d;">
                <div style="font-weight: 700; color: #92400e; margin-bottom: 1rem; font-size: 1.1rem;">
                    💰 Dettaglio Prezzo Kit
                </div>
                <div style="display: grid; gap: 0.5rem;">
                    ${prezzoKit.dettaglio.map(item => `
                        <div style="display: flex; justify-content: space-between; padding: 0.5rem; background: white; border-radius: 6px;">
                            <span style="color: #4b5563;">${item.nome}</span>
                            <span style="font-weight: 600; color: #1f2937;">€ ${item.prezzo.toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 1rem; padding: 1rem; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 8px; color: white;">
                    <span style="font-weight: 700; font-size: 1.1rem;">TOTALE KIT (x${quantita})</span>
                    <span style="font-weight: 700; font-size: 1.3rem;">€ ${(prezzoKit.totale * quantita).toFixed(2)}</span>
                </div>
            </div>
        </div>
    `;
}

// ============================================================================
// 🔐 RENDER BLINDATA CONTENT - v7.98
// ============================================================================
function renderBlindataContent(bld, isActive) {
    if (!bld) return '';
    
    const configGlobale = projectData?.configBlindate || {};
    
    // Calcola prezzo stimato
    let prezzoStimato = 0;
    if (typeof calcolaPrezzoBlindataOikos === 'function') {
        const calcolo = calcolaPrezzoBlindataOikos(bld);
        prezzoStimato = calcolo.totale || 0;
    }
    
    return `
        <div class="product-content ${isActive ? 'active' : ''}" data-product="blindata">
            
            ${Object.keys(configGlobale).length > 0 ? `
                <div class="config-globale-box" style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
                    <div style="font-weight: 600; color: #991b1b; margin-bottom: 8px; cursor: pointer;" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
                        ⚙️ Config Globale Blindate ▼
                    </div>
                    <div style="display: none; font-size: 0.85rem;">
                        ${configGlobale.versione ? `<div>Versione: <b>${configGlobale.versione}</b></div>` : ''}
                        ${configGlobale.tipoAnta ? `<div>Tipo Anta: <b>${configGlobale.tipoAnta}</b></div>` : ''}
                        ${configGlobale.cilindro ? `<div>Cilindro: <b>${configGlobale.cilindro}</b></div>` : ''}
                        ${configGlobale.coloreTelaio ? `<div>Colore Telaio: <b>${configGlobale.coloreTelaio}</b></div>` : ''}
                    </div>
                </div>
            ` : ''}
            
            <div class="brm-box" style="background: #fef2f2; border-color: #fecaca;">
                <div class="brm-title" style="color: #991b1b;">📐 Luce Netta Passaggio (LNP)</div>
                <div class="brm-grid">
                    ${bld.LNP_L ? `
                        <div class="brm-item">
                            <div class="brm-label">Larghezza</div>
                            <div class="brm-value">${bld.LNP_L} mm</div>
                        </div>
                    ` : ''}
                    ${bld.LNP_H ? `
                        <div class="brm-item">
                            <div class="brm-label">Altezza</div>
                            <div class="brm-value">${bld.LNP_H} mm</div>
                        </div>
                    ` : ''}
                    ${bld.luceCalcolata ? `
                        <div class="brm-item">
                            <div class="brm-label">Luce</div>
                            <div class="brm-value" style="color: #dc2626; font-weight: bold;">${bld.luceCalcolata.toUpperCase()}</div>
                        </div>
                    ` : ''}
                </div>
            </div>
            
            <div class="wall-chars-grid" style="margin-top: 1.5rem;">
                ${bld.azienda ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">Azienda</div>
                        <div class="wall-char-value">${bld.azienda}</div>
                    </div>
                ` : ''}
                ${bld.versione ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">Versione</div>
                        <div class="wall-char-value">${bld.versione}</div>
                    </div>
                ` : ''}
                ${bld.tipoAnta ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">Tipo Anta</div>
                        <div class="wall-char-value">${bld.tipoAnta === 'doppia' ? '2 Ante' : '1 Anta'}</div>
                    </div>
                ` : ''}
                ${bld.sensoApertura ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">Senso Apertura</div>
                        <div class="wall-char-value">${bld.sensoApertura}</div>
                    </div>
                ` : ''}
                ${bld.versoApertura ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">Verso Apertura</div>
                        <div class="wall-char-value">${bld.versoApertura === 'tirare' ? '⬅️ Tirare (interno)' : '➡️ Spingere (esterno)'}</div>
                    </div>
                ` : ''}
                ${bld.controtelaio ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">Controtelaio</div>
                        <div class="wall-char-value">${bld.controtelaio === 'si' ? '✅ Sì' : '❌ No'}</div>
                    </div>
                ` : ''}
                ${bld.cilindro ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">Cilindro</div>
                        <div class="wall-char-value">${bld.cilindro}</div>
                    </div>
                ` : ''}
                ${bld.coloreTelaio ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">Colore Telaio</div>
                        <div class="wall-char-value">${bld.coloreTelaio}</div>
                    </div>
                ` : ''}
                ${bld.kitAAV ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">Kit AAV</div>
                        <div class="wall-char-value">${bld.kitAAV}</div>
                    </div>
                ` : ''}
            </div>
            
            ${prezzoStimato > 0 ? `
                <div style="margin-top: 1.5rem; padding: 12px; background: #dcfce7; border-radius: 8px; text-align: center;">
                    <div style="font-size: 0.85rem; color: #166534;">Prezzo Stimato</div>
                    <div style="font-size: 1.5rem; font-weight: bold; color: #15803d;">€ ${prezzoStimato.toFixed(2)}</div>
                </div>
            ` : ''}
        </div>
    `;
}

// ============================================================================
// 🚪 v7.98: RENDER PORTONCINO CONTENT - FIN-Door Finstral
// ============================================================================
// Helper: preview immagine modello portoncino FIN-Door (usa FINDOOR_CATALOGO)
function getPortoncinoImgHTML_dash(codiceModello, size = 80) {
    if (!codiceModello || typeof FINDOOR_CATALOGO === 'undefined') return '';
    const src = FINDOOR_CATALOGO.getModello(codiceModello);
    if (!src) return '';
    return `<img src="${src}" style="width:${size}px;height:auto;border-radius:6px;border:1px solid #e5e7eb;box-shadow:0 1px 3px rgba(0,0,0,.1)" alt="Mod.${codiceModello}">`;
}

function renderPortoncinoContent(ptc, isActive) {
    if (!ptc) return '';
    
    // Helper per descrizione tipo apertura
    const getTipoAperturaDesc = (tipo) => {
        const desc = {
            '720': 'Porta singola',
            '625': 'Porta singola (variante)',
            '621': 'Porta + laterale sx',
            '622': 'Porta + laterale dx',
            '621C': 'Accoppiata + lat. sx',
            '622C': 'Accoppiata + lat. dx',
            '633': 'Porta + 2 laterali',
            '633C': 'Accoppiata + 2 lat.',
            '624': 'Porta + sopraluce',
            '623': 'Porta + anta sup.',
            '636': 'Doppia porta',
            '626': 'Doppia + lat. sx',
            '627': 'Doppia + lat. dx',
            '649': 'Doppia + 2 laterali'
        };
        return desc[tipo] || tipo || '-';
    };
    
    // Costruisci Apertura: tirare/spingere + SX/DX
    const buildApertura = () => {
        const verso = ptc.versoApertura || ptc.direzioneApertura || '';
        const senso = ptc.sensoApertura || ptc.latoCerniere || '';
        if (!verso && !senso) return '-';
        let result = '';
        if (verso) result += verso === 'tirare' ? 'Tirare' : 'Spingere';
        if (senso) result += (result ? ' + ' : '') + (senso.toUpperCase() === 'SX' ? 'SX' : 'DX');
        return result || '-';
    };
    
    return `
        <div class="product-content ${isActive ? 'active' : ''}" data-product="portoncino">
            
            <div class="brm-box" style="background: #f3e8ff; border-color: #c4b5fd;">
                <div class="brm-title" style="color: #6b21a8;">📐 Tipo Apertura</div>
                <div class="brm-grid">
                    <div class="brm-item">
                        <div class="brm-label">Configurazione</div>
                        <div class="brm-value" style="color: #7c3aed;">${ptc.tipoApertura || '720'} - ${getTipoAperturaDesc(ptc.tipoApertura)}</div>
                    </div>
                    <div class="brm-item">
                        <div class="brm-label">Apertura</div>
                        <div class="brm-value">${buildApertura()}</div>
                    </div>
                </div>
            </div>
            
            ${ptc.BRM_L || ptc.BRM_H ? `
                <div class="brm-box" style="background: #f0fdfa; border-color: #99f6e4; margin-top: 1rem;">
                    <div class="brm-title" style="color: #0f766e;">📏 Dimensioni BRM</div>
                    <div class="brm-grid">
                        ${ptc.BRM_L ? `
                            <div class="brm-item">
                                <div class="brm-label">Larghezza</div>
                                <div class="brm-value">${ptc.BRM_L} mm</div>
                            </div>
                        ` : ''}
                        ${ptc.BRM_H ? `
                            <div class="brm-item">
                                <div class="brm-label">Altezza</div>
                                <div class="brm-value">${ptc.BRM_H} mm</div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            ` : ''}
            
            <div class="brm-box" style="background: #fef3c7; border-color: #fcd34d; margin-top: 1rem;">
                <div class="brm-title" style="color: #92400e;">🎨 Finiture</div>
                <div class="brm-grid">
                    <div class="brm-item">
                        <div class="brm-label">Finitura INT</div>
                        <div class="brm-value">${ptc.finituraInt || ptc.materialeInt || '-'}${ptc.coloreInt ? ' - ' + ptc.coloreInt : ''}</div>
                    </div>
                    <div class="brm-item">
                        <div class="brm-label">Finitura EST</div>
                        <div class="brm-value">${ptc.finituraEst || ptc.materialeEst || '-'}${ptc.coloreEst ? ' - ' + ptc.coloreEst : ''}</div>
                    </div>
                </div>
            </div>
            
            <div class="wall-chars-grid" style="margin-top: 1.5rem;">
                ${ptc.codTelaio ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">Cod. Telaio</div>
                        <div class="wall-char-value">${ptc.codTelaio}</div>
                    </div>
                ` : ''}
                ${ptc.codTagli ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">Cod. Tagli</div>
                        <div class="wall-char-value">${ptc.codTagli}</div>
                    </div>
                ` : ''}
                ${ptc.modelloAnta ? `
                    <div class="wall-char-item" style="display:flex;align-items:center;gap:8px;">
                        <div>
                            <div class="wall-char-label">Modello Anta</div>
                            <div class="wall-char-value" style="font-weight: bold; color: #7c3aed;">${ptc.modelloAnta}</div>
                        </div>
                        ${getPortoncinoImgHTML_dash(ptc.modelloAnta, 70)}
                    </div>
                ` : ''}
            </div>
            
            <div class="wall-chars-grid" style="margin-top: 1rem;">
                ${ptc.tipoManiglia ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">Tipo Maniglia</div>
                        <div class="wall-char-value">${ptc.tipoManiglia === 'maniglione' ? 'Maniglione' : 'Set maniglia'}</div>
                    </div>
                ` : ''}
                ${ptc.codManiglia ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">Cod. Maniglia</div>
                        <div class="wall-char-value">${ptc.codManiglia}</div>
                    </div>
                ` : ''}
            </div>
            
            <div class="wall-chars-grid" style="margin-top: 1rem;">
                ${ptc.gruppoColoreInt ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">Gruppo Col. Int</div>
                        <div class="wall-char-value">${ptc.gruppoColoreInt}</div>
                    </div>
                ` : ''}
                ${ptc.gruppoColoreEst ? `
                    <div class="wall-char-item">
                        <div class="wall-char-label">Gruppo Col. Est</div>
                        <div class="wall-char-value">${ptc.gruppoColoreEst}</div>
                    </div>
                ` : ''}
            </div>
            
            <div class="brm-box" style="background: #fee2e2; border-color: #fca5a5; margin-top: 1rem;">
                <div class="brm-title" style="color: #991b1b;">⚙️ Optional</div>
                <div class="brm-grid">
                    <div class="brm-item">
                        <div class="brm-label">Cilindro</div>
                        <div class="brm-value">${ptc.cilindro || '1P'}</div>
                    </div>
                    <div class="brm-item">
                        <div class="brm-label">Cerniere</div>
                        <div class="brm-value">${ptc.cerniere === 'scomparsa' ? 'A scomparsa' : 'Standard'}</div>
                    </div>
                    <div class="brm-item">
                        <div class="brm-label">Fonoassorbente</div>
                        <div class="brm-value">${ptc.fonoassorbente ? '✅ Sì (42dB)' : '❌ No'}</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ============================================================================
// 🔒 v8.54: RENDER GRATA CONTENT
// ============================================================================
function renderGrataContent(grata, isActive, posMisure) {
    if (!grata) return '';
    const qty = parseInt(grata.quantita) || parseInt(grata.qta) || 1;
    const configGlobale = projectData?.configGrate || {};
    
    // BRM
    const brmData = typeof getProductBRM !== 'undefined' 
        ? getProductBRM(grata, { misure: posMisure })
        : { L: parseInt(grata.BRM_L) || 0, H: parseInt(grata.BRM_H) || 0 };
    
    // Prezzo
    let prezzoInfo = '';
    if (typeof GRATE_MODULE !== 'undefined' && GRATE_MODULE.calcolaPrezzo) {
        const ris = GRATE_MODULE.calcolaPrezzo(grata, { misure: posMisure });
        if (ris && !ris.errore) {
            prezzoInfo = `<div style="margin-top:12px;padding:8px 12px;background:#f0fdf4;border:1px solid #86efac;border-radius:8px;">
                <span style="font-weight:600;color:#166534;">💰 Prezzo: €${(ris.prezzo||0).toFixed(2)}</span>
                ${ris.dettaglio ? `<div style="font-size:0.8rem;color:#6b7280;margin-top:4px;">${ris.dettaglio}</div>` : ''}
            </div>`;
        } else {
            prezzoInfo = `<div style="margin-top:12px;padding:8px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#991b1b;font-size:0.85rem;">⚠️ ${ris?.errore || 'Errore calcolo prezzo'}</div>`;
        }
    }
    
    return `
        <div class="product-content ${isActive ? 'active' : ''}" data-product="grata">
            ${Object.keys(configGlobale).length > 0 ? `
                <div class="config-globale-box" style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;margin-bottom:16px;">
                    <div style="font-weight:600;color:#991b1b;margin-bottom:8px;cursor:pointer;" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'">
                        ⚙️ Config Globale Grate ▼
                    </div>
                    <div style="display:none;font-size:0.85rem;">
                        ${configGlobale.azienda ? `<div>Azienda: <b>${configGlobale.azienda}</b></div>` : ''}
                        ${configGlobale.linea ? `<div>Linea: <b>${configGlobale.linea}</b></div>` : ''}
                        ${configGlobale.modello ? `<div>Modello: <b>${configGlobale.modello}</b></div>` : ''}
                        ${configGlobale.colore ? `<div>Colore: <b>${configGlobale.colore}</b></div>` : ''}
                    </div>
                </div>
            ` : ''}
            
            <div class="brm-box" style="background:#fef2f2;border-color:#fecaca;">
                <div class="brm-title" style="color:#991b1b;">📐 BRM Grata${brmData.stimato ? ' (da misure foro)' : ''}</div>
                <div class="brm-grid">
                    <div class="brm-item"><div class="brm-label">L</div><div class="brm-value">${brmData.L || 'N/D'} mm</div></div>
                    <div class="brm-item"><div class="brm-label">H</div><div class="brm-value">${brmData.H || 'N/D'} mm</div></div>
                </div>
            </div>
            
            <table class="product-details-table" style="margin-top:12px;">
                <tr><td style="font-weight:600;width:140px;">Quantità:</td><td>${qty}</td></tr>
                <tr><td style="font-weight:600;">Azienda:</td><td>${grata.azienda || '-'}</td></tr>
                <tr><td style="font-weight:600;">Linea:</td><td>${grata.linea || '-'}</td></tr>
                <tr><td style="font-weight:600;">Modello:</td><td>${grata.modello || '-'}</td></tr>
                <tr><td style="font-weight:600;">Apertura:</td><td>${grata.tipoApertura || '-'}</td></tr>
                <tr><td style="font-weight:600;">Colore:</td><td>${grata.colore || '-'}</td></tr>
                <tr><td style="font-weight:600;">Tipo Telaio:</td><td>${grata.tipoTelaio || '-'}</td></tr>
                <tr><td style="font-weight:600;">Snodo:</td><td>${grata.snodo || '-'} mm</td></tr>
                <tr><td style="font-weight:600;">Alt. Cilindro:</td><td>${grata.altezzaCilindro || '-'} mm</td></tr>
                ${(grata.accessori||[]).length > 0 ? `<tr><td style="font-weight:600;">Accessori:</td><td>${grata.accessori.join(', ')}</td></tr>` : ''}
                ${grata.note ? `<tr><td style="font-weight:600;">Note:</td><td>${grata.note}</td></tr>` : ''}
            </table>
            
            ${prezzoInfo}
        </div>
    `;
}

// ============================================================================
// RENDER INFISSO CONTENT - CON OVERRIDE DETECTION
// ============================================================================
function renderInfissoContent(prodotto, brm, isActive) {
    const config = projectData?.configInfissi || {};
    
    // 🆕 v7.94: Genera HTML per Configurazione Globale INFISSO (dentro il tab)
    const configGlobaleInfissoHTML = renderConfigGlobaleInTab('infisso', config);
    
    // Costruisci valori combinati per confronto
    const configFinInt = config.finituraInt ? 
        `${config.finituraInt}${config.coloreInt ? ' + ' + config.coloreInt : ''}` : null;
    const prodFinInt = prodotto.finituraInt ? 
        `${prodotto.finituraInt}${prodotto.coloreInt ? ' + ' + prodotto.coloreInt : ''}` : null;
    
    const configFinEst = config.finituraEst ? 
        `${config.finituraEst}${config.coloreEst ? ' + ' + config.coloreEst : ''}` : null;
    const prodFinEst = prodotto.finituraEst ? 
        `${prodotto.finituraEst}${prodotto.coloreEst ? ' + ' + prodotto.coloreEst : ''}` : null;
    
    const configMan = config.maniglia ? 
        `${config.maniglia}${config.coloreManiglia ? ' + ' + config.coloreManiglia : ''}` : null;
    const prodMan = prodotto.maniglia ? 
        `${prodotto.maniglia}${prodotto.coloreManiglia ? ' + ' + prodotto.coloreManiglia : ''}` : null;
    
    const configTagli = config.tagliTelaio ? 
        `${config.tagliTelaio}${config.codTagli && config.codTagli.length > 0 ? ' [' + config.codTagli.join(', ') + ']' : ''}` : null;
    const prodTagli = prodotto.tagliTelaio ? 
        `${prodotto.tagliTelaio}${prodotto.codTagli && prodotto.codTagli.length > 0 ? ' [' + prodotto.codTagli.join(', ') + ']' : ''}` : null;
    
    // Confronta prodotto con config globale
    const overrides = [];
    
    if (prodotto.azienda && prodotto.azienda !== config.azienda) {
        overrides.push({ label: 'Azienda', old: config.azienda, new: prodotto.azienda });
    }
    if (prodotto.telaio && prodotto.telaio !== config.telaio) {
        overrides.push({ label: 'Telaio', old: config.telaio, new: prodotto.telaio });
    }
    if (prodFinInt && prodFinInt !== configFinInt) {
        overrides.push({ label: 'Finitura INT', old: configFinInt, new: prodFinInt });
    }
    if (prodFinEst && prodFinEst !== configFinEst) {
        overrides.push({ label: 'Finitura EST', old: configFinEst, new: prodFinEst });
    }
    if (prodotto.tipoAnta && prodotto.tipoAnta !== config.tipoAnta) {
        overrides.push({ label: 'Tipo Anta', old: config.tipoAnta, new: prodotto.tipoAnta });
    }
    if (prodotto.vetro && prodotto.vetro !== config.vetro) {
        overrides.push({ label: 'Vetro', old: config.vetro, new: prodotto.vetro });
    }
    if (prodMan && prodMan !== configMan) {
        overrides.push({ label: 'Maniglia', old: configMan, new: prodMan });
    }
    if (prodTagli && prodTagli !== configTagli) {
        overrides.push({ label: 'Tagli Telaio', old: configTagli, new: prodTagli });
    }
    if (prodotto.allarme && prodotto.allarme !== config.allarme) {
        overrides.push({ label: 'Allarme', old: config.allarme, new: prodotto.allarme });
    }
    // v7.78: Override cerniere e tipo apertura
    if (prodotto.cerniere && prodotto.cerniere !== config.cerniere) {
        overrides.push({ label: 'Cerniere', old: config.cerniere || 'N/D', new: prodotto.cerniere });
    }
    if (prodotto.ferramenta?.tipoApertura && 
        prodotto.ferramenta.tipoApertura !== config.ferramenta?.tipoApertura) {
        overrides.push({ 
            label: 'Tipo Apertura', 
            old: formatTipoApertura(config.ferramenta?.tipoApertura) || 'N/D', 
            new: formatTipoApertura(prodotto.ferramenta.tipoApertura) 
        });
    }
    
    const hasOverrides = overrides.length > 0;
    
    return `
        <div class="product-content ${isActive ? 'active' : ''}" data-product="infisso">
            
            ${configGlobaleInfissoHTML}
            
            ${brm.L || brm.H ? `
                <div class="brm-box" ${brm.stimato ? 'style="border: 2px dashed #f59e0b; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);"' : ''}>
                    <div class="brm-title">
                        📐 Misure BRM INFISSO
                        ${brm.stimato ? `<span style="font-size: 0.75rem; color: #92400e; margin-left: 0.5rem;">⚠️ Stimato da ${brm.origine}</span>` : ''}
                    </div>
                    <div class="brm-grid">
                        ${brm.L ? `
                            <div class="brm-item" ${brm.stimato ? 'style="background: #fef3c7;"' : ''}>
                                <div class="brm-label">L (Larghezza) ${brm.stimato ? '⚠️' : ''}</div>
                                <div class="brm-value">${brm.L} mm</div>
                            </div>
                        ` : ''}
                        ${brm.H ? `
                            <div class="brm-item" ${brm.stimato ? 'style="background: #fef3c7;"' : ''}>
                                <div class="brm-label">H (Altezza) ${brm.stimato ? '⚠️' : ''}</div>
                                <div class="brm-value">${brm.H} mm</div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            ` : ''}
            
            <div style="display: flex; gap: 1.5rem; margin-top: 1.5rem; flex-wrap: wrap;">
                ${(prodotto.quantita || prodotto.qta) ? `
                    <div style="background: #e0f2fe; padding: 1rem 1.5rem; border-radius: 8px; flex: 1; min-width: 150px;">
                        <div style="font-size: 0.85rem; font-weight: 600; color: #0369a1; margin-bottom: 0.25rem;">QUANTITÀ</div>
                        <div style="font-size: 1.5rem; font-weight: 700; color: #0c4a6e;">${prodotto.quantita || prodotto.qta}</div>
                    </div>
                ` : ''}
                ${(prodotto.tipo || prodotto.apertura) ? `
                    <div style="background: #dbeafe; padding: 1rem 1.5rem; border-radius: 8px; flex: 2; min-width: 200px;">
                        <div style="font-size: 0.85rem; font-weight: 600; color: #0369a1; margin-bottom: 0.25rem;">TIPO INFISSO</div>
                        <div style="font-size: 1.5rem; font-weight: 700; color: #0c4a6e;">${prodotto.tipo || ''}${prodotto.tipo && prodotto.apertura ? ' + ' : ''}${prodotto.apertura || ''}</div>
                    </div>
                ` : ''}
            </div>
            
            ${prodotto.codiceModello?.startsWith('FS') ? `
                <div style="margin-top: 1.5rem; padding: 1rem 1.5rem; background: linear-gradient(135deg, #ccfbf1 0%, #99f6e4 100%); border-radius: 12px; border-left: 4px solid #0d9488;">
                    <div style="font-size: 0.9rem; font-weight: 700; color: #0f766e; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                        🏠 FIN-SLIDE (ALZANTE SCORREVOLE HST)
                    </div>
                    <div class="wall-chars-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">
                        <div class="wall-char-item" style="background: white;">
                            <div class="wall-char-label">📐 Codice Modello</div>
                            <div class="wall-char-value" style="font-weight: 700; color: #0d9488;">
                                HST ${prodotto.codiceModello.replace('FS', '')}
                            </div>
                            <div style="font-size: 0.75rem; color: #6b7280; margin-top: 2px;">
                                ${prodotto.codiceModello === 'FS600' ? '1 fisso' :
                                  prodotto.codiceModello === 'FS601' ? 'anta + fisso' :
                                  prodotto.codiceModello === 'FS602' ? 'fisso + anta' :
                                  prodotto.codiceModello === 'FS610' ? 'anta + fisso + anta' :
                                  prodotto.codiceModello === 'FS611' ? 'anta + fisso + fisso + anta' :
                                  prodotto.codiceModello === 'FS614' ? '2 ante + fisso' :
                                  prodotto.codiceModello === 'FS615' ? '2 ante collegate + fisso' :
                                  prodotto.codiceModello === 'FS616' ? 'fisso + 2 ante' :
                                  prodotto.codiceModello === 'FS617' ? 'anta + fisso + 2 ante' :
                                  prodotto.codiceModello === 'FS621' ? '2 fissi' : 'FIN-Slide'}
                            </div>
                        </div>
                        ${prodotto.finslideTelaio ? `
                            <div class="wall-char-item" style="background: white;">
                                <div class="wall-char-label">🏗️ Tipo Telaio</div>
                                <div class="wall-char-value" style="font-weight: 700; color: #0d9488;">
                                    ${prodotto.finslideTelaio}
                                </div>
                                <div style="font-size: 0.75rem; color: #6b7280; margin-top: 2px;">
                                    ${prodotto.finslideTelaio === '90' ? 'PVC-PVC' :
                                      prodotto.finslideTelaio === '090' ? '090 Hide' :
                                      prodotto.finslideTelaio === '38' ? 'ALU-PVC' :
                                      prodotto.finslideTelaio === '38B' ? 'ALU B' :
                                      prodotto.finslideTelaio === '38C' ? 'ALU-ALU' : ''}
                                </div>
                            </div>
                        ` : ''}
                        ${prodotto.finslideAnta ? `
                            <div class="wall-char-item" style="background: white;">
                                <div class="wall-char-label">🚪 Tipo Anta</div>
                                <div class="wall-char-value" style="font-weight: 700; color: #0d9488;">
                                    ${prodotto.finslideAnta}
                                </div>
                            </div>
                        ` : ''}
                        ${prodotto.finslideFerramenta ? `
                            <div class="wall-char-item" style="background: white;">
                                <div class="wall-char-label">🔧 Ferramenta</div>
                                <div class="wall-char-value" style="font-weight: 700; color: #0d9488;">
                                    ${prodotto.finslideFerramenta}
                                </div>
                                <div style="font-size: 0.75rem; color: #6b7280; margin-top: 2px;">
                                    ${prodotto.finslideFerramenta.startsWith('8') ? '≤250kg' : '>250kg'}
                                    ${prodotto.finslideFerramenta.endsWith('.3') ? ' + sicurezza' : ''}
                                </div>
                            </div>
                        ` : ''}
                        ${prodotto.finslideLato ? `
                            <div class="wall-char-item" style="background: white;">
                                <div class="wall-char-label">↔️ Lato Apertura</div>
                                <div class="wall-char-value" style="font-weight: 700; color: #0d9488;">
                                    ${prodotto.finslideLato === 'L' ? 'Sinistra' : 'Destra'}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            ` : (prodotto.codiceModello || prodotto.ferramenta1 || prodotto.cerniere || prodotto.ferramenta) ? `
                <div style="margin-top: 1.5rem; padding: 1rem 1.5rem; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; border-left: 4px solid #d97706;">
                    <div style="font-size: 0.9rem; font-weight: 700; color: #92400e; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                        🔩 APERTURA E FERRAMENTA
                    </div>
                    <div class="wall-chars-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
                        ${prodotto.codiceModello ? `
                            <div class="wall-char-item" style="background: white;">
                                <div class="wall-char-label">📐 Codice Modello</div>
                                <div class="wall-char-value" style="font-weight: 700; color: #0c4a6e;">
                                    ${prodotto.codiceModello}
                                </div>
                                <div style="font-size: 0.75rem; color: #6b7280; margin-top: 2px;">
                                    ${FINSTRAL_CODICI.getModello(prodotto.codiceModello).descrizione}
                                </div>
                            </div>
                        ` : ''}
                        ${prodotto.ferramenta1 ? `
                            <div class="wall-char-item" style="background: white;">
                                <div class="wall-char-label">🔧 Ferramenta</div>
                                <div class="wall-char-value" style="font-weight: 700; color: #0c4a6e;">
                                    ${prodotto.ferramenta1}${prodotto.lato1 || ''}
                                </div>
                                <div style="font-size: 0.75rem; color: #6b7280; margin-top: 2px;">
                                    ${FINSTRAL_CODICI.getFerramenta(prodotto.ferramenta1).descrizione}
                                </div>
                            </div>
                        ` : ''}
                        ${(prodotto.cerniere || FINSTRAL_CODICI.getFerramenta(prodotto.ferramenta1)?.cerniere) ? `
                            <div class="wall-char-item" style="background: white;">
                                <div class="wall-char-label">🔗 Cerniere</div>
                                <div class="wall-char-value" style="font-weight: 600; color: ${(prodotto.cerniere || FINSTRAL_CODICI.getFerramenta(prodotto.ferramenta1)?.cerniere) === 'a-scomparsa' ? '#059669' : '#1f2937'};">
                                    ${(prodotto.cerniere || FINSTRAL_CODICI.getFerramenta(prodotto.ferramenta1)?.cerniere) === 'a-scomparsa' ? '🔒 A scomparsa' : '👁️ A vista'}
                                </div>
                            </div>
                        ` : ''}
                        ${prodotto.esecuzione1 ? `
                            <div class="wall-char-item" style="background: white;">
                                <div class="wall-char-label">🛡️ Sicurezza</div>
                                <div class="wall-char-value">${FINSTRAL_CODICI.getEsecuzione(prodotto.esecuzione1)}</div>
                            </div>
                        ` : ''}
                        ${prodotto.ferramenta?.tipoApertura ? `
                            <div class="wall-char-item" style="background: white;">
                                <div class="wall-char-label">🚪 Tipo Apertura</div>
                                <div class="wall-char-value">${formatTipoApertura(prodotto.ferramenta.tipoApertura)}</div>
                            </div>
                        ` : ''}
                        ${prodotto.ferramenta?.supplemento > 0 ? `
                            <div class="wall-char-item" style="background: white;">
                                <div class="wall-char-label">💰 Supplemento</div>
                                <div class="wall-char-value" style="color: #dc2626; font-weight: 700;">€ ${prodotto.ferramenta.supplemento.toFixed(2)}</div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            ` : ''}
            
            ${!hasOverrides ? `
                <div style="margin-top: 1.5rem; padding: 1rem 1.5rem; background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); border-radius: 8px; border-left: 4px solid #10b981;">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <span style="font-size: 1.5rem;">✅</span>
                        <div>
                            <div style="font-weight: 700; color: #065f46; font-size: 1.1rem;">Usa configurazione globale</div>
                            <div style="color: #047857; font-size: 0.9rem;">Tutte le caratteristiche ereditate dalla config globale</div>
                        </div>
                    </div>
                </div>
            ` : `
                <div style="margin-top: 1.5rem; padding: 1.5rem; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 8px; border-left: 4px solid #f59e0b;">
                    <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem;">
                        <span style="font-size: 1.5rem;">⚠️</span>
                        <div style="font-weight: 700; color: #92400e; font-size: 1.1rem;">MODIFICHE LOCALI</div>
                    </div>
                    <div style="display: grid; gap: 0.75rem;">
                        ${overrides.map(o => `
                            <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: white; border-radius: 6px;">
                                <span style="font-size: 1.25rem;">🔄</span>
                                <div style="flex: 1;">
                                    <span style="font-weight: 600; color: #1f2937;">${o.label}:</span>
                                    <span style="color: #6b7280; text-decoration: line-through; margin: 0 0.5rem;">${o.old || 'N/D'}</span>
                                    <span style="color: #6b7280;">→</span>
                                    <span style="color: #059669; font-weight: 600; margin-left: 0.5rem;">${o.new}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `}
        </div>
    `;
}

function setupProductTabs() {
    // Già gestito con onclick inline
}

function switchProductTab(tipo, event) {
    // ✅ v7.75 FIX: Opera solo nel contenitore della posizione corrente
    if (!event || !event.target) return;
    
    // Trova il contenitore .position-section che contiene questo tab
    const container = event.target.closest('.position-section');
    if (!container) {
        console.warn('⚠️ switchProductTab: contenitore non trovato');
        return;
    }
    
    // Rimuovi active solo dai tab e contenuti DENTRO questo contenitore
    container.querySelectorAll('.product-tab').forEach(tab => tab.classList.remove('active'));
    container.querySelectorAll('.product-content').forEach(content => content.classList.remove('active'));
    
    // Attiva tab cliccato
    event.target.classList.add('active');
    
    // Attiva contenuto corrispondente DENTRO questo contenitore
    const targetContent = container.querySelector(`.product-content[data-product="${tipo}"]`);
    if (targetContent) {
        targetContent.classList.add('active');
    }
    
    console.log(`📦 Tab prodotto: ${tipo} (contenitore isolato)`);
}

// ============================================================================
// SEZIONE E: SITUAZIONE PREESISTENTE - TUTTI I PRODOTTI
// ============================================================================
function renderPositionPreexisting(pos) {
    const rilievi = {
        infissi: pos.rilievo_preesistente || {},
        persiane: pos.rilievo_persiane || {},
        tapparelle: pos.rilievo_tapparelle || {},
        zanzariere: pos.rilievo_zanzariere || {},
        cassonetti: pos.rilievo_cassonetti || {}
    };
    
    // Verifica se c'è almeno un rilievo compilato
    const hasData = Object.values(rilievi).some(r => 
        r.materiale || r.togliere || r.smaltimento || r.tipologia || r.stato
    );
    
    if (!hasData) return '';
    
    let html = `<div class="position-section">
        <h3 class="position-section-title">
            <span class="position-section-icon">🔄</span>
            Situazione Preesistente
        </h3>`;
    
    // INFISSI
    if (rilievi.infissi.materiale || rilievi.infissi.togliere || rilievi.infissi.smaltimento) {
        html += `
            <div style="margin-bottom: 15px;">
                <h4 style="font-weight: 600; color: #4b5563; margin-bottom: 8px;">🪟 Infissi</h4>
                <div class="wall-chars-grid">
                    ${rilievi.infissi.materiale ? `
                        <div class="wall-char-item">
                            <div class="wall-char-label">Materiale</div>
                            <div class="wall-char-value">${rilievi.infissi.materiale}</div>
                        </div>
                    ` : ''}
                    ${rilievi.infissi.togliere ? `
                        <div class="wall-char-item">
                            <div class="wall-char-label">Da Togliere</div>
                            <div class="wall-char-value">✅ Sì</div>
                        </div>
                    ` : ''}
                    ${rilievi.infissi.smaltimento ? `
                        <div class="wall-char-item">
                            <div class="wall-char-label">Smaltimento</div>
                            <div class="wall-char-value">✅ Necessario</div>
                        </div>
                    ` : ''}
                    ${rilievi.infissi.coprifiliInt ? `
                        <div class="wall-char-item">
                            <div class="wall-char-label">Coprifili Int</div>
                            <div class="wall-char-value">✅ Presente</div>
                        </div>
                    ` : ''}
                    ${rilievi.infissi.coprifiliEst ? `
                        <div class="wall-char-item">
                            <div class="wall-char-label">Coprifili Est</div>
                            <div class="wall-char-value">✅ Presente</div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    // PERSIANE
    if (rilievi.persiane.materiale || rilievi.persiane.togliere || rilievi.persiane.smaltimento) {
        html += `
            <div style="margin-bottom: 15px;">
                <h4 style="font-weight: 600; color: #4b5563; margin-bottom: 8px;">🚪 Persiane</h4>
                <div class="wall-chars-grid">
                    ${rilievi.persiane.materiale ? `
                        <div class="wall-char-item">
                            <div class="wall-char-label">Materiale</div>
                            <div class="wall-char-value">${rilievi.persiane.materiale}</div>
                        </div>
                    ` : ''}
                    ${rilievi.persiane.togliere ? `
                        <div class="wall-char-item">
                            <div class="wall-char-label">Da Togliere</div>
                            <div class="wall-char-value">✅ Sì</div>
                        </div>
                    ` : ''}
                    ${rilievi.persiane.smaltimento ? `
                        <div class="wall-char-item">
                            <div class="wall-char-label">Smaltimento</div>
                            <div class="wall-char-value">✅ Necessario</div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    // TAPPARELLE
    if (rilievi.tapparelle.materiale || rilievi.tapparelle.togliere || rilievi.tapparelle.smaltimento) {
        html += `
            <div style="margin-bottom: 15px;">
                <h4 style="font-weight: 600; color: #4b5563; margin-bottom: 8px;">📦 Tapparelle</h4>
                <div class="wall-chars-grid">
                    ${rilievi.tapparelle.materiale ? `
                        <div class="wall-char-item">
                            <div class="wall-char-label">Materiale</div>
                            <div class="wall-char-value">${rilievi.tapparelle.materiale}</div>
                        </div>
                    ` : ''}
                    ${rilievi.tapparelle.togliere ? `
                        <div class="wall-char-item">
                            <div class="wall-char-label">Da Togliere</div>
                            <div class="wall-char-value">✅ Sì</div>
                        </div>
                    ` : ''}
                    ${rilievi.tapparelle.smaltimento ? `
                        <div class="wall-char-item">
                            <div class="wall-char-label">Smaltimento</div>
                            <div class="wall-char-value">✅ Necessario</div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    // ZANZARIERE
    if (rilievi.zanzariere.materiale || rilievi.zanzariere.togliere || rilievi.zanzariere.smaltimento) {
        html += `
            <div style="margin-bottom: 15px;">
                <h4 style="font-weight: 600; color: #4b5563; margin-bottom: 8px;">🪰 Zanzariere</h4>
                <div class="wall-chars-grid">
                    ${rilievi.zanzariere.materiale ? `
                        <div class="wall-char-item">
                            <div class="wall-char-label">Materiale</div>
                            <div class="wall-char-value">${rilievi.zanzariere.materiale}</div>
                        </div>
                    ` : ''}
                    ${rilievi.zanzariere.togliere ? `
                        <div class="wall-char-item">
                            <div class="wall-char-label">Da Togliere</div>
                            <div class="wall-char-value">✅ Sì</div>
                        </div>
                    ` : ''}
                    ${rilievi.zanzariere.smaltimento ? `
                        <div class="wall-char-item">
                            <div class="wall-char-label">Smaltimento</div>
                            <div class="wall-char-value">✅ Necessario</div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    // CASSONETTI
    if (rilievi.cassonetti.materiale || rilievi.cassonetti.togliere || rilievi.cassonetti.smaltimento) {
        html += `
            <div style="margin-bottom: 15px;">
                <h4 style="font-weight: 600; color: #4b5563; margin-bottom: 8px;">📦 Cassonetti</h4>
                <div class="wall-chars-grid">
                    ${rilievi.cassonetti.materiale ? `
                        <div class="wall-char-item">
                            <div class="wall-char-label">Materiale</div>
                            <div class="wall-char-value">${rilievi.cassonetti.materiale}</div>
                        </div>
                    ` : ''}
                    ${rilievi.cassonetti.togliere ? `
                        <div class="wall-char-item">
                            <div class="wall-char-label">Da Togliere</div>
                            <div class="wall-char-value">✅ Sì</div>
                        </div>
                    ` : ''}
                    ${rilievi.cassonetti.smaltimento ? `
                        <div class="wall-char-item">
                            <div class="wall-char-label">Smaltimento</div>
                            <div class="wall-char-value">✅ Necessario</div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    html += `</div>`;
    return html;
}

// ============================================================================
// SEZIONE F: NOTE TECNICHE
// ============================================================================
function renderPositionNotes(pos) {
    const hasNotes = pos.note || pos.note_tecniche || pos.note_montaggio;
    
    if (!hasNotes) return '';
    
    return `
        <div class="position-section">
            <h3 class="position-section-title">
                <span class="position-section-icon">📝</span>
                Note Tecniche e Criticità
            </h3>
            
            <div class="notes-tags">
                ${pos.urgente ? '<span class="note-tag urgente">⚠️ URGENTE</span>' : ''}
                ${pos.da_verificare ? '<span class="note-tag verificare">🔍 Da Verificare</span>' : ''}
                ${pos.richiesta_cliente ? '<span class="note-tag richiesta">💬 Richiesta Cliente</span>' : ''}
                ${pos.problema_accesso ? '<span class="note-tag problema">🚧 Problema Accesso</span>' : ''}
            </div>
            
            <div class="notes-content">
                ${pos.note || pos.note_tecniche || pos.note_montaggio || 'Nessuna nota'}
            </div>
        </div>
    `;
}

// ============================================================================
// NAVIGAZIONE POSIZIONI
// ============================================================================
function renderPositionNavigation(index) {
    const hasPrev = index > 0;
    const hasNext = index < filteredPositions.length - 1;
    
    return `
        <div class="position-navigation">
            <button class="nav-btn-position" 
                    onclick="navigatePosition(-1)" 
                    ${!hasPrev ? 'disabled' : ''}>
                ← Posizione Precedente
            </button>
            <button class="nav-btn-position" 
                    onclick="navigatePosition(1)" 
                    ${!hasNext ? 'disabled' : ''}>
                Posizione Successiva →
            </button>
        </div>
    `;
}

function navigatePosition(direction) {
    const newIndex = currentPositionIndex + direction;
    if (newIndex >= 0 && newIndex < filteredPositions.length) {
        selectPosition(newIndex);
    }
}

// Keyboard shortcuts per navigazione posizioni
document.addEventListener('keydown', (e) => {
    // Solo se Vista Posizioni è attiva
    const vistaActive = document.getElementById('vista-posizioni-ufficio').classList.contains('active');
    if (!vistaActive) return;
    
    if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigatePosition(-1);
    } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigatePosition(1);
    }
});

// ============================================================================
// MODIFICHE FUNZIONE LOAD DATA PER ATTIVARE VISTA POSIZIONI
// ============================================================================
// Modifichiamo la funzione handleDataLoad esistente per popolare anche Vista Posizioni

// ============================================================================
// BLOCCO POSA - STATO E NAVIGAZIONE
// ============================================================================
let posaState = {
    currentView: 'generale', // 'generale' o 'posizioni'
    currentPositionIndex: 0,
    totalPositions: 0,
    positions: []
};

/**
 * Apri Posa App separata in nuova finestra
 * v7.29
 */
function apriPosaApp() {
    // Verifica che ci sia un progetto caricato
    if (!appState.rilievoData) {
        alert('⚠️ Carica prima un progetto per aprire la Posa App!');
        return;
    }
    
    // Ottieni ID progetto
    const projectId = appState.rilievoData.id || appState.rilievoData.codiceCommessa || 'progetto';
    
    // Salva ID in localStorage per la Posa App
    localStorage.setItem('posa_app_project_id', projectId);
    
    console.log('🔗 Apertura Posa App per progetto:', projectId);
    
    // Apri Posa App in nuova finestra
    const posaWindow = window.open(
        'https://openporte2025.github.io/posa-app/',
        'PosaApp',
        'width=1400,height=900,menubar=no,toolbar=no,location=no,status=yes,scrollbars=yes,resizable=yes'
    );
    
    if (!posaWindow) {
        alert('⚠️ Popup bloccato!\n\nAbilita i popup per questo sito nelle impostazioni del browser.');
    } else {
        console.log('✅ Posa App aperta in nuova finestra');
    }
}

// Switch tra viste Posa
function switchVistaPosa(vista, event) {
    console.log(`Switching Posa vista to: ${vista}`);
    posaState.currentView = vista;
    
    // v7.20: Gestisci stati bottoni submenu
    if (event) {
        document.querySelectorAll('.submenu-btn-posa').forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');
    }
    
    // Nascondi tutte le viste posa
    document.querySelectorAll('.posa-view').forEach(v => v.style.display = 'none');
    
    // Mostra vista selezionata
    if (vista === 'generale') {
        document.getElementById('posa-generale').style.display = 'block';
        if (appState.rilievoData) {
            renderVistaGeneraleCantiere(appState.rilievoData);
        }
    } else if (vista === 'posizioni') {
        document.getElementById('posa-posizioni').style.display = 'block';
        if (appState.rilievoData) {
            renderVistaPosizioneCantiere(appState.rilievoData);
        }
    } else if (vista === 'dettaglio') {
        // v7.20: Vista dettaglio posa
        document.getElementById('posa-dettaglio').style.display = 'block';
        if (appState.rilievoData) {
            document.getElementById('posaDettaglioPlaceholder').style.display = 'none';
            document.getElementById('posaDettaglioContent').style.display = 'block';
            renderDettaglioPosa();
        } else {
            document.getElementById('posaDettaglioPlaceholder').style.display = 'block';
            document.getElementById('posaDettaglioContent').style.display = 'none';
        }
    }
}

// ============================================================================
// VISTA 3.1 - GENERALE CANTIERE
// ============================================================================
function renderVistaGeneraleCantiere(data) {
    console.log('🏗️ Rendering Vista Generale Cantiere...');
    
    const placeholder = document.getElementById('posaCantierePlaceholder');
    const content = document.getElementById('posaCantiereContent');
    
    if (!data || !data.posizioni) {
        placeholder.style.display = 'block';
        content.style.display = 'none';
        return;
    }
    
    placeholder.style.display = 'none';
    content.style.display = 'block';
    
    let html = '';
    
    // SEZIONE A - MATERIALI DA PORTARE
    html += renderMaterialiDaPortare(data.posizioni);
    
    // SEZIONE B - STRUMENTI NECESSARI
    html += renderStrumentiNecessari(data.posizioni);
    
    // SEZIONE C - ORDINE MONTAGGIO
    html += renderOrdineMontaggio(data.posizioni);
    
    // SEZIONE D - CHECKLIST PREPARAZIONE
    html += renderChecklistPreparazione();
    
    // SEZIONE E - INFO LOGISTICHE
    html += renderInfoLogistiche(data);
    
    content.innerHTML = html;
    
    // Setup event listeners per checklist
    setupChecklistListeners();
}

function renderMaterialiDaPortare(posizioni) {
    // Raggruppa materiali per tipo
    const materiali = {
        infissi: [],
        persiane: [],
        tapparelle: [],
        zanzariere: [],
        cassonetti: [],
        accessori: []
    };
    
    posizioni.forEach(pos => {
        if (hasQta(pos.infisso)) {
            materiali.infissi.push({
                tipo: pos.infisso.tipo || 'N/D',
                azienda: pos.infisso.azienda || 'N/D',
                quantita: getQta(pos.infisso),
                brm: pos.infisso.brm || {},
                posizione: pos.ambiente || pos.nome || pos.stanza || pos.id
            });
        }
        
        if (hasQta(pos.persiana)) {
            materiali.persiane.push({
                tipo: pos.persiana.tipo || 'Persiana',
                azienda: pos.persiana.azienda || 'N/D',
                quantita: getQta(pos.persiana),
                brm: pos.persiana.brm || {},
                posizione: pos.ambiente || pos.nome || pos.stanza || pos.id
            });
        }
        
        if (hasQta(pos.tapparella)) {
            materiali.tapparelle.push({
                tipo: pos.tapparella.tipo || 'Tapparella',
                motorizzata: pos.tapparella.motorizzazione !== 'manuale',
                azienda: pos.tapparella.azienda || 'N/D',
                quantita: getQta(pos.tapparella),
                brm: pos.tapparella.brm || {},
                posizione: pos.ambiente || pos.nome || pos.stanza || pos.id
            });
        }
        
        if (hasQta(pos.zanzariera)) {
            materiali.zanzariere.push({
                tipo: pos.zanzariera.tipo || 'Zanzariera',
                quantita: getQta(pos.zanzariera),
                brm: pos.zanzariera.brm || {},
                posizione: pos.ambiente || pos.nome || pos.stanza || pos.id
            });
        }
        
        if (hasQta(pos.cassonetto)) {
            materiali.cassonetti.push({
                tipo: pos.cassonetto.tipo || 'Cassonetto',
                quantita: getQta(pos.cassonetto),
                brm: pos.cassonetto.brm || {},
                posizione: pos.ambiente || pos.nome || pos.stanza || pos.id
            });
        }
    });
    
    let html = `
        <div class="cantiere-section">
            <h2 class="cantiere-section-title">📦 Materiali da Portare</h2>
            <div class="materials-grid">
    `;
    
    // INFISSI
    if (materiali.infissi.length > 0) {
        html += `
            <div class="material-category">
                <div class="material-category-title">🪟 INFISSI</div>
        `;
        materiali.infissi.forEach(item => {
            html += `
                <div class="material-item">
                    <strong>${item.azienda} - ${item.tipo} (x${item.quantita})</strong>
                    ${item.brm.L ? `L: ${item.brm.L}mm × H: ${item.brm.H}mm` : ''}
                    <br><small>Posizione: ${item.posizione}</small>
                </div>
            `;
        });
        html += `</div>`;
    }
    
    // PERSIANE
    if (materiali.persiane.length > 0) {
        html += `
            <div class="material-category">
                <div class="material-category-title">🪟 PERSIANE</div>
        `;
        materiali.persiane.forEach(item => {
            html += `
                <div class="material-item">
                    <strong>${item.azienda} - ${item.tipo} (x${item.quantita})</strong>
                    ${item.brm.L ? `L: ${item.brm.L}mm × H: ${item.brm.H}mm` : ''}
                    <br><small>Posizione: ${item.posizione}</small>
                </div>
            `;
        });
        html += `</div>`;
    }
    
    // TAPPARELLE
    if (materiali.tapparelle.length > 0) {
        html += `
            <div class="material-category">
                <div class="material-category-title">🪟 TAPPARELLE</div>
        `;
        materiali.tapparelle.forEach(item => {
            html += `
                <div class="material-item">
                    <strong>${item.azienda} - ${item.tipo} (x${item.quantita})</strong>
                    ${item.motorizzata ? '⚡ Motorizzata' : 'Manuale'}
                    ${item.brm.L ? `<br>L: ${item.brm.L}mm × H: ${item.brm.H}mm` : ''}
                    <br><small>Posizione: ${item.posizione}</small>
                </div>
            `;
        });
        html += `</div>`;
    }
    
    // ZANZARIERE
    if (materiali.zanzariere.length > 0) {
        html += `
            <div class="material-category">
                <div class="material-category-title">🦟 ZANZARIERE</div>
        `;
        materiali.zanzariere.forEach(item => {
            html += `
                <div class="material-item">
                    <strong>${item.tipo} (x${item.quantita})</strong>
                    ${item.brm.L ? `L: ${item.brm.L}mm × H: ${item.brm.H}mm` : ''}
                    <br><small>Posizione: ${item.posizione}</small>
                </div>
            `;
        });
        html += `</div>`;
    }
    
    // CASSONETTI
    if (materiali.cassonetti.length > 0) {
        html += `
            <div class="material-category">
                <div class="material-category-title">📦 CASSONETTI</div>
        `;
        materiali.cassonetti.forEach(item => {
            html += `
                <div class="material-item">
                    <strong>${item.tipo} (x${item.quantita})</strong>
                    ${item.brm.L ? `L: ${item.brm.L}mm × H: ${item.brm.H}mm` : ''}
                    <br><small>Posizione: ${item.posizione}</small>
                </div>
            `;
        });
        html += `</div>`;
    }
    
    // ACCESSORI
    html += `
        <div class="material-category">
            <div class="material-category-title">🔧 ACCESSORI</div>
            <div class="material-item"><strong>Viti e tasselli</strong></div>
            <div class="material-item"><strong>Silicone</strong></div>
            <div class="material-item"><strong>Guarnizioni</strong></div>
            <div class="material-item"><strong>Coprifili</strong></div>
        </div>
    `;
    
    html += `
            </div>
        </div>
    `;
    
    return html;
}

function renderStrumentiNecessari(posizioni) {
    const strumenti = [
        'Trapano elettrico',
        'Livella laser',
        'Metro a nastro (5m)',
        'Seghetto alternativo',
        'Cacciaviti (set completo)',
        'Chiavi inglesi',
        'Martello',
        'Pistola silicone',
        'Aspiratore/Soffiatore',
        'Scala telescopica',
        'Protezioni (occhiali, guanti)',
        'Materiale imballaggio vecchi infissi'
    ];
    
    let html = `
        <div class="cantiere-section">
            <h2 class="cantiere-section-title">🛠️ Strumenti Necessari</h2>
            <div class="tools-checklist">
    `;
    
    strumenti.forEach((strumento, index) => {
        html += `
            <div class="tool-item">
                <input type="checkbox" class="tool-checkbox" id="tool-${index}" 
                       onchange="saveToolCheck(${index}, this.checked)">
                <label for="tool-${index}">${strumento}</label>
            </div>
        `;
    });
    
    html += `
            </div>
        </div>
    `;
    
    return html;
}

function renderOrdineMontaggio(posizioni) {
    // Raggruppa per piano
    const perPiano = {};
    posizioni.forEach(pos => {
        const piano = pos.piano || 'Non specificato';
        if (!perPiano[piano]) {
            perPiano[piano] = [];
        }
        perPiano[piano].push(pos);
    });
    
    let html = `
        <div class="cantiere-section">
            <h2 class="cantiere-section-title">📋 Ordine Montaggio Suggerito</h2>
            <div class="mounting-order">
    `;
    
    let stepNum = 1;
    Object.keys(perPiano).sort().forEach(piano => {
        html += `
            <div class="order-step">
                <span class="order-step-number">${stepNum}</span>
                <strong>${piano}</strong>
                <div style="margin-left: 3rem; margin-top: 0.5rem;">
        `;
        
        // Raggruppa per stanza in questo piano
        const perStanza = {};
        perPiano[piano].forEach(pos => {
            const stanza = pos.stanza || 'Non specificata';
            if (!perStanza[stanza]) {
                perStanza[stanza] = [];
            }
            perStanza[stanza].push(pos);
        });
        
        Object.keys(perStanza).forEach((stanza, idx) => {
            html += `${idx > 0 ? ' → ' : ''}${stanza} (${perStanza[stanza].length} pos.)`;
        });
        
        html += `
                </div>
            </div>
        `;
        stepNum++;
    });
    
    html += `
            </div>
            <div style="margin-top: 1rem; padding: 1rem; background: #fef3c7; border-radius: 8px;">
                💡 <strong>Suggerimento:</strong> Procedere dal basso verso l'alto per ottimizzare i tempi e ridurre i trasporti di materiale.
            </div>
        </div>
    `;
    
    return html;
}

function renderChecklistPreparazione() {
    const checklist = {
        'Pre-cantiere': [
            'Materiali caricati su furgone',
            'Strumenti verificati e funzionanti',
            'Squadra informata e briefing fatto',
            'Cliente avvisato orario arrivo',
            'Accessi e parcheggio verificati'
        ],
        'Durante lavori': [
            'Protezioni pavimenti/mobili posizionate',
            'Aspiratore/soffiatore pronto',
            'Area lavoro delimitata',
            'Contenitori per smaltimento predisposti'
        ],
        'Fine lavori': [
            'Pulizia completa area lavoro',
            'Smaltimento rifiuti organizzato',
            'Verifica con cliente',
            'Documenti firmati'
        ]
    };
    
    let html = `
        <div class="cantiere-section">
            <h2 class="cantiere-section-title">✅ Checklist Preparazione</h2>
            <div class="preparation-checklist">
    `;
    
    Object.keys(checklist).forEach(gruppo => {
        html += `
            <div class="checklist-group">
                <div class="checklist-group-title">${gruppo}</div>
        `;
        
        checklist[gruppo].forEach((item, index) => {
            const itemId = `prep-${gruppo.replace(/\s+/g, '-')}-${index}`;
            html += `
                <div class="checklist-item" id="item-${itemId}">
                    <input type="checkbox" id="${itemId}" 
                           onchange="toggleChecklistItem('${itemId}', this.checked)">
                    <label for="${itemId}">${item}</label>
                </div>
            `;
        });
        
        html += `</div>`;
    });
    
    html += `
            </div>
        </div>
    `;
    
    return html;
}

function renderInfoLogistiche(data) {
    const cliente = data.cliente || {};
    
    let html = `
        <div class="cantiere-section">
            <h2 class="cantiere-section-title">📍 Informazioni Logistiche</h2>
            <div class="logistics-info">
                <div class="logistics-item">
                    <span class="logistics-label">🏠 Indirizzo cantiere:</span>
                    <span class="logistics-value">${cliente.indirizzo || 'Non specificato'}</span>
                </div>
                <div class="logistics-item">
                    <span class="logistics-label">📅 Piano:</span>
                    <span class="logistics-value">${cliente.piano || 'Non specificato'}</span>
                </div>
                <div class="logistics-item">
                    <span class="logistics-label">👤 Referente:</span>
                    <span class="logistics-value">${cliente.nome || 'Non specificato'}</span>
                </div>
                <div class="logistics-item">
                    <span class="logistics-label">📞 Telefono:</span>
                    <span class="logistics-value">${cliente.telefono || 'Non specificato'}</span>
                </div>
                <div class="logistics-item">
                    <span class="logistics-label">⏰ Orari accesso:</span>
                    <span class="logistics-value">Da concordare</span>
                </div>
                <div class="logistics-item">
                    <span class="logistics-label">🅿️ Parcheggio:</span>
                    <span class="logistics-value">Da verificare</span>
                </div>
                ${data.note_progetto ? `
                <div class="logistics-item" style="border-top: 2px solid #f59e0b; margin-top: 1rem; padding-top: 1rem;">
                    <span class="logistics-label">📝 Note progetto:</span>
                    <span class="logistics-value">${data.note_progetto}</span>
                </div>
                ` : ''}
            </div>
        </div>
    `;
    
    return html;
}

// ============================================================================
// VISTA 3.2 - POSIZIONI CANTIERE
// ============================================================================
function renderVistaPosizioneCantiere(data) {
    console.log('🔨 Rendering Vista Posizioni Cantiere...');
    
    if (!data || !data.posizioni || data.posizioni.length === 0) {
        return;
    }
    
    posaState.positions = data.posizioni;
    posaState.totalPositions = data.posizioni.length;
    posaState.currentPositionIndex = 0;
    
    renderSchedaMontaggio();
}

function renderSchedaMontaggio() {
    const pos = posaState.positions[posaState.currentPositionIndex];
    if (!pos) return;
    
    const content = document.getElementById('posaPositionContent');
    if (!content) return;
    
    // Update header info
    document.getElementById('posaCurrentPositionId').textContent = pos.id || 'N/D';
    document.getElementById('posaCurrentLocation').textContent = 
        `${pos.piano || 'N/D'} | ${pos.stanza || 'N/D'} | ${pos.ambiente || 'N/D'}`;
    
    // Update navigation buttons
    document.getElementById('posaPrevBtn').disabled = (posaState.currentPositionIndex === 0);
    document.getElementById('posaNextBtn').disabled = (posaState.currentPositionIndex === posaState.totalPositions - 1);
    
    let html = '';
    
    // MISURE BRM GRANDI
    html += renderMisureBRMGrandi(pos);
    
    // CARATTERISTICHE MURO
    html += renderCaratteristicheMuro(pos);
    
    // ISTRUZIONI MONTAGGIO
    html += renderIstruzioniMontaggio(pos);
    
    // MATERIALI SPECIFICI
    html += renderMaterialiPosizione(pos);
    
    // NOTE E ALERT
    html += renderNoteAlert(pos);
    
    // CHECKLIST OPERAZIONI
    html += renderChecklistOperazioni(pos);
    
    content.innerHTML = html;
    
    // Restore checklist state
    restoreChecklistState(pos.id);
}

function renderMisureBRMGrandi(pos) {
    let html = '<div class="brm-section">';
    html += '<h2 class="cantiere-section-title">📏 Misure BRM</h2>';
    
    // INFISSO
    if (hasQta(pos.infisso)) {
        // 🔧 COMPATIBILITÀ: Legge sia brm.L che BRM_L
        const L = pos.infisso.brm?.L || pos.infisso.BRM_L || 0;
        const H = pos.infisso.brm?.H || pos.infisso.BRM_H || 0;
        const C = pos.infisso.brm?.C || pos.infisso.BRM_C || 0;
        const B = pos.infisso.brm?.B || pos.infisso.BRM_B || 0;
        
        if (L || H) {  // Mostra solo se ha misure
            html += `
                <div class="brm-box-large">
                    <div class="brm-product-title">🪟 INFISSO ${pos.infisso.tipo || ''}</div>
                    <div class="brm-measurements">
                        ${L ? `
                            <div class="brm-measure">
                                <div class="brm-label">Larghezza (L)</div>
                                <div class="brm-value">${L}<span class="brm-unit">mm</span></div>
                            </div>
                        ` : ''}
                        ${H ? `
                            <div class="brm-measure">
                                <div class="brm-label">Altezza (H)</div>
                                <div class="brm-value">${H}<span class="brm-unit">mm</span></div>
                            </div>
                        ` : ''}
                        ${C ? `
                            <div class="brm-measure">
                                <div class="brm-label">Cassettone (C)</div>
                                <div class="brm-value">${C}<span class="brm-unit">mm</span></div>
                            </div>
                        ` : ''}
                        ${B ? `
                            <div class="brm-measure">
                                <div class="brm-label">Base (B)</div>
                                <div class="brm-value">${B}<span class="brm-unit">mm</span></div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }
    }
    
    // TAPPARELLA
    if (hasQta(pos.tapparella) && pos.tapparella.brm) {
        const brm = pos.tapparella.brm;
        html += `
            <div class="brm-box-large">
                <div class="brm-product-title">🪟 TAPPARELLA</div>
                <div class="brm-measurements">
                    <div class="brm-measure">
                        <div class="brm-label">Larghezza (L)</div>
                        <div class="brm-value">${brm.L || 0}<span class="brm-unit">mm</span></div>
                    </div>
                    <div class="brm-measure">
                        <div class="brm-label">Altezza (H)</div>
                        <div class="brm-value">${brm.H || 0}<span class="brm-unit">mm</span></div>
                    </div>
                    <div class="brm-measure">
                        <div class="brm-label">Cassettone (C)</div>
                        <div class="brm-value">${brm.C || 0}<span class="brm-unit">mm</span></div>
                    </div>
                    <div class="brm-measure">
                        <div class="brm-label">Base (B)</div>
                        <div class="brm-value">${brm.B || 0}<span class="brm-unit">mm</span></div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // CASSONETTO
    if (hasQta(pos.cassonetto)) {
        const cass = pos.cassonetto;
        const brm = cass.brm || {};
        const hasRilevate = cass.LS || cass.HCASS || cass.B || cass.C;
        
        html += `
            <div class="brm-box-large">
                <div class="brm-product-title">📦 CASSONETTO ${cass.materialeCass && cass.codiceCass ? `(${cass.materialeCass} ${cass.codiceCass})` : ''}</div>
                
                <div class="brm-measurements">
                    ${brm.L ? `
                        <div class="brm-measure">
                            <div class="brm-label">L (Larghezza)</div>
                            <div class="brm-value">${brm.L}<span class="brm-unit">mm</span></div>
                        </div>
                    ` : ''}
                    ${brm.H ? `
                        <div class="brm-measure">
                            <div class="brm-label">H (Altezza)</div>
                            <div class="brm-value">${brm.H}<span class="brm-unit">mm</span></div>
                        </div>
                    ` : ''}
                    ${brm.C ? `
                        <div class="brm-measure">
                            <div class="brm-label">C (Profondità)</div>
                            <div class="brm-value">${brm.C}<span class="brm-unit">mm</span></div>
                        </div>
                    ` : ''}
                    ${brm.B ? `
                        <div class="brm-measure">
                            <div class="brm-label">B (Base)</div>
                            <div class="brm-value">${brm.B}<span class="brm-unit">mm</span></div>
                        </div>
                    ` : ''}
                </div>
                
                ${hasRilevate ? `
                    <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed #ccc;">
                        <div style="font-size: 0.75rem; color: #666; margin-bottom: 0.5rem;">📏 Misure Rilevate:</div>
                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; font-size: 0.8rem;">
                            ${cass.LS ? `<div><strong>LS:</strong> ${cass.LS}</div>` : ''}
                            ${cass.SRSX ? `<div><strong>SRSX:</strong> ${cass.SRSX}</div>` : ''}
                            ${cass.SRDX ? `<div><strong>SRDX:</strong> ${cass.SRDX}</div>` : ''}
                            ${cass.HCASS ? `<div><strong>HCASS:</strong> ${cass.HCASS}</div>` : ''}
                            ${cass.B ? `<div><strong>B:</strong> ${cass.B}</div>` : ''}
                            ${cass.C ? `<div><strong>C:</strong> ${cass.C}</div>` : ''}
                            ${cass.ZSX_tipo ? `<div><strong>ZSX:</strong> ${cass.ZSX_tipo}</div>` : ''}
                            ${cass.ZDX_tipo ? `<div><strong>ZDX:</strong> ${cass.ZDX_tipo}</div>` : ''}
                            ${cass.BSuperiore ? `<div><strong>B.Sup:</strong> ${cass.BSuperiore}</div>` : ''}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    html += '</div>';
    return html;
}

function renderCaratteristicheMuro(pos) {
    const muro = pos.caratteristiche_muro_override || appState.rilievoData?.caratteristiche_muro_globali || {};
    
    let html = `
        <div class="muro-section">
            <h2 class="cantiere-section-title">🧱 Caratteristiche Muro</h2>
            <div class="muro-grid">
                <div class="muro-item">
                    <div class="muro-label">Telaio</div>
                    <div class="muro-value">${muro.telaio_larghezza || 0} × ${muro.telaio_altezza || 0} mm</div>
                </div>
                <div class="muro-item">
                    <div class="muro-label">Profondità Muro INT</div>
                    <div class="muro-value">${muro.prof_muro_int || 0} mm</div>
                </div>
                <div class="muro-item">
                    <div class="muro-label">Profondità Muro EST</div>
                    <div class="muro-value">${muro.prof_muro_est || 0} mm</div>
                </div>
                <div class="muro-item">
                    <div class="muro-label">Falso Esistente</div>
                    <div class="muro-value">${muro.falso_esistente === 'si' ? `Sì (${muro.spessore_falso || 0}mm)` : 'No'}</div>
                </div>
                <div class="muro-item">
                    <div class="muro-label">Coprifilo</div>
                    <div class="muro-value">${muro.coprifilo_larghezza || 0} mm</div>
                </div>
                <div class="muro-item">
                    <div class="muro-label">Battuta Sup. Tapparella</div>
                    <div class="muro-value">${muro.battuta_superiore_tapparella || 0} mm</div>
                </div>
            </div>
        </div>
    `;
    
    return html;
}

function renderIstruzioniMontaggio(pos) {
    const steps = [
        {
            title: 'PREPARAZIONE',
            tasks: [
                'Rimuovere vecchio infisso/telaio',
                'Pulire vano da polvere e detriti',
                `Verificare misure vano: LVT ${pos.misure?.LVT || 'N/D'} × HVT ${pos.misure?.HVT || 'N/D'} mm`,
                'Controllare planarità muro'
            ]
        },
        {
            title: 'MONTAGGIO TELAIO',
            tasks: [
                `Posizionare telaio (BRM: L=${pos.infisso?.brm?.L || 'N/D'} H=${pos.infisso?.brm?.H || 'N/D'})`,
                'Centrare e mettere in bolla',
                'Fissare con viti/tasselli (min. 4 punti)',
                'Verificare apertura/chiusura'
            ]
        },
        {
            title: 'MONTAGGIO ANTA',
            tasks: [
                'Inserire anta nei cardini',
                'Regolare cerniere',
                'Verificare chiusura ermetica',
                'Testare movimenti'
            ]
        }
    ];
    
    // Add tapparella step if present
    if (hasQta(pos.tapparella)) {
        steps.push({
            title: 'MONTAGGIO TAPPARELLA',
            tasks: [
                `Installare guide (BRM: L=${pos.tapparella?.brm?.L || 'N/D'})`,
                'Inserire telo tapparella',
                pos.tapparella.motorizzazione !== 'manuale' ? 'Collegare motore e testare' : 'Installare cinghia',
                'Verificare scorrimento fluido'
            ]
        });
    }
    
    // Add cassonetto step if present
    if (hasQta(pos.cassonetto)) {
        steps.push({
            title: 'MONTAGGIO CASSONETTO',
            tasks: [
                `Posizionare cassonetto (BRM: L=${pos.cassonetto?.brm?.L || 'N/D'})`,
                'Fissare al muro',
                'Chiudere sportelli',
                'Verificare allineamento'
            ]
        });
    }
    
    steps.push({
        title: 'RIFINITURA',
        tasks: [
            'Applicare silicone perimetrale',
            'Montare coprifili INT/EST',
            'Pulizia finale area lavoro',
            'Verifica con cliente'
        ]
    });
    
    let html = `
        <div class="instructions-section">
            <h2 class="cantiere-section-title">📋 Istruzioni Montaggio</h2>
    `;
    
    steps.forEach((step, index) => {
        html += `
            <div class="instruction-step">
                <span class="step-number">${index + 1}</span>
                <div class="step-title">${step.title}</div>
                <ul class="step-tasks">
        `;
        
        step.tasks.forEach((task, taskIndex) => {
            const taskId = `step-${index}-task-${taskIndex}`;
            html += `
                <li class="step-task">
                    <input type="checkbox" id="${taskId}">
                    <label for="${taskId}">${task}</label>
                </li>
            `;
        });
        
        html += `
                </ul>
            </div>
        `;
    });
    
    html += '</div>';
    return html;
}

function renderMaterialiPosizione(pos) {
    let html = `
        <div class="materials-list">
            <h2 class="cantiere-section-title">📦 Materiali Specifici Posizione</h2>
    `;
    
    if (hasQta(pos.infisso)) {
        html += `
            <div class="material-list-item">
                🪟 <strong>Infisso ${pos.infisso.tipo || 'N/D'}</strong> - ${pos.infisso.azienda || 'N/D'}
                <br>Finitura: ${pos.infisso.finitura_int || 'N/D'} / ${pos.infisso.finitura_est || 'N/D'}
                <br>Quantità: ${getQta(pos.infisso)}
            </div>
        `;
    }
    
    if (hasQta(pos.tapparella)) {
        html += `
            <div class="material-list-item">
                🪟 <strong>Tapparella</strong> ${pos.tapparella.motorizzazione !== 'manuale' ? '⚡ Motorizzata' : 'Manuale'}
                <br>Azienda: ${pos.tapparella.azienda || 'N/D'}
                <br>Quantità: ${getQta(pos.tapparella)}
            </div>
        `;
    }
    
    if (hasQta(pos.cassonetto)) {
        html += `
            <div class="material-list-item">
                📦 <strong>Cassonetto ${pos.cassonetto.tipo || 'N/D'}</strong>
                <br>Quantità: ${getQta(pos.cassonetto)}
            </div>
        `;
    }
    
    if (hasQta(pos.persiana)) {
        html += `
            <div class="material-list-item">
                🪟 <strong>Persiana ${pos.persiana.tipo || 'N/D'}</strong>
                <br>Azienda: ${pos.persiana.azienda || 'N/D'}
                <br>Quantità: ${getQta(pos.persiana)}
            </div>
        `;
    }
    
    if (hasQta(pos.zanzariera)) {
        html += `
            <div class="material-list-item">
                🦟 <strong>Zanzariera ${pos.zanzariera.tipo || 'N/D'}</strong>
                <br>Quantità: ${getQta(pos.zanzariera)}
            </div>
        `;
    }
    
    // Coprifili
    const coprifilo = pos.caratteristiche_muro_override?.coprifilo_larghezza || 
                    appState.rilievoData?.caratteristiche_muro_globali?.coprifilo_larghezza || 0;
    if (coprifilo > 0) {
        html += `
            <div class="material-list-item">
                📐 <strong>Coprifili ${coprifilo}mm</strong> - circa 6m
            </div>
        `;
    }
    
    html += `
            <div class="material-list-item">
                🔧 <strong>Accessori:</strong> Viti, tasselli, silicone, guarnizioni
            </div>
        </div>
    `;
    
    return html;
}

function renderNoteAlert(pos) {
    let html = `
        <div class="notes-alerts-section">
            <h2 class="cantiere-section-title">⚠️ Note e Attenzioni</h2>
    `;
    
    // Note posizione
    if (pos.note_posizione) {
        html += `
            <div class="alert-item info">
                📝 <strong>Nota:</strong> ${pos.note_posizione}
            </div>
        `;
    }
    
    // Falso telaio presente
    const muro = pos.caratteristiche_muro_override || appState.rilievoData?.caratteristiche_muro_globali || {};
    if (muro.falso_esistente === 'si') {
        html += `
            <div class="alert-item warning">
                ⚠️ <strong>Attenzione:</strong> Falso telaio presente (${muro.spessore_falso || 0}mm)!
            </div>
        `;
    }
    
    // Suggerimenti
    html += `
        <div class="alert-item tip">
            💡 <strong>Suggerimento:</strong> Verificare sempre le misure in opera prima del montaggio
        </div>
    `;
    
    // Delta INT/EST diverso
    if (pos.misure && Math.abs((pos.misure.DeltaINT || 0) - (pos.misure.DeltaEST || 0)) > 5) {
        html += `
            <div class="alert-item warning">
                ⚠️ <strong>Attenzione:</strong> Spessore muro variabile (INT: ${pos.misure.DeltaINT || 0}mm, EST: ${pos.misure.DeltaEST || 0}mm)
            </div>
        `;
    }
    
    html += '</div>';
    return html;
}

function renderChecklistOperazioni(pos) {
    const operations = [
        'Vano preparato e pulito',
        'Telaio montato e fissato',
        'Anta installata e funzionante',
        'Tapparella installata (se presente)',
        'Cassonetto montato (se presente)',
        'Silicone applicato',
        'Coprifili montati',
        'Pulizia effettuata',
        'Cliente soddisfatto e ha firmato'
    ];
    
    let html = `
        <div class="final-checklist-section">
            <h2 class="cantiere-section-title">✅ Checklist Operazioni Finali</h2>
    `;
    
    operations.forEach((op, index) => {
        const opId = `final-op-${pos.id}-${index}`;
        html += `
            <div class="final-checklist-item" id="item-${opId}">
                <input type="checkbox" id="${opId}" 
                       onchange="toggleFinalCheckItem('${opId}', this.checked, '${pos.id}')">
                <label for="${opId}">${op}</label>
            </div>
        `;
    });
    
    html += '</div>';
    return html;
}

// ============================================================================
// VISTA 3.3 - DETTAGLIO POSA (v7.20)
// ============================================================================

/**
 * Configurazione campi prodotti - MODULABILE
 * Modifica qui per cambiare quali campi visualizzare
 */
const CAMPI_PRODOTTI_POSA = {
    infisso: {
        label: '🪟 Infisso',
        campi: [
            { key: 'tipo', label: 'Tipo' },
            { key: 'telaio', label: 'Telaio' },
            { key: 'tipoAnta', label: 'Tipo Anta' },
            { key: 'finituraInt', label: 'Fin. Int', combineWith: 'coloreInt' },
            { key: 'finituraEst', label: 'Fin. Est', combineWith: 'coloreEst' },
            { key: 'allarme', label: 'Allarme', separate: true }
        ]
    },
    persiana: {
        label: '🚪 Persiana',
        campi: [
            { key: 'tipo', label: 'Tipo' },
            { key: 'apertura', label: 'Apertura' },
            { key: 'fissaggio', label: 'Fissaggio' },
            { key: 'brm_l', label: 'BRM L', source: 'brm.larghezza' },
            { key: 'brm_h', label: 'BRM H', source: 'brm.altezza' }
        ]
    },
    zanzariera: {
        label: '🦟 Zanzariera',
        campi: [
            { key: 'tipo', label: 'Tipo' },
            { key: 'montaggio', label: 'Montaggio' },
            { key: 'brm_l', label: 'BRM L', source: 'brm.larghezza' },
            { key: 'brm_h', label: 'BRM H', source: 'brm.altezza' }
        ]
    },
    cassonetto: {
        label: '📦 Cassonetto',
        campi: [
            { key: 'modello', label: 'Modello' },
            { key: 'brm_l', label: 'BRM L', source: 'brm.larghezza' },
            { key: 'brm_h', label: 'BRM H', source: 'brm.altezza' },
            { key: 'brm_c', label: 'BRM C', source: 'brm.profondita' },
            { key: 'brm_b', label: 'BRM B', source: 'brm.spessore' }
        ]
    },
    tapparella: {
        label: '🎚️ Tapparella',
        campi: [
            { key: 'tipo', label: 'Tipo' },
            { key: 'montaggio', label: 'Montaggio' },
            { key: 'sistema', label: 'Sistema' },
            { key: 'azionamento', label: 'Azionamento' }
        ]
    }
};

/**
 * Ottiene valore campo da prodotto navigando percorso (es: 'brm.larghezza')
 */
function getValoreCampo(prodotto, source) {
    if (!source) return '-';
    
    const path = source.split('.');
    let value = prodotto;
    
    for (const key of path) {
        if (value && typeof value === 'object' && key in value) {
            value = value[key];
        } else {
            return '-';
        }
    }
    
    return value || '-';
}

/**
 * Combina due campi in un valore (es: "pvc 42" o "alluminio L19")
 */
function combineFields(prodotto, field1, field2) {
    const val1 = prodotto[field1] || '';
    const val2 = prodotto[field2] || '';
    
    if (!val1 && !val2) return '-';
    if (!val1) return val2;
    if (!val2) return val1;
    
    return `${val1} ${val2}`;
}

/**
 * Renderizza tabella dettaglio posa
 */
function renderDettaglioPosa() {
    if (!appState.rilievoData || !appState.rilievoData.posizioni) {
        console.log('❌ Nessun dato rilievo disponibile');
        return;
    }

    const posizioni = appState.rilievoData.posizioni;
    const container = document.getElementById('dettaglioPosaContainer');
    
    if (!container) {
        console.error('❌ Container dettaglio posa non trovato');
        return;
    }

    let html = '';

    // Per ogni posizione
    posizioni.forEach((pos, idx) => {
        const posNum = idx + 1;
        const nomePos = pos.nome || pos.ambiente || `Posizione ${posNum}`;
        const piano = pos.piano || '-';
        
        // Raccogli tutti i prodotti della posizione
        const prodottiPosizione = [];
        
        // Controlla ogni tipo di prodotto - v8.57: usa PRODOTTI_CONFIG
        PRODOTTI_CONFIG.forEach(cfg => {
            const prodotto = getProdottoData(pos, cfg);
            
            // Se prodotto esiste
            if (prodottoPresente(pos, cfg)) {
                const qta = getQtaProdotto(pos, cfg);
                prodottiPosizione.push({
                    tipo: cfg.key,
                    dati: prodotto,
                    quantita: qta
                });
            }
        });

        // Se posizione ha prodotti, crea sezione
        if (prodottiPosizione.length > 0) {
            html += `
                <div class="card" style="margin-bottom: 1.5rem;">
                    <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 1rem; border-radius: 8px 8px 0 0; margin: -1.5rem -1.5rem 1rem -1.5rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <h3 style="margin: 0; font-size: 1.1rem;">📍 ${nomePos}</h3>
                                <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; opacity: 0.9;">Piano: ${piano} • ${prodottiPosizione.length} prodott${prodottiPosizione.length > 1 ? 'i' : 'o'}</p>
                            </div>
                            <div style="font-size: 1.5rem; font-weight: bold; opacity: 0.8;">#${posNum}</div>
                        </div>
                    </div>
            `;

            // Per ogni prodotto, genera tabella specifica
            prodottiPosizione.forEach(prodInfo => {
                const config = CAMPI_PRODOTTI_POSA[prodInfo.tipo];
                if (!config) return;

                html += `
                    <div style="overflow-x: auto; margin-bottom: 1.5rem;">
                        <table class="data-table" style="font-size: 0.9rem;">
                            <thead>
                                <tr>
                                    <th colspan="10" style="background: #f3f4f6; text-align: left; padding: 0.75rem;">
                                        <strong>${config.label}</strong>
                                    </th>
                                </tr>
                                <tr style="background: #fafafa;">
                                    <th style="width: 60px; text-align: center;">Qtà</th>
                `;

                // Header colonne (escludi campi separati)
                const campiPrincipali = config.campi.filter(c => !c.separate);
                campiPrincipali.forEach(campo => {
                    html += `<th style="min-width: 100px;">${campo.label}</th>`;
                });

                html += `
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style="text-align: center;"><strong>${prodInfo.quantita}</strong></td>
                `;

                // Valori campi principali
                campiPrincipali.forEach(campo => {
                    let valore;
                    
                    if (campo.combineWith) {
                        // Combina due campi (es: finitura + colore)
                        valore = combineFields(prodInfo.dati, campo.key, campo.combineWith);
                    } else if (campo.source) {
                        valore = getValoreCampo(prodInfo.dati, campo.source);
                    } else {
                        valore = prodInfo.dati[campo.key] || '-';
                    }
                    
                    html += `<td><strong>${valore}</strong></td>`;
                });

                html += `</tr>`;

                // Riga separata per campi speciali (es: allarme)
                const campiSeparati = config.campi.filter(c => c.separate);
                if (campiSeparati.length > 0) {
                    html += `<tr style="background: #fffbeb;">`;
                    html += `<td></td>`; // Cella vuota sotto Qtà
                    
                    let html_campi_separati = '';
                    campiSeparati.forEach(campo => {
                        const valore = prodInfo.dati[campo.key] || '-';
                        html_campi_separati += `<span style="font-size: 0.85rem; color: #92400e;"><strong>${campo.label}:</strong> ${valore}</span> `;
                    });
                    
                    html += `<td colspan="${campiPrincipali.length}" style="padding: 0.5rem 1rem;">${html_campi_separati}</td>`;
                    html += `</tr>`;
                }

                html += `
                            </tbody>
                        </table>
                    </div>
                `;
            });

            html += `</div>`; // Chiudi card
        }
    });

    // Se nessuna posizione con prodotti
    if (html === '') {
        html = `
            <div class="card">
                <div class="empty-state">
                    <div class="empty-icon">📋</div>
                    <div>Nessun prodotto trovato nelle posizioni</div>
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
    console.log(`✅ Dettaglio posa renderizzato per ${posizioni.length} posizioni`);
}

/**
 * Export CSV dettaglio posa
 */
function exportDettaglioPosaCSV() {
    if (!appState.rilievoData || !appState.rilievoData.posizioni) {
        alert('⚠️ Nessun dato da esportare');
        return;
    }

    const posizioni = appState.rilievoData.posizioni;
    
    // Header CSV
    let csv = 'Posizione,Piano,Ambiente,Prodotto,Quantita,';
    
    // Trova numero massimo colonne
    let maxColonne = 0;
    Object.values(CAMPI_PRODOTTI_POSA).forEach(config => {
        maxColonne = Math.max(maxColonne, config.campi.length);
    });
    
    for (let i = 1; i <= maxColonne; i++) {
        csv += `Campo${i}_Nome,Campo${i}_Valore,`;
    }
    csv = csv.slice(0, -1) + '\n'; // Rimuovi ultima virgola

    // Righe dati
    posizioni.forEach((pos, idx) => {
        const posNum = idx + 1;
        const nomePos = pos.nome || pos.ambiente || `Pos${posNum}`;
        const piano = pos.piano || '';

        PRODOTTI_CONFIG.forEach(cfg => {
            const prodotto = getProdottoData(pos, cfg);
            
            if (prodottoPresente(pos, cfg)) {
                const config = CAMPI_PRODOTTI_POSA[cfg.key];
                if (!config) return;

                const qta = getQtaProdotto(pos, cfg);
                
                let row = [
                    posNum,
                    piano,
                    nomePos,
                    config.label.replace(/[🪟🚪🦟📦🎚️]/g, '').trim(),
                    qta
                ];

                // Aggiungi coppie nome-valore
                config.campi.forEach(campo => {
                    const valore = campo.source 
                        ? getValoreCampo(prodotto, campo.source)
                        : (prodotto[campo.key] || '-');
                    
                    row.push(campo.label);
                    row.push(valore);
                });

                // Riempi colonne vuote
                const colonneUsate = config.campi.length;
                for (let i = colonneUsate; i < maxColonne; i++) {
                    row.push('');
                    row.push('');
                }

                csv += row.join(',') + '\n';
            }
        });
    });

    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    const cliente = appState.rilievoData.clientData?.clientName || 'Cliente';
    const filename = `${cliente}_DettaglioPosa_${new Date().toISOString().split('T')[0]}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log(`✅ Export CSV dettaglio posa: ${filename}`);
}

// ============================================================================
// NAVIGAZIONE POSIZIONI CANTIERE
// ============================================================================
function navigatePosaPosition(direction) {
    if (direction === 'prev' && posaState.currentPositionIndex > 0) {
        posaState.currentPositionIndex--;
        renderSchedaMontaggio();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (direction === 'next' && posaState.currentPositionIndex < posaState.totalPositions - 1) {
        posaState.currentPositionIndex++;
        renderSchedaMontaggio();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// ============================================================================
// CHECKLIST PERSISTENCE (localStorage)
// ============================================================================
function toggleChecklistItem(itemId, checked) {
    const item = document.getElementById(`item-${itemId}`);
    if (item) {
        if (checked) {
            item.classList.add('checked');
        } else {
            item.classList.remove('checked');
        }
    }
    
    // Save state
    const checklistState = JSON.parse(localStorage.getItem('posa_checklist_state') || '{}');
    checklistState[itemId] = checked;
    localStorage.setItem('posa_checklist_state', JSON.stringify(checklistState));
}

function toggleFinalCheckItem(itemId, checked, positionId) {
    const item = document.getElementById(`item-${itemId}`);
    if (item) {
        if (checked) {
            item.classList.add('checked');
        } else {
            item.classList.remove('checked');
        }
    }
    
    // Save state
    const finalCheckState = JSON.parse(localStorage.getItem('posa_final_check_state') || '{}');
    if (!finalCheckState[positionId]) {
        finalCheckState[positionId] = {};
    }
    finalCheckState[positionId][itemId] = checked;
    localStorage.setItem('posa_final_check_state', JSON.stringify(finalCheckState));
}

function saveToolCheck(toolIndex, checked) {
    const toolsState = JSON.parse(localStorage.getItem('posa_tools_state') || '{}');
    toolsState[toolIndex] = checked;
    localStorage.setItem('posa_tools_state', JSON.stringify(toolsState));
}

function restoreChecklistState(positionId) {
    // Restore general checklist
    const checklistState = JSON.parse(localStorage.getItem('posa_checklist_state') || '{}');
    Object.keys(checklistState).forEach(itemId => {
        const checkbox = document.getElementById(itemId);
        const item = document.getElementById(`item-${itemId}`);
        if (checkbox) {
            checkbox.checked = checklistState[itemId];
            if (checklistState[itemId] && item) {
                item.classList.add('checked');
            }
        }
    });
    
    // Restore final checks for this position
    const finalCheckState = JSON.parse(localStorage.getItem('posa_final_check_state') || '{}');
    if (finalCheckState[positionId]) {
        Object.keys(finalCheckState[positionId]).forEach(itemId => {
            const checkbox = document.getElementById(itemId);
            const item = document.getElementById(`item-${itemId}`);
            if (checkbox) {
                checkbox.checked = finalCheckState[positionId][itemId];
                if (finalCheckState[positionId][itemId] && item) {
                    item.classList.add('checked');
                }
            }
        });
    }
    
    // Restore tools
    const toolsState = JSON.parse(localStorage.getItem('posa_tools_state') || '{}');
    Object.keys(toolsState).forEach(toolIndex => {
        const checkbox = document.getElementById(`tool-${toolIndex}`);
        if (checkbox) {
            checkbox.checked = toolsState[toolIndex];
        }
    });
}

function setupChecklistListeners() {
    // Restore checklist state on page load
    const checklistState = JSON.parse(localStorage.getItem('posa_checklist_state') || '{}');
    Object.keys(checklistState).forEach(itemId => {
        const checkbox = document.getElementById(itemId);
        const item = document.getElementById(`item-${itemId}`);
        if (checkbox) {
            checkbox.checked = checklistState[itemId];
            if (checklistState[itemId] && item) {
                item.classList.add('checked');
            }
        }
    });
    
    // Restore tools state
    const toolsState = JSON.parse(localStorage.getItem('posa_tools_state') || '{}');
    Object.keys(toolsState).forEach(toolIndex => {
        const checkbox = document.getElementById(`tool-${toolIndex}`);
        if (checkbox) {
            checkbox.checked = toolsState[toolIndex];
        }
    });
}

// ============================================================================
// FULLSCREEN TOGGLE
// ============================================================================
function togglePosaFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.log(`Error attempting to enable fullscreen: ${err.message}`);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

// Initialize menu on load
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎯 Initializing Advanced Menu...');
    renderAdvancedMenu();
    updateBreadcrumb('generale', 'dashboard');
    setupKeyboardShortcuts();
    console.log('✅ Advanced Menu initialized');
    
    // 🔄 FASE 027E: Auto-load progetti da GitHub
    initGitHubSync();
});

// ============================================
// 🔄 GITHUB READER MODULE - Dashboard v1.0
// ============================================
// Legge automaticamente progetti sincronizzati da GitHub

const GITHUB_DASHBOARD_CONFIG = {
    enabled: true, // Abilita lettura automatica
    owner: 'Openporte2025',
    repo: 'dati-cantieri',
    branch: 'main',
    token: '', // ⚠️ Token caricato da localStorage - NON inserire qui!
    autoRefreshInterval: 60000, // 60 secondi
    lastSync: null
};

/**
 * Carica configurazione salvata
 */
function loadGitHubConfig() {
    try {
        const saved = localStorage.getItem('github_dashboard_config');
        if (saved) {
            const config = JSON.parse(saved);
            GITHUB_DASHBOARD_CONFIG.owner = config.owner || GITHUB_DASHBOARD_CONFIG.owner;
            GITHUB_DASHBOARD_CONFIG.repo = config.repo || GITHUB_DASHBOARD_CONFIG.repo;
            GITHUB_DASHBOARD_CONFIG.branch = config.branch || GITHUB_DASHBOARD_CONFIG.branch;
            console.log(`📝 Config caricata: ${GITHUB_DASHBOARD_CONFIG.owner}/${GITHUB_DASHBOARD_CONFIG.repo}`);
        }
    } catch (e) {
        console.log('ℹ️ Nessuna config salvata, uso default');
    }
}

/**
 * Salva configurazione
 */
function saveGitHubConfig() {
    const config = {
        owner: GITHUB_DASHBOARD_CONFIG.owner,
        repo: GITHUB_DASHBOARD_CONFIG.repo,
        branch: GITHUB_DASHBOARD_CONFIG.branch
    };
    localStorage.setItem('github_dashboard_config', JSON.stringify(config));
    console.log('💾 Config salvata');
}

/**
 * Inizializza sincronizzazione GitHub
 */
async function initGitHubSync() {
    console.log('🔄 GitHub Reader Module - Initializing...');
    
    // Carica configurazione salvata (owner/repo)
    loadGitHubConfig();
    
    // Carica token da localStorage (salvato in questa dashboard)
    try {
        const savedToken = localStorage.getItem('github_dashboard_token');
        if (savedToken) {
            GITHUB_DASHBOARD_CONFIG.token = savedToken;
            console.log('✅ Token GitHub caricato da localStorage dashboard');
        }
    } catch (e) {
        console.log('ℹ️ Nessun token salvato');
    }
    
    // Se non trovato, prova da app-rilievo
    if (!GITHUB_DASHBOARD_CONFIG.token) {
        try {
            const appData = localStorage.getItem('openPorteData');
            if (appData) {
                const parsed = JSON.parse(appData);
                if (parsed.github?.token) {
                    GITHUB_DASHBOARD_CONFIG.token = parsed.github.token;
                    console.log('✅ Token GitHub trovato da app-rilievo');
                }
            }
        } catch (e) {
            console.log('ℹ️ Token non trovato in app-rilievo');
        }
    }
    
    // Carica progetti da GitHub
    if (GITHUB_DASHBOARD_CONFIG.enabled) {
        await loadProjectsFromGitHub();
        
        // v8.65: Ripristina progetto dopo F5
        try {
            const savedProject = sessionStorage.getItem('dash_project');
            if (savedProject && window.githubProjects && window.githubProjects.length > 0) {
                const found = window.githubProjects.find(p => p.id === savedProject);
                if (found) {
                    console.log(`🔄 F5: Ripristino progetto "${found.nome}" (${savedProject})`);
                    setTimeout(() => loadGitHubProject(savedProject), 500);
                } else {
                    console.log(`🔄 F5: Progetto ${savedProject} non trovato in lista`);
                }
            }
        } catch(e) { console.warn('F5 project restore:', e); }
        
        // Auto-refresh ogni minuto (solo se caricamento ha successo)
        if (GITHUB_DASHBOARD_CONFIG.lastSync) {
            setInterval(async () => {
                console.log('🔄 Auto-refresh progetti da GitHub...');
                await loadProjectsFromGitHub();
            }, GITHUB_DASHBOARD_CONFIG.autoRefreshInterval);
        }
    }
}

/**
 * Carica tutti i progetti dal repository GitHub
 */
async function loadProjectsFromGitHub() {
    try {
        console.log('📡 Caricamento progetti da GitHub...');
        
        // Usa Git Tree API per ricerca ricorsiva in tutte le cartelle
        const url = `https://api.github.com/repos/${GITHUB_DASHBOARD_CONFIG.owner}/${GITHUB_DASHBOARD_CONFIG.repo}/git/trees/${GITHUB_DASHBOARD_CONFIG.branch}?recursive=1`;
        
        const headers = {
            'Accept': 'application/vnd.github.v3+json'
        };
        
        // Aggiungi token se disponibile
        if (GITHUB_DASHBOARD_CONFIG.token) {
            headers['Authorization'] = `token ${GITHUB_DASHBOARD_CONFIG.token}`;
            console.log('🔑 Token GitHub presente');
        } else {
            console.log('⚠️ Nessun token - tentativo accesso pubblico');
        }
        
        const response = await fetch(url, { headers });
        
        // Gestione errori specifici
        if (response.status === 404) {
            throw new Error('Repository non trovato. Verifica owner/repo.');
        }
        
        if (response.status === 401 || response.status === 403) {
            console.error('❌ Accesso negato - Repository privato o token non valido');
            showGitHubTokenForm();
            throw new Error('Repository privato - Inserisci token GitHub');
        }
        
        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
        }
        
        const tree = await response.json();
        
        // Filtra file JSON progetto da TUTTE le sottocartelle
        const projectFiles = tree.tree
            .filter(f => 
                f.path.endsWith('.json') && 
                f.type === 'blob' &&
                f.path.includes('progetto-')
            )
            .map(f => ({
                name: f.path.split('/').pop(),
                path: f.path,
                sha: f.sha,
                download_url: `https://api.github.com/repos/${GITHUB_DASHBOARD_CONFIG.owner}/${GITHUB_DASHBOARD_CONFIG.repo}/contents/${f.path}?ref=${GITHUB_DASHBOARD_CONFIG.branch}`
            }));
        
        console.log(`📂 Trovati ${projectFiles.length} progetti su GitHub`);
        console.log(`📄 Path file trovati:`, projectFiles.map(f => f.path));
        
        if (projectFiles.length === 0) {
            showGitHubStatus('info', 'Nessun progetto sincronizzato trovato');
            return;
        }
        
        // Carica contenuto di ogni progetto
        const allProjects = [];
        for (const file of projectFiles) {
            try {
                const loadedProjectData = await loadGitHubFile(file.download_url);
                if (loadedProjectData) {
                    allProjects.push({
                        filename: file.name,
                        data: loadedProjectData,
                        lastModified: file.sha
                    });
                }
            } catch (e) {
                console.error(`❌ Errore caricamento ${file.name}:`, e);
            }
        }
        
        console.log(`✅ Caricati ${allProjects.length} progetti con successo`);
        console.log(`📊 Dati progetti:`, allProjects.map(p => ({
            filename: p.filename,
            id: p.data?.id,
            projectName: p.data?.projectName,
            customerName: p.data?.customerName
        })));
        
        // Aggiorna UI con progetti
        updateDashboardWithGitHubProjects(allProjects);
        
        GITHUB_DASHBOARD_CONFIG.lastSync = new Date().toISOString();
        showGitHubStatus('success', `${allProjects.length} progetti caricati da GitHub`);
        
    } catch (error) {
        console.error('❌ Errore caricamento da GitHub:', error);
        showGitHubStatus('error', error.message || 'Errore connessione GitHub');
    }
}

/**
 * Mostra form per inserire token GitHub
 */
function showGitHubTokenForm() {
    const existingForm = document.getElementById('github-token-modal');
    if (existingForm) return; // Form già presente
    
    const modal = document.createElement('div');
    modal.id = 'github-token-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    
    modal.innerHTML = `
        <div style="background: white; border-radius: 16px; padding: 2rem; max-width: 600px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3); max-height: 90vh; overflow-y: auto;">
            <h2 style="margin: 0 0 1rem 0; color: #2d3748; font-size: 1.5rem;">
                ⚙️ Configurazione GitHub
            </h2>
            
            <p style="color: #718096; margin-bottom: 1.5rem; line-height: 1.6;">
                Configura l'accesso al repository GitHub dove sono salvati i progetti sincronizzati.
            </p>
            
            <div style="background: #f7fafc; padding: 1.5rem; border-radius: 8px; margin-bottom: 1.5rem;">
                <h3 style="margin: 0 0 1rem 0; color: #4a5568; font-size: 1rem;">
                    📦 Repository
                </h3>
                
                <div style="margin-bottom: 1rem;">
                    <label style="display: block; margin-bottom: 0.5rem; color: #4a5568; font-weight: 600; font-size: 0.9rem;">
                        Owner (username o organization):
                    </label>
                    <input type="text" id="github-owner-input" 
                           value="${GITHUB_DASHBOARD_CONFIG.owner}"
                           placeholder="Openporte2025"
                           style="width: 100%; padding: 0.75rem; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 0.95rem;">
                </div>
                
                <div style="margin-bottom: 1rem;">
                    <label style="display: block; margin-bottom: 0.5rem; color: #4a5568; font-weight: 600; font-size: 0.9rem;">
                        Repository name:
                    </label>
                    <input type="text" id="github-repo-input" 
                           value="${GITHUB_DASHBOARD_CONFIG.repo}"
                           placeholder="dati-cantieri"
                           style="width: 100%; padding: 0.75rem; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 0.95rem;">
                </div>
                
                <div style="color: #718096; font-size: 0.85rem; margin-top: 0.5rem;">
                    💡 URL completo: github.com/<span id="preview-owner">${GITHUB_DASHBOARD_CONFIG.owner}</span>/<span id="preview-repo">${GITHUB_DASHBOARD_CONFIG.repo}</span>
                </div>
            </div>
            
            <div style="margin-bottom: 1rem;">
                <label style="display: block; margin-bottom: 0.5rem; color: #4a5568; font-weight: 600;">
                    🔑 Token GitHub (opzionale se repo pubblico):
                </label>
                <input type="password" id="github-token-input" 
                       placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                       value="${GITHUB_DASHBOARD_CONFIG.token || ''}"
                       style="width: 100%; padding: 0.75rem; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 0.95rem; font-family: monospace;"
                       onkeypress="if(event.key==='Enter') saveGitHubConfigAndToken()">
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <a href="https://github.com/settings/tokens/new?scopes=repo&description=OpenPorte%20Dashboard" 
                   target="_blank"
                   style="color: #6366f1; text-decoration: none; font-size: 0.9rem;">
                    📝 Crea nuovo token su GitHub →
                </a>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button onclick="closeGitHubTokenForm()" 
                        style="padding: 0.75rem 1.5rem; background: #e2e8f0; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; color: #4a5568;">
                    Annulla
                </button>
                <button onclick="saveGitHubConfigAndToken()" 
                        style="padding: 0.75rem 1.5rem; background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); border: none; border-radius: 8px; cursor: pointer; font-weight: 600; color: white;">
                    💾 Salva e Carica
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Update preview on input
    const ownerInput = document.getElementById('github-owner-input');
    const repoInput = document.getElementById('github-repo-input');
    
    ownerInput.addEventListener('input', () => {
        document.getElementById('preview-owner').textContent = ownerInput.value || 'owner';
    });
    
    repoInput.addEventListener('input', () => {
        document.getElementById('preview-repo').textContent = repoInput.value || 'repo';
    });
    
    ownerInput.focus();
}

/**
 * Salva configurazione GitHub completa
 */
function saveGitHubConfigAndToken() {
    const owner = document.getElementById('github-owner-input')?.value.trim();
    const repo = document.getElementById('github-repo-input')?.value.trim();
    const token = document.getElementById('github-token-input')?.value.trim();
    
    if (!owner || !repo) {
        showGitHubStatus('warning', 'Owner e Repository sono obbligatori');
        return;
    }
    
    // Aggiorna config
    GITHUB_DASHBOARD_CONFIG.owner = owner;
    GITHUB_DASHBOARD_CONFIG.repo = repo;
    if (token) {
        GITHUB_DASHBOARD_CONFIG.token = token;
    }
    
    // Salva in localStorage
    saveGitHubConfig();
    if (token) {
        localStorage.setItem('github_dashboard_token', token);
    }
    
    console.log(`✅ Config salvata: ${owner}/${repo}`);
    
    // Chiudi form
    closeGitHubTokenForm();
    
    // Ricarica progetti
    showGitHubStatus('info', 'Caricamento progetti...');
    loadProjectsFromGitHub();
}

/**
 * Chiude form token
 */
function closeGitHubTokenForm() {
    const modal = document.getElementById('github-token-modal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Carica un singolo file da GitHub
 */
async function loadGitHubFile(downloadUrl) {
    try {
        const headers = {
            'Accept': 'application/vnd.github.v3+json'
        };
        
        // Aggiungi token se disponibile per repo privati
        if (GITHUB_DASHBOARD_CONFIG.token) {
            headers['Authorization'] = `token ${GITHUB_DASHBOARD_CONFIG.token}`;
        }
        
        const response = await fetch(downloadUrl, { headers });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        // L'API GitHub restituisce il contenuto in base64
        // Decodifica e parsifica JSON
        const content = atob(data.content.replace(/\n/g, ''));
        return JSON.parse(content);
    } catch (error) {
        console.error('Errore caricamento file:', error);
        return null;
    }
}

/**
 * Aggiorna dashboard con progetti da GitHub
 */
function updateDashboardWithGitHubProjects(githubProjects) {
    if (githubProjects.length === 0) return;
    
    console.log('🔄 Aggiornamento dashboard con progetti GitHub...');
    console.log('📊 Progetti ricevuti:', githubProjects);
    
    // Converte progetti GitHub nel formato della dashboard
    const projectsList = githubProjects.map(gp => {
        const data = gp.data;
        
        // Supporta sia formato vecchio che nuovo
        let id, projectName, customerName, ambiente, posizioni, metadata;
        
        if (data.rilievo) {
            // NUOVO FORMATO (con struttura "rilievo")
            id = data.rilievo.meta?.id_rilievo;
            customerName = data.rilievo.cliente?.nome || data.rilievo.cliente?.ragione_sociale || 'Cliente Senza Nome';
            projectName = customerName; // Usa sempre il nome cliente
            ambiente = data.rilievo.cantiere?.indirizzo || data.rilievo.cantiere?.città || 'N/D';
            posizioni = data.rilievo.misure?.length || 0;
            metadata = {
                lastModified: data.rilievo.meta?.data_modifica || data.rilievo.meta?.data_creazione
            };
        } else {
            // VECCHIO FORMATO (formato app-rilievo)
            id = data.id;
            // 🔧 v8.13: Priorità nome cliente su nome progetto/file
            // OpenPorte usa: client (nome), clientData.nome (dettaglio), name (progetto)
            customerName = data.client || data.clientData?.nome || data.cliente?.nome || data.customerName || 'Cliente Senza Nome';
            // Se customerName è uguale al nome file (es. "INFISSI+PERSIANE"), prova altri campi
            if (customerName === data.name && (data.clientData?.nome || data.cliente?.nome)) {
                customerName = data.clientData?.nome || data.cliente?.nome;
            }
            projectName = data.projectName || data.name || customerName;
            ambiente = data.currentEnvironment || 'N/D';
            posizioni = data.positions?.length || data.project?.rilievoInfissi?.length || 0;
            
            // v8.492: Usa changeLog per data modifica (più affidabile)
            let lastModified = data.metadata?.lastModified;
            if (data.changeLog && Array.isArray(data.changeLog) && data.changeLog.length > 0) {
                // Prendi l'ultimo elemento del changeLog
                const lastChange = data.changeLog[data.changeLog.length - 1];
                if (lastChange.timestamp) {
                    lastModified = lastChange.timestamp;
                }
            }
            metadata = { lastModified: lastModified };
        }
        
        console.log('🔍 Mapping progetto:', {
            filename: gp.filename,
            formato: data.rilievo ? 'NUOVO' : 'VECCHIO',
            id: id,
            projectName: projectName,
            customerName: customerName,
            posizioni: posizioni
        });
        
        // v8.492: Salva timestamp raw per ordinamento
        const timestampRaw = metadata?.lastModified || Date.now();
        
        // Estrai informazioni progetto
        return {
            id: id || gp.filename,
            nome: customerName || projectName || 'Progetto Senza Nome',
            cliente: customerName,
            ambiente: ambiente,
            stato: data.stato || 'preventivo', // 🔧 v8.61: legge stato da GitHub
            dataModifica: new Date(timestampRaw).toLocaleDateString('it-IT'),
            timestampModifica: new Date(timestampRaw).getTime(), // v8.492: per ordinamento
            posizioni: posizioni,
            completamento: calcolaCompletamentoProgetto(data),
            source: 'github',
            rawData: data
        };
    });
    
    // v8.492: Ordina per data modifica (più recenti prima)
    projectsList.sort((a, b) => b.timestampModifica - a.timestampModifica);
    
    // Salva in una variabile globale per accesso rapido
    window.githubProjects = projectsList;
    
    // 🆕 Popola menu laterale con progetti
    updateSidebarMenu(projectsList);
    
    // Se siamo nella vista lista progetti, aggiorna
    if (window.location.hash === '#progetti' || !window.location.hash) {
        renderProjectsList(projectsList);
    }
    
    // v8.66: Mostra blocco progetti SOLO se non c'è già un progetto aperto
    if (!window.currentData && !window.projectData) {
        switchBlocco('progetti');
    } else {
        console.log('ℹ️ v8.66: Progetto già aperto, non torno alla lista');
    }
    
    console.log(`✅ Dashboard aggiornata con ${projectsList.length} progetti`);
}

/**
 * Calcola completamento progetto
 */
function calcolaCompletamentoProgetto(data) {
    let score = 0;
    let total = 0;
    
    // Cliente (25%)
    total += 25;
    if (data.customerName) score += 10;
    if (data.customerPhone) score += 5;
    if (data.customerEmail) score += 5;
    if (data.customerAddress) score += 5;
    
    // Setup (25%)
    total += 25;
    const hasProdotti = data.project?.hasInfissi || data.project?.hasPersiane || 
                       data.project?.hasTapparelle || data.project?.hasZanzariere;
    if (hasProdotti) score += 25;
    
    // Posizioni (50%)
    total += 50;
    const posizioni = data.project?.rilievoInfissi?.length || 0;
    if (posizioni > 0) {
        score += Math.min(50, posizioni * 10);
    }
    
    return Math.round((score / total) * 100);
}

/**
 * Renderizza lista progetti
 */
// v8.60: Usa modulo condiviso ProjectListView
function renderProjectsList(projects) {
    const container = document.getElementById('progetti-list-container');
    const card = document.getElementById('githubProjectsCard');
    
    if (!container) return;
    
    if (card) {
        card.style.display = projects.length > 0 ? 'block' : 'none';
    }

    // Usa modulo condiviso se disponibile
    if (typeof ProjectListView !== 'undefined') {
        const normalized = ProjectListView.normalizeAll(projects, 'dashboard');
        container.innerHTML = ProjectListView.generateHTML(normalized, {
            onOpenFn: 'loadGitHubProject',
            onDeleteFn: null,
            showCompletamento: true,
            showAmbiente: true,
            stickyTabs: true,
            stickyTop: '0px'
        });
        
        // Registra callback per re-render
        ProjectListView.onRender(() => renderProjectsList(window.githubProjects || []));
        
        // Aggiorna anche blocco-progetti se visibile
        renderBloccoProgetti(projects);
        return;
    }

    // Fallback senza modulo
    if (projects.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:2rem;color:#718096;">Nessun progetto trovato</div>';
        return;
    }
    container.innerHTML = '<div style="padding:1rem;">' + projects.map(p => 
        '<div style="padding:12px;margin:8px 0;background:white;border-radius:8px;cursor:pointer;border:1px solid #e2e8f0;" onclick="loadGitHubProject(\'' + p.id + '\')">' +
        '<strong>' + (p.cliente || p.nome) + '</strong> — ' + p.posizioni + ' posizioni</div>'
    ).join('') + '</div>';
}

/**
 * v8.60: Blocco Progetti — pagina nativa nel sistema di navigazione
 * Si integra con switchBlocco('progetti') come generale/ufficio/posa
 */
function initBloccoProgetti() {
    // Crea blocco-progetti se non esiste
    if (document.getElementById('blocco-progetti')) return;
    
    const blocco = document.createElement('div');
    blocco.id = 'blocco-progetti';
    blocco.className = 'blocco';
    blocco.innerHTML = `
        <div style="background:#f3f4f6;min-height:calc(100vh - 80px);">
            <div id="blocco-progetti-content" style="max-width:1400px;margin:0 auto;">
                <div style="text-align:center;padding:80px 20px;">
                    <div style="font-size:48px;margin-bottom:16px;">⏳</div>
                    <div style="font-size:16px;color:#6b7280;">Caricamento progetti da GitHub...</div>
                </div>
            </div>
        </div>
    `;
    
    // Inserisci dopo gli altri blocchi
    const container = document.querySelector('.blocco')?.parentElement;
    if (container) {
        container.appendChild(blocco);
    } else {
        document.body.appendChild(blocco);
    }
    console.log('✅ v8.60: Blocco Progetti creato');
}

/**
 * v8.60: Renderizza lista progetti nel blocco-progetti
 */
function renderBloccoProgetti(projects) {
    const container = document.getElementById('blocco-progetti-content');
    if (!container) return;
    
    // 🆕 v8.66: Header con bottone Nuovo Progetto
    let headerHtml = `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px 8px;">
            <h2 style="margin:0;font-size:1.5rem;font-weight:700;color:#111827;">📋 Lista Progetti</h2>
            ${typeof openPMProjectModal === 'function' ? `
            <button onclick="openPMProjectModal()" style="background:linear-gradient(135deg,#6366f1,#4f46e5);color:white;border:none;padding:10px 20px;border-radius:8px;font-weight:600;cursor:pointer;font-size:14px;">
                ➕ Nuovo Progetto
            </button>` : ''}
        </div>
    `;
    
    if (!projects || projects.length === 0) {
        container.innerHTML = `
            <div style="text-align:center;padding:80px 20px;">
                <div style="font-size:48px;margin-bottom:16px;">📋</div>
                <div style="font-size:16px;color:#6b7280;">Nessun progetto trovato su GitHub</div>
                <div style="font-size:13px;color:#9ca3af;margin-top:8px;">Sincronizza dall'App Rilievo per vedere i progetti qui</div>
            </div>`;
        return;
    }
    
    if (typeof ProjectListView !== 'undefined') {
        const normalized = ProjectListView.normalizeAll(projects, 'dashboard');
        container.innerHTML = headerHtml + ProjectListView.generateHTML(normalized, {
            onOpenFn: 'openProjectFromBlocco',
            onDeleteFn: null,
            showCompletamento: true,
            showAmbiente: true,
            stickyTabs: false,
            stickyTop: '0px',
            fullPage: false
        });
        ProjectListView.onRender(() => renderBloccoProgetti(window.githubProjects || []));
    } else {
        // Fallback senza modulo condiviso
        container.innerHTML = headerHtml + `
            <div style="padding:16px;">
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px;">
                    ${projects.map(p => `
                        <div onclick="openProjectFromBlocco('${p.id}')" 
                             style="background:white;border-radius:12px;padding:14px 16px;cursor:pointer;border:1px solid #e5e7eb;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
                            <div style="font-weight:700;font-size:16px;color:#111827;margin-bottom:6px;">${(p.cliente || p.nome || '').toUpperCase()}</div>
                            <div style="font-size:13px;color:#6b7280;margin-bottom:8px;">${p.nome || '—'}</div>
                            <div style="font-size:12px;color:#9ca3af;display:flex;justify-content:space-between;">
                                <span>📋 ${p.posizioni || 0} posizioni</span>
                                <span>${p.dataModifica || ''}</span>
                                <span style="color:#6366f1;font-weight:600;">Apri →</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>`;
    }
}

/**
 * v8.60: Apri progetto dal blocco progetti
 */
function openProjectFromBlocco(projectId) {
    loadGitHubProject(projectId);
    // loadGitHubProject fa già switchBlocco('ufficio')
}

/**
 * v8.60: Salva stato progetto su GitHub
 */
async function saveProjectStatoToGitHub(projectId, newStato) {
    const project = window.githubProjects?.find(p => p.id === projectId);
    if (!project || !project.rawData) return;
    
    try {
        const token = typeof GITHUB_DASHBOARD_CONFIG !== 'undefined' ? GITHUB_DASHBOARD_CONFIG.token : null;
        const owner = typeof GITHUB_DASHBOARD_CONFIG !== 'undefined' ? GITHUB_DASHBOARD_CONFIG.owner : null;
        const repo = typeof GITHUB_DASHBOARD_CONFIG !== 'undefined' ? GITHUB_DASHBOARD_CONFIG.repo : null;
        if (!token || !owner || !repo) return;
        
        const filename = `progetti/progetto-${projectId}.json`;
        const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filename}`;
        
        const checkResp = await fetch(url, {
            headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' }
        });
        if (!checkResp.ok) return;
        
        const current = await checkResp.json();
        const updatedData = { ...project.rawData, stato: newStato };
        // 🔧 v8.61: Aggiorna timestamp per sync con App
        if (updatedData.metadata) {
            updatedData.metadata.updated = new Date().toISOString();
        }
        updatedData.updated = new Date().toISOString();
        const content = btoa(unescape(encodeURIComponent(JSON.stringify(updatedData, null, 2))));
        
        await fetch(url, {
            method: 'PUT',
            headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: `Stato -> ${newStato}: ${project.nome || projectId}`,
                content: content,
                sha: current.sha
            })
        });
        
        console.log(`✅ Stato ${newStato} salvato su GitHub per ${projectId}`);
    } catch (err) {
        console.error('❌ Errore salvataggio stato GitHub:', err);
    }
}

/**
 * v8.50: Converte formato GitHub → Dashboard
 */
function convertGitHubToDashboardFormat(githubData) {
    console.log('🔄 Conversione formato GitHub → Dashboard');
    console.log('📦 Dati ricevuti:', githubData);
    console.log('🔍 Campi disponibili:', Object.keys(githubData));
    console.log('📋 configInfissi presente:', !!githubData.configInfissi);
    console.log('📋 configInfissi contenuto:', githubData.configInfissi);
    
    // Se già ha il campo "posizioni" E NON ha "positions" (dato originale app)
    // Se ha entrambi, positions è la fonte di verità → usa FORMATO 3
    if (githubData.posizioni && Array.isArray(githubData.posizioni) && !githubData.positions) {
        console.log('✅ Formato già corretto con posizioni array (no positions raw)');
        console.log('   ➡️ configInfissi preservato:', !!githubData.configInfissi);
        return githubData;
    }
    
    // FORMATO 1: data.rilievo.misure → data.posizioni
    if (githubData.rilievo?.misure) {
        console.log('✅ Formato NUOVO riconosciuto (rilievo.misure)');
        console.log('📊 Numero posizioni:', githubData.rilievo.misure.length);
        return {
            ...githubData,
            posizioni: githubData.rilievo.misure,
            nome: githubData.rilievo.cliente?.nome || githubData.rilievo.cliente?.ragione_sociale || 'Progetto',
            nome_ricerca: githubData.rilievo.meta?.nome_progetto || githubData.rilievo.cliente?.nome || 'N/D',
            cliente: {
                nome: githubData.rilievo.cliente?.nome || githubData.rilievo.cliente?.ragione_sociale || 'N/D',
                cognome: githubData.rilievo.cliente?.cognome || '',
                progetto: githubData.rilievo.meta?.nome_progetto || githubData.rilievo.cliente?.nome || 'N/D',
                piano: githubData.rilievo.cantiere?.piano || '',
                indirizzo: githubData.rilievo.cantiere?.indirizzo || '',
                via: githubData.rilievo.cantiere?.via || '',
                citta: githubData.rilievo.cantiere?.città || githubData.rilievo.cantiere?.citta || '',
                telefono: githubData.rilievo.cliente?.telefono || '',
                email: githubData.rilievo.cliente?.email || ''
            },
            data_rilievo: githubData.rilievo.meta?.data_creazione || Date.now(),
            project: githubData.rilievo
        };
    }
    
    // FORMATO 2: data.project.rilievoInfissi → data.posizioni
    if (githubData.project?.rilievoInfissi && Array.isArray(githubData.project.rilievoInfissi)) {
        console.log('✅ Formato VECCHIO riconosciuto (project.rilievoInfissi)');
        console.log('📊 Numero posizioni:', githubData.project.rilievoInfissi.length);
        
        // Normalizza ogni posizione
        const posizioniNormalizzate = githubData.project.rilievoInfissi.map(pos => {
            const normalized = { ...pos };
            
            // Normalizza infisso
            if (pos.infisso) {
                normalized.infisso = {
                    ...pos.infisso,
                    quantita: getQta(pos.infisso),
                    azienda: pos.infisso.azienda || 'Non specificata',
                    brm: {
                        L: pos.infisso.BRM_L || 0,
                        H: pos.infisso.BRM_H || 0
                    },
                    finitura_int: pos.infisso.finituraInt,
                    finitura_est: pos.infisso.finituraEst,
                    colore_int: pos.infisso.coloreInt,
                    colore_est: pos.infisso.coloreEst
                };
            }
            
            // Normalizza persiana
            if (pos.persiana) {
                const brmP = getProductBRM(pos.persiana, pos);
                normalized.persiana = {
                    ...pos.persiana,
                    quantita: getQta(pos.persiana),
                    azienda: pos.persiana.azienda || 'Non specificata',
                    modello: pos.persiana.modello || pos.persiana.tipo,
                    brm: { L: brmP.L, H: brmP.H },
                    colore: pos.persiana.colorePersiana || pos.persiana.colore
                };
            }
            
            // Normalizza zanzariera
            if (pos.zanzariera) {
                const brmZ = getProductBRM(pos.zanzariera, pos);
                normalized.zanzariera = {
                    ...pos.zanzariera,
                    quantita: getQta(pos.zanzariera),
                    azienda: pos.zanzariera.azienda || 'Non specificata',
                    modello: pos.zanzariera.modello || pos.zanzariera.tipo,
                    brm: { L: brmZ.L, H: brmZ.H },
                    colore: pos.zanzariera.coloreTelaio
                };
            }
            
            // Normalizza tapparella
            if (pos.tapparella) {
                const brmT = getProductBRM(pos.tapparella, pos);
                normalized.tapparella = {
                    ...pos.tapparella,
                    quantita: getQta(pos.tapparella),
                    azienda: pos.tapparella.azienda || 'Non specificata',
                    brm: { L: brmT.L, H: brmT.H }
                };
            }
            
            // Normalizza cassonetto
            if (pos.cassonetto) {
                const brmC = getProductBRM(pos.cassonetto, pos);
                normalized.cassonetto = {
                    ...pos.cassonetto,
                    quantita: getQta(pos.cassonetto),
                    azienda: pos.cassonetto.azienda || 'Non specificata',
                    LS: parseInt(pos.cassonetto.LS) || 0,
                    HCASS: parseInt(pos.cassonetto.HCASS) || 0,
                    B: parseInt(pos.cassonetto.B) || 0,
                    C: parseInt(pos.cassonetto.C) || 0,
                    brm: { L: brmC.L, H: brmC.H, C: brmC.C, B: brmC.B }
                };
            }
            
            return normalized;
        });
        
        return {
            ...githubData,
            posizioni: posizioniNormalizzate,
            nome: githubData.projectName || githubData.customerName || 'Progetto',
            nome_ricerca: githubData.projectName || githubData.customerName || 'N/D',
            cliente: githubData.clientData || {
                nome: githubData.customerName || 'N/D',
                cognome: '',
                progetto: githubData.projectName || githubData.customerName || 'N/D',
                piano: githubData.piano || '',
                indirizzo: githubData.indirizzo || '',
                via: githubData.via || '',
                citta: githubData.citta || '',
                telefono: githubData.customerPhone || '',
                email: githubData.customerEmail || ''
            },
            // ✅ v7.73: FIX - Preserva configInfissi
            configInfissi: githubData.configInfissi || {},
            // 🔐 v7.98: Preserva configBlindate
            configBlindate: githubData.configBlindate || {},
            data_rilievo: githubData.metadata?.created || Date.now()
        };
    }
    
    // FORMATO 3: Formato openporte-v4_5 (positions array)
    if (githubData.positions && Array.isArray(githubData.positions)) {
        console.log('✅ Formato OPENPORTE riconosciuto (positions)');
        console.log('📊 Numero posizioni:', githubData.positions.length);
        
        // ✅ Normalizza ogni posizione con conversione prodotti
        const posizioniNormalizzate = githubData.positions.map((posGitHub, index) => {
            const posDash = {
                id: posGitHub.id || `pos-${index}`,
                nome: posGitHub.name || `Posizione ${index + 1}`,
                ambiente: posGitHub.ambiente || '',
                quantita: parseInt(posGitHub.quantita || 1),
                misure: {}
            };
            
            // ✅ Converti misure (mantieni valori semplici!)
            // Copia direttamente le misure senza trasformarle in oggetti
            if (posGitHub.misure) {
                posDash.misure = { ...posGitHub.misure };
            }
            
            // 🆕 v8.58: FIX - Processa TUTTI i prodotti da PRODOTTI_CONFIG (non solo 5 hardcoded)
            const prodottiConBRM = PRODOTTI_CONFIG.map(c => c.key).filter(k => 
                !['blindata', 'portoncino'].includes(k)  // gestiti separatamente sotto
            );
            prodottiConBRM.forEach(tipoProdotto => {
                if (posGitHub[tipoProdotto]) {
                    const prodGitHub = posGitHub[tipoProdotto];
                    
                    // Inizializza prodotto copiando tutti i campi
                    posDash[tipoProdotto] = { ...prodGitHub };
                    
                    // ✅ FIX 1: Converti qta → quantita (numero)
                    posDash[tipoProdotto].quantita = parseInt(prodGitHub.qta || prodGitHub.quantita || 0);
                    
                    // 🆕 v8.474: GESTIONE BRM CON FALLBACK LF+100/HF+50
                    const hasBRM = prodGitHub.BRM_L && prodGitHub.BRM_H && 
                                  prodGitHub.BRM_L !== null && prodGitHub.BRM_H !== null &&
                                  parseInt(prodGitHub.BRM_L) > 0 && parseInt(prodGitHub.BRM_H) > 0;
                    
                    if (hasBRM) {
                        // BRM presente: converti formato BRM_L/BRM_H → brm.L/brm.H
                        posDash[tipoProdotto].brm = {
                            L: parseInt(prodGitHub.BRM_L),
                            H: parseInt(prodGitHub.BRM_H)
                        };
                        console.log(`✅ ${tipoProdotto} Pos ${index + 1}: BRM da GitHub ${posDash[tipoProdotto].brm.L}×${posDash[tipoProdotto].brm.H}`);
                    } else {
                        // 🆕 v8.474: FALLBACK LF+100/HF+50 (NON più default 1000×1200!)
                        const LF = parseInt(posDash.misure?.LF) || parseInt(posGitHub.misure?.LF) || 0;
                        const HF = parseInt(posDash.misure?.HF) || parseInt(posGitHub.misure?.HF) || 0;
                        const LVT = parseInt(posDash.misure?.LVT) || parseInt(posGitHub.misure?.LVT) || 0;
                        const HVT = parseInt(posDash.misure?.HVT) || parseInt(posGitHub.misure?.HVT) || 0;
                        
                        let brmL = 0, brmH = 0, fonte = '';
                        
                        if (LF > 0) { brmL = LF + 100; fonte = 'LF+100'; }
                        else if (LVT > 0) { brmL = LVT + 100; fonte = 'LVT+100'; }
                        
                        if (HF > 0) { brmH = HF + 50; fonte += '/HF+50'; }
                        else if (HVT > 0) { brmH = HVT + 50; fonte += '/HVT+50'; }
                        
                        if (brmL > 0 && brmH > 0) {
                            posDash[tipoProdotto].brm = { L: brmL, H: brmH };
                            posDash[tipoProdotto].brmStimato = true;
                            posDash[tipoProdotto].brmOrigine = fonte;
                            console.log(`✅ ${tipoProdotto} Pos ${index + 1}: BRM stimato ${fonte} → ${brmL}×${brmH}`);
                        } else {
                            posDash[tipoProdotto].brm = { L: 600, H: 600 };
                            posDash[tipoProdotto].brmStimato = true;
                            posDash[tipoProdotto].brmOrigine = 'DEFAULT';
                            console.warn(`⚠️ ${tipoProdotto} Pos ${index + 1}: No misure, default 600×600`);
                        }
                    }
                    
                    // Rimuovi solo qta, mantieni BRM_L/BRM_H per debug
                    delete posDash[tipoProdotto].qta;
                }
            });
            
            // 🔐 v7.98_06: Converti BLINDATA/PORTONCINO (supporta pos.ingresso.blindata e pos.blindata)
            const blindataSource = posGitHub.ingresso?.blindata || posGitHub.blindata;
            if (blindataSource) {
                posDash.blindata = { ...blindataSource };
                posDash.ingresso = {
                    tipo: posGitHub.ingresso?.tipo || 'blindata',
                    blindata: { ...blindataSource }
                };
                console.log(`✅ blindata Pos ${index + 1}: ${blindataSource.LNP_L}×${blindataSource.LNP_H} (${blindataSource.versione})`);
            }
            
            // 🔐 v7.98_06: Converti PORTONCINO
            const portoncinoSource = posGitHub.ingresso?.portoncino || posGitHub.portoncino;
            if (portoncinoSource) {
                posDash.portoncino = { ...portoncinoSource };
                posDash.ingresso = {
                    tipo: posGitHub.ingresso?.tipo || 'portoncino',
                    portoncino: { ...portoncinoSource }
                };
                console.log(`✅ portoncino Pos ${index + 1}`);
            }
            
            return posDash;
        });
        
        return {
            ...githubData,
            posizioni: posizioniNormalizzate,
            nome: githubData.name || githubData.projectName || 'Progetto',
            nome_ricerca: githubData.projectName || githubData.name || 'N/D',
            cliente: githubData.clientData || {
                nome: githubData.client || githubData.customerName || 'N/D',
                cognome: '',
                progetto: githubData.projectName || githubData.name || 'N/D',
                piano: githubData.piano || '',
                indirizzo: githubData.indirizzo || '',
                via: githubData.via || '',
                citta: githubData.citta || '',
                telefono: githubData.customerPhone || '',
                email: githubData.customerEmail || ''
            },
            // ✅ v7.73: FIX - Preserva configInfissi
            configInfissi: githubData.configInfissi || {},
            // 🔐 v7.98: Preserva configBlindate
            configBlindate: githubData.configBlindate || {},
            data_rilievo: githubData.created || Date.now()
        };
    }
    
    // Formato sconosciuto - crea struttura minima con posizioni vuoto
    console.error('⚠️ Formato dati non riconosciuto:', githubData);
    console.error('📋 Campi root disponibili:', Object.keys(githubData));
    console.error('💡 Suggerimento: controlla la struttura del JSON salvato su GitHub');
    
    return {
        ...githubData,
        posizioni: [], // ✅ Garantisci array vuoto invece di undefined
        nome: githubData.name || githubData.projectName || githubData.customerName || 'Progetto Sconosciuto',
        nome_ricerca: githubData.projectName || githubData.name || 'N/D',
        cliente: githubData.clientData || githubData.cliente || { 
            nome: githubData.customerName || githubData.client || 'N/D',
            cognome: '',
            progetto: githubData.projectName || githubData.name || 'N/D',
            piano: githubData.piano || '',
            indirizzo: githubData.indirizzo || '',
            via: githubData.via || '',
            citta: githubData.citta || '',
            telefono: githubData.customerPhone || '',
            email: githubData.customerEmail || ''
        },
        data_rilievo: Date.now()
    };
}

function loadGitHubProject(projectId) {
    console.log('📂 loadGitHubProject chiamato con ID:', projectId);
    
    let project = window.githubProjects?.find(p => p.id === projectId);
    
    // 🔧 v8.503: Se non trovato in lista, prova a caricarlo direttamente da GitHub
    if (!project) {
        console.log('⚠️ Progetto non in lista locale, caricamento diretto da GitHub...');
        loadGitHubProjectDirect(projectId);
        return;
    }
    
    console.log('📂 Caricamento progetto:', project.nome);
    console.log('   🔍 rawData.configInfissi:', project.rawData?.configInfissi);
    
    // ✅ CONVERTI formato GitHub → formato Dashboard
    const dashboardData = convertGitHubToDashboardFormat(project.rawData);
    console.log('   🔍 dashboardData.configInfissi dopo conversione:', dashboardData?.configInfissi);
    
    // ✅ v8.492: Salva riferimento GitHub per salvataggio successivo
    window._githubProjectRef = {
        id: projectId,
        filename: `progetti/progetto-${projectId}.json`,
        nome: project.nome,
        rawData: project.rawData
    };
    console.log('💾 v8.493: Riferimento GitHub salvato:', window._githubProjectRef);
    // v8.65: Persisti progetto per F5
    try { sessionStorage.setItem('dash_project', projectId); } catch(e) {}
    
    // ✅ v7.73: Aggiorna projectData PRIMA di processare
    projectData = dashboardData;
    console.log('   🔍 projectData.configInfissi dopo assegnazione:', projectData?.configInfissi);
    
    // Usa la funzione esistente della dashboard per caricare i dati
    processRilievoData(dashboardData, `${project.nome}.json`);
    
    // ✅ v7.73: Aggiorna config globale dopo caricamento
    console.log('   🔄 Chiamata renderConfigGlobale...');
    renderConfigGlobale();
    console.log('   🔄 Chiamata initConfigMenu...');
    initConfigMenu();
    console.log('⚙️ v7.73: Config aggiornata dopo loadGitHubProject');
    
    // ✅ PASSA AUTOMATICAMENTE AL BLOCCO UFFICIO
    switchBlocco('ufficio');
    
    showAlert('success', `Progetto "${project.nome}" caricato da GitHub!`);
}

/**
 * 🔧 v8.503: Carica progetto direttamente da GitHub (fallback se non in lista)
 * Usato per progetti appena creati che non sono ancora nella cache
 */
async function loadGitHubProjectDirect(projectId) {
    console.log('📡 loadGitHubProjectDirect:', projectId);
    
    // Verifica config GitHub
    const config = window.GITHUB_DASHBOARD_CONFIG || GITHUB_DASHBOARD_CONFIG;
    if (!config || !config.token) {
        showAlert('error', '❌ Token GitHub non configurato');
        return;
    }
    
    const filename = `progetti/progetto-${projectId}.json`;
    const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${filename}`;
    
    try {
        showAlert('info', '⏳ Caricamento progetto da GitHub...');
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `token ${config.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (!response.ok) {
            if (response.status === 404) {
                showAlert('error', '❌ Progetto non trovato su GitHub');
            } else {
                showAlert('error', `❌ Errore GitHub: ${response.status}`);
            }
            return;
        }
        
        const fileData = await response.json();
        const content = atob(fileData.content);
        const rawData = JSON.parse(content);
        
        console.log('✅ Progetto caricato direttamente da GitHub:', rawData.id || projectId);
        
        // Crea oggetto project compatibile
        const project = {
            id: rawData.id || projectId,
            nome: rawData.name || rawData.customerName || projectId,
            rawData: rawData
        };
        
        // Aggiungi alla lista locale per future chiamate
        if (!window.githubProjects) window.githubProjects = [];
        const existingIndex = window.githubProjects.findIndex(p => p.id === projectId);
        if (existingIndex >= 0) {
            window.githubProjects[existingIndex] = project;
        } else {
            window.githubProjects.push(project);
        }
        console.log('📋 Progetto aggiunto a githubProjects, totale:', window.githubProjects.length);
        
        // Converti e processa
        const dashboardData = convertGitHubToDashboardFormat(rawData);
        
        // Salva riferimento
        window._githubProjectRef = {
            id: projectId,
            filename: filename,
            nome: project.nome,
            rawData: rawData
        };
        // v8.65: Persisti progetto per F5
        try { sessionStorage.setItem('dash_project', projectId); } catch(e) {}
        
        // Processa
        projectData = dashboardData;
        processRilievoData(dashboardData, `${project.nome}.json`);
        
        // Config
        renderConfigGlobale();
        initConfigMenu();
        
        // Passa a Ufficio
        switchBlocco('ufficio');
        
        showAlert('success', `Progetto "${project.nome}" caricato!`);
        
    } catch (error) {
        console.error('❌ Errore caricamento diretto:', error);
        showAlert('error', '❌ Errore: ' + error.message);
    }
}

/**
 * 💾 v8.493: Salva progetto su GitHub (supporta sia progetti caricati da GitHub che importati localmente)
 */
async function salvaProgettoSuGitHub() {
    // Verifica dati
    if (!window.currentData) {
        showAlert('error', '❌ Nessun progetto caricato');
        return;
    }
    
    if (!window._githubProjectRef) {
        showAlert('error', '❌ Riferimento progetto mancante - ricaricare il progetto');
        return;
    }
    
    if (!GITHUB_DASHBOARD_CONFIG.token) {
        showAlert('error', '❌ Token GitHub non configurato');
        return;
    }
    
    const projectId = window._githubProjectRef.id;
    const filename = `progetti/progetto-${projectId}.json`;
    
    showGitHubStatus('info', '💾 Salvataggio in corso...');
    
    try {
        // 1. Ottieni SHA del file esistente
        const getUrl = `https://api.github.com/repos/${GITHUB_DASHBOARD_CONFIG.owner}/${GITHUB_DASHBOARD_CONFIG.repo}/contents/${filename}`;
        
        const getResponse = await fetch(getUrl, {
            headers: {
                'Authorization': `token ${GITHUB_DASHBOARD_CONFIG.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        let sha = null;
        if (getResponse.ok) {
            const fileData = await getResponse.json();
            sha = fileData.sha;
        }
        
        // 2. Prepara dati da salvare (merge con rawData originale)
        const dataToSave = {
            ...window._githubProjectRef.rawData,
            ...window.currentData,
            configPreventivo: window.currentData.configPreventivo,
            clientData: window.currentData.clientData,  // ✅ v8.493: Salva esplicitamente clientData
            vociExtra: window.currentData.vociExtra
        };
        
        // 3. Aggiungi entry al changeLog
        if (!dataToSave.changeLog) dataToSave.changeLog = [];
        dataToSave.changeLog.push({
            version: (dataToSave.changeLog.length || 0) + 1,
            timestamp: new Date().toISOString(),
            action: 'saved_from_dashboard',
            details: 'Progetto salvato dalla Dashboard Rilievi',
            device: { id: 'dashboard', name: 'Dashboard Ufficio' }
        });
        
        // 4. Codifica in base64
        const content = btoa(unescape(encodeURIComponent(JSON.stringify(dataToSave, null, 2))));
        
        // 5. Push su GitHub
        const putUrl = `https://api.github.com/repos/${GITHUB_DASHBOARD_CONFIG.owner}/${GITHUB_DASHBOARD_CONFIG.repo}/contents/${filename}`;
        
        const putBody = {
            message: `💾 Dashboard: Aggiornato ${window._githubProjectRef.nome}`,
            content: content,
            branch: GITHUB_DASHBOARD_CONFIG.branch
        };
        
        if (sha) {
            putBody.sha = sha; // Necessario per update
        }
        
        const putResponse = await fetch(putUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${GITHUB_DASHBOARD_CONFIG.token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(putBody)
        });
        
        // 🔄 v8.493: Retry per errore 409 Conflict (SHA mismatch)
        if (putResponse.status === 409) {
            console.warn('⚠️ Conflitto SHA - Rileggo SHA corrente e riprovo...');
            
            const retryGetResponse = await fetch(getUrl, {
                headers: {
                    'Authorization': `token ${GITHUB_DASHBOARD_CONFIG.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            if (retryGetResponse.ok) {
                const currentFile = await retryGetResponse.json();
                const newSha = currentFile.sha;
                console.log('🔄 Nuovo SHA ottenuto:', newSha.substring(0, 10) + '...');
                
                // Riprova upload con nuovo SHA
                putBody.sha = newSha;
                const retryPutResponse = await fetch(putUrl, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${GITHUB_DASHBOARD_CONFIG.token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(putBody)
                });
                
                if (retryPutResponse.ok) {
                    showGitHubStatus('success', '✅ Salvato su GitHub (dopo retry)!');
                    console.log('✅ v8.493: Progetto salvato su GitHub dopo retry');
                    return;
                } else {
                    const retryError = await retryPutResponse.json();
                    throw new Error(retryError.message || 'Retry fallito');
                }
            } else {
                throw new Error('Impossibile ottenere SHA corrente per retry');
            }
        }
        
        if (!putResponse.ok) {
            const error = await putResponse.json();
            throw new Error(error.message || `HTTP ${putResponse.status}`);
        }
        
        showGitHubStatus('success', '✅ Salvato su GitHub!');
        console.log('✅ v8.493: Progetto salvato su GitHub');
        
    } catch (error) {
        console.error('❌ Errore salvataggio GitHub:', error);
        showGitHubStatus('error', `❌ Errore: ${error.message}`);
    }
}

/**
 * Mostra stato sincronizzazione GitHub
 */
function showGitHubStatus(type, message) {
    // Crea badge di stato se non esiste
    let badge = document.getElementById('github-status-badge');
    if (!badge) {
        badge = document.createElement('div');
        badge.id = 'github-status-badge';
        badge.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            padding: 0.75rem 1rem;
            border-radius: 8px;
            font-size: 0.9rem;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999;
            transition: all 0.3s;
            opacity: 0;
        `;
        document.body.appendChild(badge);
    }
    
    // Colori per tipo
    const colors = {
        success: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        error: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
        info: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
        warning: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
    };
    
    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️',
        warning: '⚠️'
    };
    
    badge.style.background = colors[type] || colors.info;
    badge.style.color = 'white';
    badge.innerHTML = `${icons[type] || 'ℹ️'} ${message}`;
    badge.style.opacity = '1';
    
    // Nascondi dopo 5 secondi
    setTimeout(() => {
        badge.style.opacity = '0';
    }, 5000);
}

console.log('🔄 GitHub Reader Module loaded');

// ============================================================================
// SISTEMA PREVENTIVAZIONE
// ============================================================================

/**
 * Apre il wizard preventivo con analisi intelligente
 */
function apriPreventivo() {
    console.log('💰 Apertura preventivo...');
    
    if (!window.PreventivoUI) {
        console.error('❌ PreventivoUI non caricato!');
        alert('Errore: modulo preventivo non disponibile');
        return;
    }
    
    if (!window.currentData) {
        alert('⚠️ Nessun progetto caricato. Carica prima un rilievo.');
        return;
    }
    
    // Analizza dati e apre wizard se necessario
    window.WizardCompletamento.avviaAnalisi();
}

console.log('✅ Sistema Preventivazione initialized');

// ═══════════════════════════════════════════════════════════════════════════════
// 📄 MODULO STAMPA DOCUMENTI CLIENTE - v8.40
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Apre il modal per inserire dati cliente e generare documento
 * @param {string} tipo - 'preventivo' o 'conferma'
 */
function generaDocumentoCliente(tipo) {
    console.log('📄 generaDocumentoCliente:', tipo);
    
    if (!window.currentData) {
        alert('⚠️ Nessun progetto caricato. Carica prima un rilievo.');
        return;
    }
    
    // Imposta tipo documento
    document.getElementById('tipoDocumentoCliente').value = tipo;
    
    // Aggiorna titolo modal
    const titolo = tipo === 'preventivo' ? '📄 Genera Preventivo' : '📋 Genera Conferma d\'Ordine';
    document.getElementById('titoloModalDocumento').textContent = titolo;
    
    // Mostra/nascondi sezione acconto
    document.getElementById('sezioneAccontoConferma').style.display = tipo === 'conferma' ? 'block' : 'none';
    
    // Precompila data odierna
    const oggi = new Date().toISOString().split('T')[0];
    document.getElementById('docData').value = oggi;
    
    // Precompila numero documento
    const anno = new Date().getFullYear();
    const numSuggerito = tipo === 'preventivo' ? `PREV-${anno}/` : `ORD-${anno}/`;
    document.getElementById('docNumero').value = numSuggerito;
    
    // Precompila oggetto dal progetto se disponibile
    const progetto = window.currentData;
    if (progetto.cliente) {
        document.getElementById('clienteNome').value = progetto.cliente.nome || '';
        document.getElementById('clienteIndirizzo').value = progetto.cliente.indirizzo || progetto.indirizzo || '';
        document.getElementById('clienteTelefono').value = progetto.cliente.telefono || '';
        document.getElementById('clienteEmail').value = progetto.cliente.email || '';
    }
    if (progetto.indirizzo) {
        document.getElementById('clienteIndirizzo').value = progetto.indirizzo;
    }
    
    // Mostra modal
    document.getElementById('modalDatiCliente').style.display = 'flex';
}

function chiudiModalDatiCliente() {
    document.getElementById('modalDatiCliente').style.display = 'none';
}

/**
 * Genera il documento finale e lo apre per la stampa
 */
function generaDocumentoFinale() {
    const tipo = document.getElementById('tipoDocumentoCliente').value;
    
    // v8.491: Lista placeholder da ignorare (non trascrivere nel PDF)
    const placeholdersDaIgnorare = [
        'Mario Rossi', 'Cliente', '333 1234567', 'mario@email.it', 
        'RSSMRA80A01B157K', 'Via Roma 1, Bergamo', '2025/001',
        'Sostituzione serramenti appartamento', 'Eventuali note...'
    ];
    
    // Funzione helper: restituisce valore solo se NON è un placeholder
    function getValorePulito(id, fallback) {
        const el = document.getElementById(id);
        if (!el) return fallback || '';
        const val = el.value.trim();
        if (!val || placeholdersDaIgnorare.includes(val)) {
            return fallback || '';
        }
        return val;
    }
    
    // Raccogli dati form (escludendo placeholder)
    const datiCliente = {
        nome: getValorePulito('clienteNome', ''),
        indirizzo: getValorePulito('clienteIndirizzo', ''),
        telefono: getValorePulito('clienteTelefono', ''),
        email: getValorePulito('clienteEmail', ''),
        cf: getValorePulito('clienteCF', '')
    };
    
    const datiDoc = {
        numero: getValorePulito('docNumero', ''),
        data: document.getElementById('docData').value || new Date().toISOString().split('T')[0],
        oggetto: getValorePulito('docOggetto', 'Fornitura e posa serramenti'),
        note: getValorePulito('docNote', ''),
        accontoPct: parseFloat(document.getElementById('accontoPct')?.value) || 30,
        tempiConsegna: document.getElementById('tempiConsegna')?.value || '6-8 settimane'
    };
    
    // Raccogli dati preventivo
    const righe = window.righePreventivo || [];
    const totali = raccogliTotaliPreventivo();
    
    // Genera HTML documento
    const htmlDoc = generaHTMLDocumento(tipo, datiCliente, datiDoc, righe, totali);
    
    // Apri in nuova finestra
    const win = window.open('', '_blank');
    win.document.write(htmlDoc);
    win.document.close();
    
    // Chiudi modal
    chiudiModalDatiCliente();
    
    console.log('✅ Documento generato:', tipo);
}

/**
 * Raccoglie i totali dal preventivo corrente
 */
function raccogliTotaliPreventivo() {
    // v8.491: Raccogli ENEA e voci extra DIRETTAMENTE DAL DOM
    const eneaChecked = document.getElementById('checkENEA')?.checked || false;
    const eneaValore = parseFloat(document.getElementById('inputENEA')?.value || 0) || 0;
    
    const voce1Checked = document.getElementById('checkVoceExtra1')?.checked || false;
    const voce1Nome = document.getElementById('inputNomeVoceExtra1')?.value || '';
    const voce1Valore = parseFloat(document.getElementById('inputVoceExtra1')?.value || 0) || 0;
    const voce1IVA = parseInt(document.getElementById('selectIVAVoceExtra1')?.value || 22) || 22;
    
    const voce2Checked = document.getElementById('checkVoceExtra2')?.checked || false;
    const voce2Nome = document.getElementById('inputNomeVoceExtra2')?.value || '';
    const voce2Valore = parseFloat(document.getElementById('inputVoceExtra2')?.value || 0) || 0;
    const voce2IVA = parseInt(document.getElementById('selectIVAVoceExtra2')?.value || 22) || 22;
    
    return {
        listino: document.getElementById('totaleListino')?.textContent || '€ 0.00',
        netto: document.getElementById('totaleNetto')?.textContent || '€ 0.00',
        cliente: document.getElementById('totaleCliente')?.textContent || '€ 0.00',
        lavori: document.getElementById('valTotaleLavori')?.textContent || '€ 0.00',
        subtotale: document.getElementById('valSubtotale')?.textContent || '€ 0.00',
        margine: document.getElementById('valMargine')?.textContent || '€ 0.00',
        // IVA Mista
        beniSignif10: document.getElementById('valBeniSignif10')?.textContent || '',
        beniSignif22: document.getElementById('valBeniSignif22')?.textContent || '',
        partiAutonome: document.getElementById('valPartiAutonome')?.textContent || '',
        manodopera: document.getElementById('valManodoperaFiscale')?.textContent || '',
        imponibile10: document.getElementById('valImponibile10')?.textContent || '',
        imponibile22: document.getElementById('valImponibile22')?.textContent || '',
        iva10: document.getElementById('valIVA10')?.textContent || '',
        iva22: document.getElementById('valIVA22')?.textContent || '',
        // Totale finale
        totaleFinale: document.getElementById('valGrandTotal')?.textContent || '€ 0.00',
        // Configurazioni
        ricaricoPct: document.getElementById('ricaricoPct')?.value || '50',
        tipoIntervento: document.getElementById('tipoInterventoSelect')?.value || 'manutenzione',
        // v8.491: ENEA e Voci Extra (lette dal DOM)
        enea: { valore: eneaValore, checked: eneaChecked },
        voceExtra1: { nome: voce1Nome, valore: voce1Valore, iva: voce1IVA, checked: voce1Checked },
        voceExtra2: { nome: voce2Nome, valore: voce2Valore, iva: voce2IVA, checked: voce2Checked }
    };
}

/**
 * Genera l'HTML completo del documento
 */
function generaHTMLDocumento(tipo, cliente, doc, righe, totali) {
    const isPreventivo = tipo === 'preventivo';
    const titoloDoc = isPreventivo ? 'PREVENTIVO' : 'CONFERMA D\'ORDINE';
    const dataFormattata = new Date(doc.data).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
    
    // Descrizione tipo intervento
    const tipiIntervento = {
        'nessuna': 'Senza IVA',
        'manutenzione': 'Manutenzione ordinaria/straordinaria',
        'ristrutturazione': 'Ristrutturazione edilizia',
        'nuova_costruzione_prima': 'Nuova costruzione - Prima casa',
        'nuova_costruzione_altra': 'Nuova costruzione - Altra abitazione',
        'sola_fornitura': 'Sola fornitura materiali'
    };
    const descIntervento = tipiIntervento[totali.tipoIntervento] || '';
    
    // Calcola acconto se conferma
    let accontoHtml = '';
    if (!isPreventivo) {
        const totaleNum = parseFloat(totali.totaleFinale.replace(/[€\s.]/g, '').replace(',', '.')) || 0;
        const acconto = totaleNum * (doc.accontoPct / 100);
        const saldo = totaleNum - acconto;
        accontoHtml = `
            <tr style="background: #fef3c7;">
                <td colspan="4" style="text-align: right; font-weight: 600;">Acconto alla conferma (${doc.accontoPct}%):</td>
                <td style="text-align: right; font-weight: 700; color: #d97706;">€ ${acconto.toFixed(2)}</td>
            </tr>
            <tr>
                <td colspan="4" style="text-align: right; font-weight: 600;">Saldo alla consegna:</td>
                <td style="text-align: right; font-weight: 600;">€ ${saldo.toFixed(2)}</td>
            </tr>
        `;
    }
    
    // Genera righe tabella prodotti (semplificata per cliente)
    let righeHtml = '';
    righe.forEach((riga, i) => {
        const prezzoCliente = riga._totaleCliente || riga.totale;
        righeHtml += `
            <tr>
                <td style="text-align: center;">${i + 1}</td>
                <td>${riga.ambiente || ''}</td>
                <td>${riga.tipo || ''} ${riga.azienda ? '- ' + riga.azienda : ''}</td>
                <td style="text-align: center;">${riga.larghezza || ''}×${riga.altezza || ''}</td>
                <td style="text-align: center;">${riga.quantita || 1}</td>
                <td style="text-align: right; font-weight: 600;">€ ${parseFloat(prezzoCliente).toFixed(2)}</td>
            </tr>
        `;
    });
    
    // HTML documento completo
    return `<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${titoloDoc} ${doc.numero} - Open Porte & Finestre</title>
    <style>
@page { size: A4; margin: 15mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { 
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
    font-size: 11pt; 
    line-height: 1.4; 
    color: #1f2937;
    padding: 20px;
}
.header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #2563eb; }
.logo-section { flex: 1; }
.logo { max-height: 80px; }
.azienda-info { text-align: right; font-size: 9pt; color: #4b5563; }
.azienda-nome { font-size: 14pt; font-weight: 700; color: #1e40af; margin-bottom: 5px; }

.documento-info { display: flex; justify-content: space-between; margin-bottom: 25px; }
.tipo-documento { 
    font-size: 18pt; font-weight: 700; color: #1e40af; 
    padding: 10px 20px; background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); 
    border-radius: 8px; 
}
.numero-data { text-align: right; }
.numero-data .numero { font-size: 14pt; font-weight: 700; }
.numero-data .data { color: #6b7280; }

.cliente-box { 
    background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; 
    padding: 15px; margin-bottom: 25px; 
}
.cliente-box h4 { color: #374151; margin-bottom: 10px; font-size: 10pt; text-transform: uppercase; letter-spacing: 1px; }
.cliente-nome { font-size: 13pt; font-weight: 700; color: #111827; }
.cliente-dettagli { color: #4b5563; margin-top: 5px; }

.oggetto { background: #eff6ff; padding: 12px 15px; border-left: 4px solid #2563eb; margin-bottom: 20px; }
.oggetto-label { font-size: 9pt; color: #6b7280; text-transform: uppercase; }
.oggetto-testo { font-weight: 600; color: #1e40af; }

table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
th { background: #1e40af; color: white; padding: 10px 8px; text-align: left; font-size: 10pt; }
td { padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 10pt; }
tr:nth-child(even) { background: #f9fafb; }

.totali-section { margin-top: 20px; }
.totali-table { width: 50%; margin-left: auto; }
.totali-table td { padding: 6px 10px; }
.totali-table .totale-finale { background: #1e40af; color: white; font-size: 14pt; font-weight: 700; }

.note-section { margin-top: 30px; padding: 15px; background: #fffbeb; border: 1px solid #fbbf24; border-radius: 8px; }
.note-section h4 { color: #92400e; margin-bottom: 8px; }

.condizioni { margin-top: 30px; font-size: 9pt; color: #6b7280; }
.condizioni h4 { color: #374151; margin-bottom: 10px; }
.condizioni ul { margin-left: 20px; }
.condizioni li { margin-bottom: 5px; }

.firma-section { margin-top: 40px; display: flex; justify-content: space-between; }
.firma-box { width: 45%; }
.firma-box h5 { font-size: 10pt; color: #374151; margin-bottom: 40px; }
.firma-linea { border-top: 1px solid #9ca3af; padding-top: 5px; font-size: 9pt; color: #6b7280; }

.footer { margin-top: 40px; padding-top: 15px; border-top: 2px solid #e5e7eb; text-align: center; font-size: 8pt; color: #9ca3af; }

@media print {
    body { padding: 0; }
    .no-print { display: none; }
}

.print-btn { 
    position: fixed; top: 20px; right: 20px; 
    background: #2563eb; color: white; border: none; 
    padding: 12px 24px; border-radius: 8px; cursor: pointer;
    font-size: 14pt; font-weight: 600; box-shadow: 0 4px 12px rgba(37,99,235,0.3);
}
.print-btn:hover { background: #1d4ed8; }
    </style>
</head>
<body>
    <button class="print-btn no-print" onclick="window.print()">🖨️ Stampa / Salva PDF</button>
    
    <div class="header">
<div class="logo-section">
    <div class="azienda-nome">OPEN PORTE & FINESTRE</div>
    <div style="font-size: 10pt; color: #4b5563; margin-top: 5px;">Serramenti e infissi di qualità</div>
</div>
<div class="azienda-info">
    <div>Via Example 123 - 24100 Bergamo</div>
    <div>Tel. 035 123456 - info@openporte.it</div>
    <div>P.IVA 01234567890</div>
</div>
    </div>
    
    <div class="documento-info">
<div class="tipo-documento">${titoloDoc}</div>
<div class="numero-data">
    <div class="numero">${doc.numero}</div>
    <div class="data">${dataFormattata}</div>
</div>
    </div>
    
    <div class="cliente-box">
<h4>Intestatario</h4>
<div class="cliente-nome">${cliente.nome}</div>
<div class="cliente-dettagli">
    ${cliente.indirizzo ? cliente.indirizzo + '<br>' : ''}
    ${cliente.telefono ? 'Tel. ' + cliente.telefono : ''} ${cliente.email ? '- ' + cliente.email : ''}
    ${cliente.cf ? '<br>C.F./P.IVA: ' + cliente.cf : ''}
</div>
    </div>
    
    <div class="oggetto">
<div class="oggetto-label">Oggetto</div>
<div class="oggetto-testo">${doc.oggetto}</div>
${descIntervento ? '<div style="font-size: 9pt; color: #6b7280; margin-top: 5px;">Tipo intervento: ' + descIntervento + '</div>' : ''}
    </div>
    
    <table>
<thead>
    <tr>
        <th style="width: 5%; text-align: center;">N.</th>
        <th style="width: 15%;">Ambiente</th>
        <th style="width: 40%;">Descrizione</th>
        <th style="width: 15%; text-align: center;">Misure (mm)</th>
        <th style="width: 8%; text-align: center;">Qtà</th>
        <th style="width: 17%; text-align: right;">Importo</th>
    </tr>
</thead>
<tbody>
    ${righeHtml}
</tbody>
    </table>
    
    <div class="totali-section">
<table class="totali-table">
    <tr>
        <td colspan="4" style="text-align: right;">Totale Materiali:</td>
        <td style="text-align: right; font-weight: 600;">${totali.materiali}</td>
    </tr>
    <tr>
        <td colspan="4" style="text-align: right;">Posa e installazione:</td>
        <td style="text-align: right;">${totali.lavori}</td>
    </tr>
    <tr style="border-top: 2px solid #d1d5db;">
        <td colspan="4" style="text-align: right; font-weight: 600;">Imponibile:</td>
        <td style="text-align: right; font-weight: 600;">${totali.subtotale}</td>
    </tr>
    ${totali.imponibile10 && totali.iva10 ? `
    <tr>
        <td colspan="4" style="text-align: right; font-size: 9pt;">IVA 10% su ${totali.imponibile10}:</td>
        <td style="text-align: right;">${totali.iva10}</td>
    </tr>` : ''}
    ${totali.imponibile22 && totali.iva22 ? `
    <tr>
        <td colspan="4" style="text-align: right; font-size: 9pt;">IVA 22% su ${totali.imponibile22}:</td>
        <td style="text-align: right;">${totali.iva22}</td>
    </tr>` : ''}
    <tr class="totale-finale">
        <td colspan="4" style="text-align: right; padding: 12px;">TOTALE:</td>
        <td style="text-align: right; padding: 12px;">${totali.totaleFinale}</td>
    </tr>
    ${accontoHtml}
</table>
    </div>
    
    ${doc.note ? `
    <div class="note-section">
<h4>📝 Note</h4>
<p>${doc.note}</p>
    </div>` : ''}
    
    <div class="condizioni">
<h4>${isPreventivo ? 'Condizioni di Offerta' : 'Condizioni Contrattuali'}</h4>
<ul>
    ${isPreventivo ? `
    <li><strong>Validità offerta:</strong> 30 giorni dalla data del presente documento</li>
    <li>I prezzi si intendono per merce resa in cantiere, posa inclusa</li>
    <li>Sono esclusi: opere murarie, ponteggi esterni, permessi comunali</li>
    <li>Eventuali modifiche in corso d'opera saranno quotate separatamente</li>
    ` : `
    <li><strong>Acconto:</strong> ${doc.accontoPct}% alla conferma d'ordine</li>
    <li><strong>Saldo:</strong> alla consegna/fine lavori</li>
    <li><strong>Tempi di consegna:</strong> ${doc.tempiConsegna} dalla conferma</li>
    <li>La merce resta di proprietà del fornitore fino al completo pagamento</li>
    `}
    <li>Garanzia prodotti: secondo normativa vigente e condizioni del produttore</li>
</ul>
    </div>
    
    <div class="firma-section">
<div class="firma-box">
    <h5>Per accettazione - Il Cliente</h5>
    <div class="firma-linea">Firma: _______________________</div>
    <div style="margin-top: 10px; font-size: 9pt; color: #6b7280;">Data: _______________________</div>
</div>
<div class="firma-box">
    <h5>Open Porte & Finestre</h5>
    <div class="firma-linea">Firma: _______________________</div>
</div>
    </div>
    
    <div class="footer">
<p>Open Porte & Finestre - Via Example 123, 24100 Bergamo - Tel. 035 123456</p>
<p>P.IVA 01234567890 - info@openporte.it - www.openporte.it</p>
    </div>
    
</body>
</html>`;
}

// Export globale per onclick
window.generaDocumentoCliente = generaDocumentoCliente;
window.chiudiModalDatiCliente = chiudiModalDatiCliente;
window.generaDocumentoFinale = generaDocumentoFinale;

console.log('📄 Modulo Stampa Documenti Cliente initialized');


    
if (!window.CompletionTracker) {
    window.CompletionTracker = {
        updateMenuStatus: function() {
            console.log('⚠️ CompletionTracker stub - funzione non implementata');
        }
    };
}

if (!window.BadgeRenderer) {
    window.BadgeRenderer = {
        getBadgeHTML: function() { return ''; },
        renderMiniProgressBar: function() { return ''; }
    };
}
    
// ============================================================================
// PREVENTIVO CALCULATOR - Sistema di calcolo preventivi
// ============================================================================
window.PreventivoCalculator = {
    
    // Listini fornitori (caricati dinamicamente)
    listini: {
        finstral: null,
        palagina: null,
        persiane: null
    },
    
    // ✅ v8.66: listino_finstral rimosso - dati centralizzati in finstral-module.js
    
    // Configurazione prezzi base
    config: {
        iva: 0.22,
        margine_default: 1.30,
        costo_posa_mq: 85.00,
        costo_smontaggio: 45.00
    },
    
    /**
     * Calcola preventivo completo per un progetto
     */
    calcolaPreventivo(datiProgetto) {
        console.log('💰 Calcolo preventivo per:', datiProgetto.nome);
        
        const risultato = {
            successo: true,
            progetto: datiProgetto.nome || 'Progetto',
            cliente: datiProgetto.cliente || {},
            timestamp: new Date().toISOString(),
            voci: [],
            totali: {
                materiali: 0,
                posa: 0,
                smontaggio: 0,
                subtotale: 0,
                iva: 0,
                totale: 0
            },
            warnings: []
        };
        
        // Analizza ogni posizione
        const posizioni = datiProgetto.posizioni || [];
        
        posizioni.forEach((pos, idx) => {
            // INFISSI - 🆕 v7.82: Supporta sia qta che quantita
            const infQta = getQta(pos.infisso) || 0;
            if (pos.infisso && infQta > 0) {
                const voce = this.calcolaVoceInfisso(pos, idx + 1);
                if (voce.successo) {
                    risultato.voci.push(voce);
                    risultato.totali.materiali += parseFloat(voce.importo);
                    risultato.totali.posa += parseFloat(voce.costo_posa || 0);
                } else {
                    risultato.warnings.push(voce.errore);
                }
            }
            
            // ZANZARIERE - 🆕 v7.82: Supporta sia qta che quantita
            const zanzQta = getQta(pos.zanzariera) || 0;
            if (pos.zanzariera && zanzQta > 0) {
                const voce = this.calcolaVoceZanzariera(pos, idx + 1);
                if (voce.successo) {
                    risultato.voci.push(voce);
                    risultato.totali.materiali += parseFloat(voce.importo);
                } else {
                    risultato.warnings.push(voce.errore);
                }
            }
            
            // PERSIANE - 🆕 v7.82: Supporta sia qta che quantita
            const persQta = getQta(pos.persiana) || 0;
            if (pos.persiana && persQta > 0) {
                const voce = this.calcolaVocePersiana(pos, idx + 1);
                if (voce.successo) {
                    risultato.voci.push(voce);
                    risultato.totali.materiali += parseFloat(voce.importo);
                    risultato.totali.posa += parseFloat(voce.costo_posa || 0);
                } else {
                    risultato.warnings.push(voce.errore);
                }
            }
            
            // TAPPARELLE - 🆕 v7.82: Supporta sia qta che quantita
            const tappQta = getQta(pos.tapparella) || 0;
            if (pos.tapparella && tappQta > 0) {
                // Assicura che quantita sia valorizzato
                const voce = this.calcolaVoceTapparella(pos, idx + 1);
                if (voce.successo) {
                    risultato.voci.push(voce);
                    risultato.totali.materiali += parseFloat(voce.importo);
                } else {
                    risultato.warnings.push(voce.errore);
                }
            }
            
            // CASSONETTI - 🆕 v7.82: Supporta sia qta che quantita
            const cassQta = getQta(pos.cassonetto) || 0;
            if (pos.cassonetto && cassQta > 0) {
                const voce = this.calcolaVoceCassonetto(pos, idx + 1);
                if (voce.successo) {
                    risultato.voci.push(voce);
                    risultato.totali.materiali += parseFloat(voce.importo);
                } else {
                    risultato.warnings.push(voce.errore);
                }
            }
        });
        
        // Calcola totali
        risultato.totali.smontaggio = posizioni.length * this.config.costo_smontaggio;
        risultato.totali.subtotale = risultato.totali.materiali + 
                                     risultato.totali.posa + 
                                     risultato.totali.smontaggio;
        risultato.totali.iva = risultato.totali.subtotale * this.config.iva;
        risultato.totali.totale = risultato.totali.subtotale + risultato.totali.iva;
        
        // Arrotonda tutti i totali
        Object.keys(risultato.totali).forEach(key => {
            risultato.totali[key] = parseFloat(risultato.totali[key].toFixed(2));
        });
        
        console.log('✅ Preventivo calcolato:', risultato.totali);
        
        return risultato;
    },
    
    /**
     * Calcola voce infisso
     */
    calcolaVoceInfisso(posizione, numero) {
        const infisso = posizione.infisso;
        
        // 🔧 COMPATIBILITÀ RETROATTIVA: Supporta sia brm.L che BRM_L
        const L = infisso.brm?.L || infisso.BRM_L || 0;
        const H = infisso.brm?.H || infisso.BRM_H || 0;
        
        // Validazione dati base
        if (!L || !H) {
            return {
                successo: false,
                errore: `Posizione ${numero}: Mancano misure BRM per infisso`
            };
        }
        
        // Calcoli base (L e H già definiti sopra)
        const perimetro = 2 * (L + H) / 1000; // metri lineari
        const superficie = (L * H) / 1000000; // mq
        
        let prezzo_totale = 0;
        let dettaglio = [];
        
        // CALCOLO FINSTRAL CON FORMULA AVANZATA
        if (infisso.azienda && infisso.azienda.toLowerCase().includes('finstral')) {
            
            // DETERMINA MATERIALE da finituraEst (o finituraInt come fallback)
            const finitura = infisso.finituraEst || infisso.finituraInt || '';
            const isMaterialePVC = !finitura.toLowerCase().includes('alluminio');
            
            // 1. PREZZO BASE (tipo 101 finestra o tipo 401 porta-finestra)
            const isPortaFinestra = infisso.tipo && (
                infisso.tipo.toLowerCase().includes('pf') || 
                infisso.tipo.toLowerCase().includes('porta') ||
                H > 1800
            );
            
            let prezzo_base = 0;
            if (isPortaFinestra) {
                // Tipo 401: ~220€/mq + 200€ fisso
                prezzo_base = (superficie * 220) + 200;
                dettaglio.push(`Base Porta-finestra (tipo 401): ${prezzo_base.toFixed(0)}€`);
            } else {
                // Tipo 101: ~180€/mq + 100€ fisso
                prezzo_base = (superficie * 180) + 100;
                dettaglio.push(`Base Finestra (tipo 101): ${prezzo_base.toFixed(0)}€`);
            }
            
            prezzo_totale += prezzo_base;
            
            // 2. SUPPLEMENTO TELAIO - usa calcolaSupplementoTelaio da finstral-module.js
            if (infisso.telaio && typeof calcolaSupplementoTelaio === 'function') {
                const costo = calcolaSupplementoTelaio(infisso.telaio, perimetro, !isMaterialePVC);
                if (costo > 0) {
                    prezzo_totale += costo;
                    dettaglio.push(`Supp.Tel.${infisso.telaio}: +${costo.toFixed(0)}€`);
                }
            }
            
            // 3. SUPPLEMENTO MATERIALE (Alluminio su telaio base 961)
            if (!isMaterialePVC && (!infisso.telaio || infisso.telaio === '961')) {
                const costo = perimetro * 25;
                prezzo_totale += costo;
                dettaglio.push(`Rivestimento Alluminio: +${costo.toFixed(0)}€`);
            }
            
            // 4. SUPPLEMENTO ANTA - usa calcolaSupplementoAnta da finstral-module.js
            if (infisso.tipoAnta && typeof calcolaSupplementoAnta === 'function') {
                const costo = calcolaSupplementoAnta(infisso.tipoAnta, perimetro);
                if (costo > 0) {
                    prezzo_totale += costo;
                    dettaglio.push(`Supp.Anta ${infisso.tipoAnta}: +${costo.toFixed(0)}€`);
                }
            }
            
            // 5. SUPPLEMENTO VETRO - usa calcolaSupplementoVetro da finstral-module.js
            if (infisso.vetro && typeof calcolaSupplementoVetro === 'function') {
                const costo = calcolaSupplementoVetro(infisso.vetro, superficie);
                if (costo > 0) {
                    prezzo_totale += costo;
                    dettaglio.push(`Supp.Vetro ${infisso.vetro}: +${costo.toFixed(0)}€`);
                }
            }
            
        } else {
            // CALCOLO STANDARD NON-FINSTRAL
            prezzo_totale = superficie * 450;
            dettaglio.push('Calcolo standard');
        }
        
        // POSA
        const costo_posa = superficie * this.config.costo_posa_mq * infisso.quantita;
        const importo_totale = prezzo_totale * infisso.quantita;
        
        return {
            successo: true,
            tipo: 'Infisso',
            posizione: posizione.nome || posizione.ambiente || `Pos. ${numero}`,
            descrizione: `${infisso.azienda || 'Infisso'} - ${infisso.tipo || ''} ${infisso.telaio || ''}`,
            quantita: infisso.quantita,
            misure: `${L}×${H} mm`,  // Usa variabili uniformate
            perimetro_ml: perimetro.toFixed(2),
            superficie_mq: superficie.toFixed(2),
            prezzo_unitario: prezzo_totale.toFixed(2),
            importo: importo_totale.toFixed(2),
            costo_posa: costo_posa.toFixed(2),
            dettaglio_calcolo: dettaglio.join(' | '),
            note: infisso.note || ''
        };
    },
    
    /**
     * Calcola voce zanzariera
     */
    calcolaVoceZanzariera(posizione, numero) {
        const zanzariera = posizione.zanzariera;
        
        if (!zanzariera.brm || !zanzariera.brm.L || !zanzariera.brm.H) {
            return {
                successo: false,
                errore: `Posizione ${numero}: Mancano misure BRM per zanzariera`
            };
        }
        
        const superficie_mq = (zanzariera.brm.L * zanzariera.brm.H) / 1000000;
        
        const prezzi_base = {
            'plisse': 120,
            'avvolgibile': 95,
            'battente': 85,
            'scorrevole': 110
        };
        
        const tipo_lower = (zanzariera.tipo || zanzariera.modello || '').toLowerCase();
        let prezzo_mq = 100;
        
        for (const [key, value] of Object.entries(prezzi_base)) {
            if (tipo_lower.includes(key)) {
                prezzo_mq = value;
                break;
            }
        }
        
        const prezzo_unitario = superficie_mq * prezzo_mq;
        const importo = prezzo_unitario * zanzariera.quantita;
        
        return {
            successo: true,
            tipo: 'Zanzariera',
            posizione: posizione.nome || posizione.ambiente || `Pos. ${numero}`,
            descrizione: zanzariera.tipo || zanzariera.modello || 'Zanzariera',
            quantita: zanzariera.quantita,
            misure: `${zanzariera.brm.L}×${zanzariera.brm.H} mm`,
            superficie_mq: superficie_mq.toFixed(2),
            prezzo_unitario: prezzo_unitario.toFixed(2),
            importo: importo.toFixed(2)
        };
    },
    
    /**
     * Calcola voce persiana
     */
    calcolaVocePersiana(posizione, numero) {
        const persiana = posizione.persiana;
        
        if (!persiana.brm || !persiana.brm.L || !persiana.brm.H) {
            return {
                successo: false,
                errore: `Posizione ${numero}: Mancano misure BRM per persiana`
            };
        }
        
        const superficie_mq = (persiana.brm.L * persiana.brm.H) / 1000000;
        const prezzo_mq = 180;
        const prezzo_unitario = superficie_mq * prezzo_mq;
        const costo_posa = superficie_mq * 45 * persiana.quantita;
        const importo = prezzo_unitario * persiana.quantita;
        
        return {
            successo: true,
            tipo: 'Persiana',
            posizione: posizione.nome || posizione.ambiente || `Pos. ${numero}`,
            descrizione: persiana.tipo || 'Persiana',
            quantita: persiana.quantita,
            misure: `${persiana.brm.L}×${persiana.brm.H} mm`,
            superficie_mq: superficie_mq.toFixed(2),
            prezzo_unitario: prezzo_unitario.toFixed(2),
            importo: importo.toFixed(2),
            costo_posa: costo_posa.toFixed(2)
        };
    },
    
    /**
     * Calcola voce tapparella
     */
    calcolaVoceTapparella(posizione, numero) {
        const tapparella = posizione.tapparella;
        
        // 🆕 v7.82: Helper locale per estrarre codice
        const estraiCodice = (str) => str ? String(str).split(' - ')[0].trim() : null;
        
        // 🆕 v7.82: Estrai misure (supporta più formati)
        let L_mm = parseInt(tapparella.brm?.L) || parseInt(tapparella.BRM_L) || parseInt(posizione.misure?.LF) || 0;
        let H_mm = parseInt(tapparella.brm?.H) || parseInt(tapparella.BRM_H) || parseInt(posizione.misure?.HF) || 0;
        
        if (!L_mm || !H_mm) {
            return {
                successo: false,
                errore: `Posizione ${numero}: Mancano misure BRM per tapparella`
            };
        }
        
        // 🆕 v7.82: Maggiorazione foro se da LF/HF
        const usaMisureForo = !tapparella.brm?.L && !tapparella.BRM_L && (posizione.misure?.LF || posizione.misure?.HF);
        if (usaMisureForo) {
            L_mm += 40;   // +40mm larghezza
            H_mm += 200;  // +200mm altezza
        }
        
        const L_cm = L_mm / 10;
        const H_cm = H_mm / 10;
        
        // 🆕 v7.82: Estrai codice modello (es. "TA01" da "TA01 - Tipo ALUPROFIL MD 13x55")
        const modelloCompleto = tapparella.modello || 'TA01';
        const modelloTelo = estraiCodice(modelloCompleto) || 'TA01';
        const coloreTelo = tapparella.colore_tipo || 'tinta_unita';
        
        let prezzo_unitario = 0;
        let dettaglioCalcolo = null;
        
        // Verifica se calcolaPrezzoPLASTICINO è disponibile
        if (typeof calcolaPrezzoPLASTICINO === 'function') {
            dettaglioCalcolo = calcolaPrezzoPLASTICINO(L_cm, H_cm, modelloTelo, coloreTelo);
            prezzo_unitario = dettaglioCalcolo.totale || 0;
            
            // 🆕 v7.82: Estrai codice guida (es. "TG10" da "TG10 - Guide 30x25x30 Portafinestra")
            const guidaCompleta = tapparella.guida || '';
            const guidaCodice = estraiCodice(guidaCompleta);
            if (guidaCodice && guidaCodice !== '' && typeof calcolaPrezzoGuida === 'function') {
                const coloreGuida = tapparella.coloreGuida || 'Argento';
                const guidaCalc = calcolaPrezzoGuida(guidaCodice, coloreGuida, H_mm);
                prezzo_unitario += guidaCalc.prezzo || 0;
            }
            
            console.log(`✅ v7.82 Tapparella Pos ${numero}: ${L_cm}×${H_cm}cm → €${prezzo_unitario.toFixed(2)}`);
        } else {
            // Fallback se funzione non disponibile
            const superficie_mq = (L_cm * H_cm) / 10000;
            const prezzo_base = tapparella.motorizzazione === 'si' ? 250 : 120;
            prezzo_unitario = superficie_mq * prezzo_base;
            console.warn(`⚠️ v7.82 Tapparella Pos ${numero}: Fallback calcolo semplificato`);
        }
        
        const quantita = parseInt(tapparella.quantita) || 1;
        const importo = prezzo_unitario * quantita;
        const superficie_mq = (L_cm * H_cm) / 10000;
        
        return {
            successo: true,
            tipo: 'Tapparella',
            posizione: posizione.nome || posizione.ambiente || `Pos. ${numero}`,
            descrizione: tapparella.motorizzazione === 'si' ? 'Tapparella Motorizzata' : 'Tapparella Manuale',
            quantita: quantita,
            misure: `${L_mm}×${H_mm} mm`,
            superficie_mq: superficie_mq.toFixed(2),
            prezzo_unitario: prezzo_unitario.toFixed(2),
            importo: importo.toFixed(2),
            dettaglio: dettaglioCalcolo  // 🆕 v7.82: Salva dettaglio per breakdown
        };
    },
    
    /**
     * Calcola voce cassonetto
     */
    calcolaVoceCassonetto(posizione, numero) {
        const cassonetto = posizione.cassonetto;
        
        if (!cassonetto.brm || !cassonetto.brm.L) {
            return {
                successo: false,
                errore: `Posizione ${numero}: Mancano misure per cassonetto`
            };
        }
        
        const lunghezza_m = cassonetto.brm.L / 1000;
        const prezzo_ml = 65;
        const prezzo_unitario = lunghezza_m * prezzo_ml;
        const importo = prezzo_unitario * cassonetto.quantita;
        
        return {
            successo: true,
            tipo: 'Cassonetto',
            posizione: posizione.nome || posizione.ambiente || `Pos. ${numero}`,
            descrizione: cassonetto.tipo || 'Cassonetto',
            quantita: cassonetto.quantita,
            misure: `L: ${cassonetto.brm.L} mm`,
            prezzo_unitario: prezzo_unitario.toFixed(2),
            importo: importo.toFixed(2)
        };
    }
};

console.log('💰 PreventivoCalculator loaded');
    
// ============================================================================
// PREVENTIVO UI - Interfaccia utente per preventivi
// ============================================================================
window.PreventivoUI = {
    
    preventivoCorrente: null,
    
    apriModalPreventivo() {
        console.log('📊 Apertura modal preventivo...');
        
        if (!window.currentData || !window.currentData.posizioni) {
            this.mostraErrore('Nessun progetto caricato');
            return;
        }
        
        const preventivo = window.PreventivoCalculator.calcolaPreventivo(window.currentData);
        this.preventivoCorrente = preventivo;
        
        // RIMOSSA VALIDAZIONE - ora gestita dal Wizard
        // Il wizard si occupa di completare i dati mancanti prima di arrivare qui
        
        this.renderPreventivo(preventivo);
    },
    
    mostraNoData() {
        const html = `
            <div class="preventivo-modal-overlay" id="preventivo-modal" onclick="if(event.target===this) PreventivoUI.chiudiModal()">
                <div class="preventivo-modal">
                    <div class="preventivo-modal-header">
                        <h2 class="preventivo-modal-title">💰 Dettaglio Costi</h2>
                        <button class="preventivo-modal-close" onclick="PreventivoUI.chiudiModal()">✕</button>
                    </div>
                    
                    <div class="preventivo-warning">
                        <div class="preventivo-warning-icon">⚠️</div>
                        <div class="preventivo-warning-text">
                            <p>Nessun prodotto con dati sufficienti per calcolare il preventivo.</p>
                            <p>Verifica che siano presenti <strong>modelli</strong> e <strong>misure BRM</strong> nei rilievi.</p>
                        </div>
                    </div>
                    
                    <div class="preventivo-modal-actions">
                        <button class="btn-preventivo btn-secondary" onclick="PreventivoUI.chiudiModal()">
                            ← Chiudi
                        </button>
                        <button class="btn-preventivo btn-primary" disabled style="opacity: 0.5; cursor: not-allowed;">
                            📄 Esporta PDF
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        const container = document.createElement('div');
        container.innerHTML = html;
        document.body.appendChild(container.firstElementChild);
    },
    
    renderPreventivo(preventivo) {
        console.log('🎨 Rendering preventivo...', preventivo);
        
        // Se davvero non ci sono voci (dopo wizard), mostra messaggio
        if (preventivo.voci.length === 0) {
            const html = `
                <div class="preventivo-modal-overlay" id="preventivo-modal" onclick="if(event.target===this) PreventivoUI.chiudiModal()">
                    <div class="preventivo-modal">
                        <div class="preventivo-modal-header">
                            <h2 class="preventivo-modal-title">💰 Dettaglio Costi</h2>
                            <button class="preventivo-modal-close" onclick="PreventivoUI.chiudiModal()">✕</button>
                        </div>
                        
                        <div class="preventivo-warning">
                            <div class="preventivo-warning-icon">⚠️</div>
                            <div class="preventivo-warning-text">
                                <p>Nessun prodotto trovato nel progetto.</p>
                                <p>Verifica che ci siano prodotti con <strong>quantità > 0</strong> nelle posizioni.</p>
                            </div>
                        </div>
                        
                        <div class="preventivo-modal-actions">
                            <button class="btn-preventivo btn-secondary" onclick="PreventivoUI.chiudiModal()">
                                ← Chiudi
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
            return;
        }
        
        const html = `
            <div class="preventivo-modal-overlay" id="preventivo-modal" onclick="if(event.target===this) PreventivoUI.chiudiModal()">
                <div class="preventivo-modal preventivo-modal-large">
                    <div class="preventivo-modal-header">
                        <div>
                            <h2 class="preventivo-modal-title">💰 Dettaglio Costi</h2>
                            <p class="preventivo-modal-subtitle">${preventivo.progetto}</p>
                        </div>
                        <button class="preventivo-modal-close" onclick="PreventivoUI.chiudiModal()">✕</button>
                    </div>
                    
                    <div class="preventivo-cliente-info">
                        <div class="preventivo-info-item">
                            <span class="preventivo-info-label">Cliente:</span>
                            <span class="preventivo-info-value">${preventivo.cliente.nome || 'N/D'}</span>
                        </div>
                        ${preventivo.cliente.indirizzo ? `
                        <div class="preventivo-info-item">
                            <span class="preventivo-info-label">Indirizzo:</span>
                            <span class="preventivo-info-value">${preventivo.cliente.indirizzo}</span>
                        </div>
                        ` : ''}
                        <div class="preventivo-info-item">
                            <span class="preventivo-info-label">Data:</span>
                            <span class="preventivo-info-value">${new Date().toLocaleDateString('it-IT')}</span>
                        </div>
                    </div>
                    
                    ${preventivo.warnings.length > 0 ? `
                    <div class="preventivo-warnings-list">
                        <div class="preventivo-warnings-title">⚠️ Avvisi:</div>
                        ${preventivo.warnings.map(w => `<div class="preventivo-warning-item">${w}</div>`).join('')}
                    </div>
                    ` : ''}
                    
                    <div class="preventivo-table-container">
                        <table class="preventivo-table">
                            <thead>
                                <tr>
                                    <th>Posizione</th>
                                    <th>Tipo</th>
                                    <th>Descrizione</th>
                                    <th>Misure</th>
                                    <th>Qtà</th>
                                    <th>Prezzo Unit.</th>
                                    <th>Importo</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${preventivo.voci.map((voce, index) => {
                                    // 🆕 v7.82: Determina se riga è cliccabile
                                    // 🔌 v8.09: Aggiunto Motore
                                    const isTapparella = voce.tipo.toLowerCase() === 'tapparella';
                                    const isPersiana = voce.tipo.toLowerCase() === 'persiana';
                                    const isMotore = voce.tipo.toLowerCase() === 'motore';
                                    const isClickable = isTapparella || isPersiana || isMotore;
                                    const clickStyle = isClickable ? 'cursor: pointer;' : '';
                                    // Estrai numero posizione (es: "Pos. 1" → 1)
                                    const posNum = parseInt(String(voce.posizione).replace(/\D/g, '')) || (index + 1);
                                    // 🆕 v7.84: Supporto persiane
                                    // 🔌 v8.09: Supporto motori
                                    const clickHandler = isTapparella ? `onclick="window.mostraDettaglioCostiTapparella(${posNum})" onmouseover="this.style.background='#fef3c7'" onmouseout="this.style.background=''"` : 
                                                         isPersiana ? `onclick="window.mostraDettaglioCostiPersiana(${posNum})" onmouseover="this.style.background='#f3e8ff'" onmouseout="this.style.background=''"` :
                                                         isMotore ? `onclick="window.mostraDettaglioCostiMotore(${posNum})" onmouseover="this.style.background='#ffedd5'" onmouseout="this.style.background=''"` : '';
                                    const clickIcon = isClickable ? ' 🔍' : '';
                                    const clickTitle = isClickable ? 'title="Clicca per vedere il dettaglio costi"' : '';
                                    
                                    return `
                                    <tr style="${clickStyle}" ${clickHandler} ${clickTitle}>
                                        <td>${voce.posizione}</td>
                                        <td><span class="voce-tipo-badge ${voce.tipo.toLowerCase()}">${voce.tipo}${clickIcon}</span></td>
                                        <td>${voce.descrizione}</td>
                                        <td style="font-family: monospace; font-size: 0.9rem;">${voce.misure}</td>
                                        <td style="text-align: center; font-weight: 600;">${voce.quantita}</td>
                                        <td style="text-align: right;">€ ${voce.prezzo_unitario}</td>
                                        <td style="text-align: right; font-weight: 700;">€ ${voce.importo}</td>
                                    </tr>
                                `}).join('')}
                            </tbody>
                        </table>
                    </div>
                    
                    <div class="preventivo-totali">
                        <div class="preventivo-totale-row">
                            <span>Materiali:</span>
                            <span>€ ${preventivo.totali.materiali.toFixed(2)}</span>
                        </div>
                        <div class="preventivo-totale-row">
                            <span>Posa:</span>
                            <span>€ ${preventivo.totali.posa.toFixed(2)}</span>
                        </div>
                        <div class="preventivo-totale-row">
                            <span>Smontaggio:</span>
                            <span>€ ${preventivo.totali.smontaggio.toFixed(2)}</span>
                        </div>
                        <div class="preventivo-totale-row subtotale">
                            <span>Subtotale:</span>
                            <span>€ ${preventivo.totali.subtotale.toFixed(2)}</span>
                        </div>
                        <div class="preventivo-totale-row">
                            <span>IVA (22%):</span>
                            <span>€ ${preventivo.totali.iva.toFixed(2)}</span>
                        </div>
                        <div class="preventivo-totale-row finale">
                            <span>TOTALE:</span>
                            <span>€ ${preventivo.totali.totale.toFixed(2)}</span>
                        </div>
                    </div>
                    
                    <div class="preventivo-modal-actions">
                        <button class="btn-preventivo btn-secondary" onclick="PreventivoUI.chiudiModal()">
                            ← Chiudi
                        </button>
                        <button class="btn-preventivo btn-primary" onclick="PreventivoUI.esportaPDF()">
                            📄 Esporta PDF
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        const container = document.createElement('div');
        container.innerHTML = html;
        document.body.appendChild(container.firstElementChild);
    },
    
    chiudiModal() {
        const modal = document.getElementById('preventivo-modal');
        if (modal) {
            modal.remove();
        }
    },
    
    esportaPDF() {
        if (!this.preventivoCorrente) {
            alert('Nessun preventivo da esportare');
            return;
        }
        
        console.log('📄 Esportazione PDF preventivo...');
        alert('Funzione esportazione PDF in arrivo!');
    },
    
    mostraErrore(messaggio) {
        alert('❌ ' + messaggio);
    }
};

console.log('🎨 PreventivoUI loaded');
    
// ============================================================================
// WIZARD COMPLETAMENTO DATI - Sistema intelligente multi-step
// ============================================================================
window.WizardCompletamento = {
    
    datiProgetto: null,
    analisi: null,
    configurazioneMisure: null,
    attributiCompletati: {},
    stepCorrente: 0,
    
    /**
     * Avvia analisi dati progetto
     */
    avviaAnalisi() {
        console.log('🔍 Avvio analisi dati progetto...');
        
        this.datiProgetto = window.currentData;
        this.analisi = this.analizzaDati();
        
        console.log('📊 Analisi completata:', this.analisi);
        
        // Se tutto OK, vai diretto al preventivo
        if (this.analisi.tuttoOK) {
            console.log('✅ Tutti i dati presenti, genero preventivo diretto');
            window.PreventivoUI.apriModalPreventivo();
            return;
        }
        
        // Altrimenti apri wizard
        this.apriWizard();
    },
    
    /**
     * Analizza dati e trova cosa manca
     */
    analizzaDati() {
        const analisi = {
            tuttoOK: true,
            posizioniTotali: 0,
            posizioniComplete: 0,
            problemi: {
                misureBRM: [],
                attributi: []
            }
        };
        
        const posizioni = this.datiProgetto.posizioni || [];
        analisi.posizioniTotali = posizioni.length;
        
        posizioni.forEach((pos, idx) => {
            let posOK = true;
            
            // Controlla ogni tipo di prodotto
            ['infisso', 'zanzariera', 'persiana', 'tapparella', 'cassonetto'].forEach(tipo => {
                const prodotto = pos[tipo];
                
                if (prodotto && prodotto.quantita > 0) {
                    // Verifica BRM
                    const brmOK = this.verificaBRM(prodotto, tipo);
                    if (!brmOK) {
                        analisi.problemi.misureBRM.push({
                            posizioneIdx: idx,
                            posizione: pos.nome || pos.ambiente || `Posizione ${idx + 1}`,
                            tipo: tipo,
                            prodotto: prodotto,
                            misureDisponibili: pos.misure || {}
                        });
                        posOK = false;
                        analisi.tuttoOK = false;
                    }
                    
                    // Verifica attributi specifici
                    const attributiMancanti = this.verificaAttributi(prodotto, tipo);
                    if (attributiMancanti.length > 0) {
                        analisi.problemi.attributi.push({
                            posizioneIdx: idx,
                            posizione: pos.nome || pos.ambiente || `Posizione ${idx + 1}`,
                            tipo: tipo,
                            prodotto: prodotto,
                            attributiMancanti: attributiMancanti
                        });
                        posOK = false;
                        analisi.tuttoOK = false;
                    }
                }
            });
            
            if (posOK) analisi.posizioniComplete++;
        });
        
        return analisi;
    },
    
    /**
     * Verifica se BRM è presente e valido
     */
    verificaBRM(prodotto, tipo) {
        if (tipo === 'cassonetto') {
            // Cassonetto serve solo L
            return prodotto.brm && prodotto.brm.L && prodotto.brm.L > 0;
        } else {
            // Altri prodotti servono L e H
            return prodotto.brm && 
                   prodotto.brm.L && prodotto.brm.L > 0 &&
                   prodotto.brm.H && prodotto.brm.H > 0;
        }
    },
    
    /**
     * Verifica attributi specifici per tipo prodotto
     */
    verificaAttributi(prodotto, tipo) {
        const mancanti = [];
        
        switch(tipo) {
            case 'persiana':
                if (!prodotto.telaio) mancanti.push({campo: 'telaio', label: 'Tipo Telaio'});
                if (!prodotto.colore) mancanti.push({campo: 'colore', label: 'Colore'});
                break;
            
            case 'zanzariera':
                if (!prodotto.modello && !prodotto.tipo) mancanti.push({campo: 'modello', label: 'Modello'});
                break;
            
            case 'infisso':
                if (!prodotto.tipo) mancanti.push({campo: 'tipo', label: 'Tipo Infisso'});
                if (!prodotto.azienda) mancanti.push({campo: 'azienda', label: 'Azienda/Fornitore'});
                break;
        }
        
        return mancanti;
    },
    
    /**
     * Apre il wizard multi-step
     */
    apriWizard() {
        console.log('🧙 Apertura wizard completamento dati...');
        this.stepCorrente = 0;
        this.renderWizard();
    },
    
    /**
     * Render wizard container
     */
    renderWizard() {
        const html = `
            <div class="wizard-overlay" id="wizard-preventivo" onclick="if(event.target===this) WizardCompletamento.chiudiWizard()">
                <div class="wizard-container">
                    <div id="wizard-content"></div>
                </div>
            </div>
        `;
        
        const container = document.createElement('div');
        container.innerHTML = html;
        document.body.appendChild(container.firstElementChild);
        
        this.renderStepCorrente();
    },
    
    /**
     * Render step corrente
     */
    renderStepCorrente() {
        const content = document.getElementById('wizard-content');
        if (!content) return;
        
        switch(this.stepCorrente) {
            case 0:
                content.innerHTML = this.renderStepAnalisi();
                break;
            case 1:
                content.innerHTML = this.renderStepConfiguraMisure();
                break;
            case 2:
                content.innerHTML = this.renderStepAttributi();
                break;
            case 3:
                content.innerHTML = this.renderStepRiepilogo();
                break;
        }
    },
    
    /**
     * STEP 1: Analisi
     */
    renderStepAnalisi() {
        const a = this.analisi;
        
        return `
            <div class="wizard-header">
                <h2 class="wizard-title">🔍 Analisi Progetto</h2>
                <button class="wizard-close" onclick="WizardCompletamento.chiudiWizard()">✕</button>
            </div>
            
            <div class="wizard-body">
                <div class="wizard-info-box">
                    <div class="wizard-info-row">
                        <span class="wizard-info-label">Progetto:</span>
                        <span class="wizard-info-value">${this.datiProgetto.nome || 'Senza nome'}</span>
                    </div>
                    <div class="wizard-info-row">
                        <span class="wizard-info-label">Posizioni totali:</span>
                        <span class="wizard-info-value">${a.posizioniTotali}</span>
                    </div>
                </div>
                
                <div class="wizard-analysis">
                    ${a.posizioniComplete > 0 ? `
                    <div class="wizard-stat success">
                        <div class="wizard-stat-icon">✅</div>
                        <div class="wizard-stat-text">
                            ${a.posizioniComplete} posizioni hanno dati completi
                        </div>
                    </div>
                    ` : ''}
                    
                    ${a.problemi.misureBRM.length > 0 ? `
                    <div class="wizard-stat warning">
                        <div class="wizard-stat-icon">⚠️</div>
                        <div class="wizard-stat-text">
                            ${a.problemi.misureBRM.length} posizioni mancano misure BRM
                        </div>
                    </div>
                    ` : ''}
                    
                    ${a.problemi.attributi.length > 0 ? `
                    <div class="wizard-stat warning">
                        <div class="wizard-stat-icon">⚠️</div>
                        <div class="wizard-stat-text">
                            ${a.problemi.attributi.length} posizioni mancano attributi
                        </div>
                    </div>
                    ` : ''}
                </div>
                
                <div class="wizard-message">
                    <p>Il wizard ti guiderà nella configurazione dei dati mancanti.</p>
                    <p><strong>Configurazione globale:</strong> Imposti i parametri UNA VOLTA e si applicano a tutte le posizioni.</p>
                </div>
            </div>
            
            <div class="wizard-footer">
                <button class="wizard-btn wizard-btn-secondary" onclick="WizardCompletamento.chiudiWizard()">
                    ← Annulla
                </button>
                <button class="wizard-btn wizard-btn-primary" onclick="WizardCompletamento.avanti()">
                    Continua →
                </button>
            </div>
        `;
    },
    
    /**
     * STEP 2: Configurazione Misure BRM Globale
     */
    renderStepConfiguraMisure() {
        const problemi = this.analisi.problemi.misureBRM;
        
        if (problemi.length === 0) {
            // Salta questo step
            this.stepCorrente++;
            return this.renderStepCorrente();
        }
        
        // Trova misure disponibili (esempio dalla prima posizione)
        const primaPosConMisure = problemi[0];
        const misureDisp = primaPosConMisure.misureDisponibili || {};
        
        return `
            <div class="wizard-header">
                <h2 class="wizard-title">⚙️ Configurazione Misure BRM</h2>
                <p class="wizard-subtitle">Si applica a TUTTE le ${problemi.length} posizioni mancanti</p>
                <button class="wizard-close" onclick="WizardCompletamento.chiudiWizard()">✕</button>
            </div>
            
            <div class="wizard-body">
                <div class="wizard-section">
                    <h3 class="wizard-section-title">Posizioni da configurare:</h3>
                    <ul class="wizard-list">
                        ${problemi.map(p => `
                            <li>• ${p.posizione} (${p.tipo.charAt(0).toUpperCase() + p.tipo.slice(1)})</li>
                        `).join('')}
                    </ul>
                </div>
                
                <div class="wizard-section">
                    <h3 class="wizard-section-title">Misure disponibili nel rilievo:</h3>
                    <div class="wizard-misure-disponibili">
                        ${Object.keys(misureDisp).length > 0 ? Object.keys(misureDisp).map(key => `
                            <div class="wizard-misura-badge">✓ ${key}</div>
                        `).join('') : '<div class="wizard-warning-text">Nessuna misura trovata nel rilievo</div>'}
                    </div>
                </div>
                
                <div class="wizard-section">
                    <h3 class="wizard-section-title">Quale misura vuoi usare come riferimento?</h3>
                    <div class="wizard-radio-group">
                        <label class="wizard-radio">
                            <input type="radio" name="misura-riferimento" value="LF" checked>
                            <span class="wizard-radio-label">Luce Foro (LF)</span>
                        </label>
                        <label class="wizard-radio">
                            <input type="radio" name="misura-riferimento" value="FM">
                            <span class="wizard-radio-label">Foro Muro (FM)</span>
                        </label>
                        <label class="wizard-radio">
                            <input type="radio" name="misura-riferimento" value="MT">
                            <span class="wizard-radio-label">Misura Telaio (MT)</span>
                        </label>
                        <label class="wizard-radio">
                            <input type="radio" name="misura-riferimento" value="manuale">
                            <span class="wizard-radio-label">Inserimento manuale</span>
                        </label>
                    </div>
                </div>
                
                <div class="wizard-section">
                    <h3 class="wizard-section-title">Correzioni da applicare:</h3>
                    <div class="wizard-corrections">
                        <div class="wizard-correction-item">
                            <label class="wizard-label">Larghezza:</label>
                            <div class="wizard-input-group">
                                <button class="wizard-btn-mini" onclick="this.nextElementSibling.value = '+'; this.nextElementSibling.nextElementSibling.nextElementSibling.value = '+'">+</button>
                                <input type="text" id="correzione-segno-L" value="+" style="width: 40px; text-align: center" readonly>
                                <input type="number" id="correzione-valore-L" value="20" style="width: 80px">
                                <button class="wizard-btn-mini" onclick="document.getElementById('correzione-segno-L').value = '-'; document.getElementById('correzione-valore-L').value = Math.abs(parseInt(document.getElementById('correzione-valore-L').value) || 0)">-</button>
                                <span class="wizard-unit">mm</span>
                            </div>
                        </div>
                        <div class="wizard-correction-item">
                            <label class="wizard-label">Altezza:</label>
                            <div class="wizard-input-group">
                                <button class="wizard-btn-mini" onclick="this.nextElementSibling.value = '+'; this.nextElementSibling.nextElementSibling.nextElementSibling.value = '+'">+</button>
                                <input type="text" id="correzione-segno-H" value="-" style="width: 40px; text-align: center" readonly>
                                <input type="number" id="correzione-valore-H" value="10" style="width: 80px">
                                <button class="wizard-btn-mini" onclick="document.getElementById('correzione-segno-H').value = '-'; document.getElementById('correzione-valore-H').value = Math.abs(parseInt(document.getElementById('correzione-valore-H').value) || 0)">-</button>
                                <span class="wizard-unit">mm</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="wizard-example">
                        💡 Esempio: Se LF=1200mm, con +20mm → BRM=1220mm
                    </div>
                </div>
                
                <div class="wizard-section">
                    <h3 class="wizard-section-title">📋 Anteprima applicazione:</h3>
                    <div class="wizard-preview" id="preview-misure">
                        <div class="wizard-loading">Seleziona parametri sopra...</div>
                    </div>
                </div>
            </div>
            
            <div class="wizard-footer">
                <button class="wizard-btn wizard-btn-secondary" onclick="WizardCompletamento.indietro()">
                    ← Indietro
                </button>
                <button class="wizard-btn wizard-btn-primary" onclick="WizardCompletamento.applicaMisure()">
                    Applica a Tutte →
                </button>
            </div>
        `;
    },
    
    /**
     * STEP 3: Attributi prodotti (placeholder - da espandere)
     */
    renderStepAttributi() {
        const problemi = this.analisi.problemi.attributi;
        
        if (problemi.length === 0) {
            this.stepCorrente++;
            return this.renderStepCorrente();
        }
        
        return `
            <div class="wizard-header">
                <h2 class="wizard-title">🎨 Completa Attributi Prodotti</h2>
                <button class="wizard-close" onclick="WizardCompletamento.chiudiWizard()">✕</button>
            </div>
            
            <div class="wizard-body">
                <div class="wizard-message">
                    <p>Trovati ${problemi.length} prodotti con attributi mancanti.</p>
                    <p><em>Funzionalità in sviluppo - per ora usa valori default</em></p>
                </div>
            </div>
            
            <div class="wizard-footer">
                <button class="wizard-btn wizard-btn-secondary" onclick="WizardCompletamento.indietro()">
                    ← Indietro
                </button>
                <button class="wizard-btn wizard-btn-primary" onclick="WizardCompletamento.avanti()">
                    Salta →
                </button>
            </div>
        `;
    },
    
    /**
     * STEP 4: Riepilogo
     */
    renderStepRiepilogo() {
        return `
            <div class="wizard-header">
                <h2 class="wizard-title">📊 Riepilogo Configurazione</h2>
                <button class="wizard-close" onclick="WizardCompletamento.chiudiWizard()">✕</button>
            </div>
            
            <div class="wizard-body">
                <div class="wizard-summary">
                    <div class="wizard-summary-item success">
                        <div class="wizard-summary-icon">✅</div>
                        <div class="wizard-summary-text">
                            <strong>Configurazione completata</strong>
                            <p>Tutti i dati sono stati configurati</p>
                        </div>
                    </div>
                    
                    ${this.configurazioneMisure ? `
                    <div class="wizard-summary-section">
                        <h4>Misure BRM:</h4>
                        <ul>
                            <li>Riferimento: ${this.configurazioneMisure.riferimento}</li>
                            <li>Correzione L: ${this.configurazioneMisure.correzioneL}</li>
                            <li>Correzione H: ${this.configurazioneMisure.correzioneH}</li>
                        </ul>
                    </div>
                    ` : ''}
                </div>
                
                <div class="wizard-message">
                    <p><strong>Pronto per generare il preventivo!</strong></p>
                    <p>Click su "Genera Preventivo" per calcolare i costi.</p>
                </div>
            </div>
            
            <div class="wizard-footer">
                <button class="wizard-btn wizard-btn-secondary" onclick="WizardCompletamento.chiudiWizard()">
                    ← Annulla
                </button>
                <button class="wizard-btn wizard-btn-primary" onclick="WizardCompletamento.generaPreventivo()">
                    📄 Genera Preventivo
                </button>
            </div>
        `;
    },
    
    /**
     * Naviga avanti
     */
    avanti() {
        this.stepCorrente++;
        this.renderStepCorrente();
    },
    
    /**
     * Naviga indietro
     */
    indietro() {
        if (this.stepCorrente > 0) {
            this.stepCorrente--;
            this.renderStepCorrente();
        }
    },
    
    /**
     * Applica configurazione misure
     */
    applicaMisure() {
        const riferimento = document.querySelector('input[name="misura-riferimento"]:checked')?.value || 'LF';
        const segnoL = document.getElementById('correzione-segno-L')?.value || '+';
        const valoreL = parseInt(document.getElementById('correzione-valore-L')?.value || 0);
        const segnoH = document.getElementById('correzione-segno-H')?.value || '+';
        const valoreH = parseInt(document.getElementById('correzione-valore-H')?.value || 0);
        
        this.configurazioneMisure = {
            riferimento: riferimento,
            correzioneL: `${segnoL}${valoreL}mm`,
            correzioneH: `${segnoH}${valoreH}mm`
        };
        
        console.log('✅ Configurazione misure salvata:', this.configurazioneMisure);
        
        // Applica alle posizioni
        this.applicaMisureAiDati();
        
        // Vai avanti
        this.avanti();
    },
    
    /**
     * Applica misure configurate ai dati progetto
     */
    applicaMisureAiDati() {
        const problemi = this.analisi.problemi.misureBRM;
        
        problemi.forEach(problema => {
            const pos = this.datiProgetto.posizioni[problema.posizioneIdx];
            const prodotto = pos[problema.tipo];
            
            // Se già ha BRM, salta
            if (this.verificaBRM(prodotto, problema.tipo)) return;
            
            // Inizializza BRM se non esiste
            if (!prodotto.brm) prodotto.brm = {};
            
            // Calcola BRM da misure disponibili
            const misure = problema.misureDisponibili;
            const rif = this.configurazioneMisure.riferimento;
            
            // Prova a trovare la misura di riferimento
            let misuraBase = misure[rif] || misure['LF'] || misure['FM'] || misure['luce_foro'];
            
            if (misuraBase) {
                // Applica correzioni
                const correzioneL = parseInt(this.configurazioneMisure.correzioneL.replace(/[^0-9-]/g, ''));
                const correzioneH = parseInt(this.configurazioneMisure.correzioneH.replace(/[^0-9-]/g, ''));
                
                prodotto.brm.L = (misuraBase.L || 0) + correzioneL;
                prodotto.brm.H = (misuraBase.H || 0) + correzioneH;
                
                console.log(`✅ BRM applicato a ${problema.posizione}: ${prodotto.brm.L}×${prodotto.brm.H}`);
            } else {
                // 🔧 v8.10: NON usare valori di default - lascia null per non mostrare dati falsi
                console.warn(`⚠️ Nessuna misura trovata per ${problema.posizione}, BRM non calcolabile`);
            }
        });
    },
    
    /**
     * Genera preventivo finale
     */
    generaPreventivo() {
        console.log('📊 Generazione preventivo con dati completati...');
        
        // Chiudi wizard
        this.chiudiWizard();
        
        // Apri preventivo con dati aggiornati
        setTimeout(() => {
            window.PreventivoUI.apriModalPreventivo();
        }, 300);
    },
    
    /**
     * Chiudi wizard
     */
    chiudiWizard() {
        const wizard = document.getElementById('wizard-preventivo');
        if (wizard) {
            wizard.remove();
        }
    }
};

console.log('🧙 WizardCompletamento loaded');
    
// Listino Finstral inline (opzionale - rimosso caricamento fetch)
// TODO: Integrare listino se necessario

// Init completion tracker quando dati disponibili
if (window.currentData) {
    console.log('🚀 Initializing completion tracker...');
    CompletionTracker.updateMenuStatus(menuStructure, window.currentData);
    renderAdvancedMenu();
}


// 🆕 v8.40: Apre modal scelta documento
window.apriSceltaDocumento = function() {
    console.log('📄 apriSceltaDocumento v8.40');
    
    if (!window.currentData) {
        alert('⚠️ Nessun progetto caricato. Carica prima un rilievo.');
        return;
    }
    
    // Reset a Step 1
    document.getElementById('stepSceltaTipo').style.display = 'block';
    document.getElementById('stepDatiCliente').style.display = 'none';
    document.getElementById('footerDatiCliente').style.display = 'none';
    document.getElementById('titoloModalDocumento').textContent = '📄 Genera Documento';
    
    // Mostra modal
    var modal = document.getElementById('modalDatiCliente');
    if (modal) {
        modal.style.display = 'flex';
        console.log('✅ Modal scelta documento aperto');
    }
};

// 🆕 v8.40: Seleziona tipo e passa a Step 2
window.selezionaTipoDocumento = function(tipo) {
    console.log('📄 Tipo selezionato:', tipo);
    
    // Salva tipo
    document.getElementById('tipoDocumentoCliente').value = tipo;
    
    // Nascondi Step 1, mostra Step 2
    document.getElementById('stepSceltaTipo').style.display = 'none';
    document.getElementById('stepDatiCliente').style.display = 'block';
    document.getElementById('footerDatiCliente').style.display = 'flex';
    
    // Aggiorna titolo e badge
    var titoli = {
        'preventivo_semplice': { titolo: '📋 Preventivo Semplice', badge: '📋 Preventivo Semplice', bg: '#8b5cf6', color: 'white' },
        'preventivo_premium': { titolo: '⭐ Preventivo Premium', badge: '⭐ Preventivo Premium', bg: '#f59e0b', color: 'white' },
        'conferma_premium': { titolo: '✅ Conferma Ordine', badge: '✅ Conferma Ordine Premium', bg: '#10b981', color: 'white' }
    };
    
    var config = titoli[tipo] || titoli['preventivo_semplice'];
    document.getElementById('titoloModalDocumento').textContent = config.titolo;
    
    var badge = document.getElementById('badgeTipoSelezionato');
    badge.textContent = config.badge;
    badge.style.background = config.bg;
    badge.style.color = config.color;
    
    // Mostra/nascondi sezione acconto (solo conferma)
    var sezioneAcconto = document.getElementById('sezioneAccontoConferma');
    if (sezioneAcconto) {
        sezioneAcconto.style.display = tipo === 'conferma_premium' ? 'block' : 'none';
    }
    
    // Precompila campi
    precompilaFormDatiCliente(tipo);
};

// 🆕 v8.40: Torna a Step 1
window.tornaSceltaTipo = function() {
    document.getElementById('stepSceltaTipo').style.display = 'block';
    document.getElementById('stepDatiCliente').style.display = 'none';
    document.getElementById('footerDatiCliente').style.display = 'none';
    document.getElementById('titoloModalDocumento').textContent = '📄 Genera Documento';
};

// Precompila form
function precompilaFormDatiCliente(tipo) {
    // ═══ v8.502: LEGGI DATI DA TUTTE LE FONTI POSSIBILI ═══
    
    var progetto = window.currentData || window.projectData;
    console.log('📋 Precompila dati cliente...');
    
    // 🔗 v8.502: Supporto formato Odoo
    var odooCustomer = progetto ? (progetto.odoo_customer || {}) : {};
    var cliente = progetto ? (progetto.cliente || {}) : {};
    var clientData = progetto ? (progetto.clientData || {}) : {};
    
    // ═══ NOME CLIENTE ═══
    // Priorità: cliente.nome > odoo_customer.name > clientData.nome > project.name > UI
    var nomeCliente = '';
    if (cliente.nome) {
        nomeCliente = cliente.nome;
    } else if (odooCustomer.name) {
        nomeCliente = odooCustomer.name;
    } else if (clientData.nome) {
        nomeCliente = clientData.nome;
    } else if (progetto && progetto.name) {
        nomeCliente = progetto.name;
    } else if (progetto && progetto.client) {
        nomeCliente = progetto.client;
    } else if (progetto && progetto.customerName) {
        nomeCliente = progetto.customerName;
    }
    
    // Fallback: leggi da UI se disponibile
    if (!nomeCliente) {
        var clienteDisplay = document.getElementById('projectClientDisplay');
        nomeCliente = clienteDisplay ? clienteDisplay.textContent.replace('👤 ', '').trim() : '';
        if (nomeCliente === 'Cliente Non Specificato') nomeCliente = '';
    }
    
    // ═══ TELEFONO ═══
    var telefono = cliente.telefono || odooCustomer.phone || odooCustomer.mobile || clientData.telefono || '';
    
    // ═══ EMAIL ═══
    var email = cliente.email || odooCustomer.email || clientData.email || '';
    
    // ═══ INDIRIZZO ═══
    var via = cliente.indirizzo || cliente.via || odooCustomer.street || clientData.indirizzo || progetto?.indirizzo || '';
    var citta = cliente.citta || cliente.città || odooCustomer.city || clientData.citta || progetto?.citta || '';
    var cap = cliente.cap || odooCustomer.zip || clientData.cap || '';
    
    var indirizzo = via;
    if (citta && indirizzo.indexOf(citta) < 0) {
        indirizzo += (cap ? ', ' + cap : '') + ' ' + citta;
    }
    
    // ═══ CODICE FISCALE / P.IVA ═══
    var cf = cliente.cf || cliente.codiceFiscale || cliente.piva || 
             odooCustomer.vat || clientData.cf || '';
    
    // ═══ OGGETTO ═══
    var progettoDisplay = document.getElementById('projectNameDisplay');
    var oggetto = progettoDisplay ? progettoDisplay.textContent.trim() : '';
    if (!oggetto || oggetto === 'Nome Progetto') {
        oggetto = progetto?.nome_ricerca || progetto?.name || 'Fornitura e posa serramenti';
    }
    
    // ═══ COMPILA I CAMPI ═══
    document.getElementById('clienteNome').value = nomeCliente;
    document.getElementById('clienteTelefono').value = telefono;
    document.getElementById('clienteEmail').value = email;
    document.getElementById('clienteIndirizzo').value = indirizzo;
    document.getElementById('clienteCF').value = cf;
    document.getElementById('docOggetto').value = oggetto;
    
    // 🆕 v8.510: Nuovi campi ENEA
    var immobile = progetto ? (progetto.immobile || {}) : {};
    var comune = cliente.comune || immobile.comune || clientData.comune || citta || '';
    var provincia = cliente.provincia || immobile.provincia || clientData.provincia || '';
    var capSeparato = cliente.cap || immobile.cap || clientData.cap || cap || '';
    var zonaClimatica = immobile.zonaClimatica || cliente.zonaClimatica || '';
    var tipoDetrazione = immobile.tipoDetrazione || cliente.tipoDetrazione || '';
    
    if (document.getElementById('clienteComune')) document.getElementById('clienteComune').value = comune;
    if (document.getElementById('clienteProvincia')) document.getElementById('clienteProvincia').value = provincia;
    if (document.getElementById('clienteCAP')) document.getElementById('clienteCAP').value = capSeparato;
    if (document.getElementById('clienteZonaClimatica')) document.getElementById('clienteZonaClimatica').value = zonaClimatica;
    if (document.getElementById('clienteDetrazione')) document.getElementById('clienteDetrazione').value = tipoDetrazione;
    
    // Data odierna
    document.getElementById('docData').value = new Date().toISOString().split('T')[0];
    
    // Numero documento
    var anno = new Date().getFullYear();
    var prefisso = tipo === 'conferma_premium' ? 'ORD-' : 'PREV-';
    document.getElementById('docNumero').value = prefisso + anno + '/';
    
    console.log('✅ Precompilato:', { nome: nomeCliente, telefono, email, indirizzo, cf, comune, provincia, zonaClimatica, tipoDetrazione });
}

window.chiudiModalDatiCliente = function() {
    var modal = document.getElementById('modalDatiCliente');
    if (modal) modal.style.display = 'none';
};

function resetFormDatiCliente() {
    var campi = ['clienteNome', 'clienteTelefono', 'clienteIndirizzo', 'clienteEmail', 'clienteCF', 
                 'clienteComune', 'clienteProvincia', 'clienteCAP', 'clienteZonaClimatica', 'clienteDetrazione',
                 'docNumero', 'docOggetto', 'docNote'];
    campi.forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.value = '';
    });
}

window.generaDocumentoFinale = function() {
    var tipo = document.getElementById('tipoDocumentoCliente').value;
    console.log('📄 generaDocumentoFinale:', tipo);
    
    // v8.491: Lista placeholder da ignorare (non trascrivere nel PDF)
    var placeholdersDaIgnorare = [
        'Mario Rossi', 'Cliente', '333 1234567', 'mario@email.it', 
        'RSSMRA80A01B157K', 'Via Roma 1, Bergamo', '2025/001',
        'Sostituzione serramenti appartamento', 'Eventuali note...'
    ];
    
    // Funzione helper: restituisce valore solo se NON è un placeholder
    function getValorePulito(id, fallback) {
        var el = document.getElementById(id);
        if (!el) return fallback || '';
        var val = el.value.trim();
        // Se è vuoto o è un placeholder → restituisci fallback (o stringa vuota)
        if (!val || placeholdersDaIgnorare.indexOf(val) >= 0) {
            return fallback || '';
        }
        return val;
    }
    
    // Raccogli dati form (escludendo placeholder)
    var datiCliente = {
        nome: getValorePulito('clienteNome', ''),
        indirizzo: getValorePulito('clienteIndirizzo', ''),
        telefono: getValorePulito('clienteTelefono', ''),
        email: getValorePulito('clienteEmail', ''),
        cf: getValorePulito('clienteCF', '')
    };
    
    var datiDoc = {
        numero: getValorePulito('docNumero', ''),
        data: document.getElementById('docData').value || new Date().toISOString().split('T')[0],
        oggetto: getValorePulito('docOggetto', 'Fornitura e posa serramenti'),
        note: getValorePulito('docNote', ''),
        accontoPct: parseFloat(document.getElementById('accontoPct') ? document.getElementById('accontoPct').value : 30) || 30,
        tempiConsegna: document.getElementById('tempiConsegna') ? document.getElementById('tempiConsegna').value : '6-8 settimane'
    };
    
    // v8.491: Raccogli ENEA e voci extra DIRETTAMENTE DAL DOM (più affidabile)
    var eneaChecked = document.getElementById('checkENEA') ? document.getElementById('checkENEA').checked : false;
    var eneaValore = parseFloat(document.getElementById('inputENEA') ? document.getElementById('inputENEA').value : 0) || 0;
    
    var voce1Checked = document.getElementById('checkVoceExtra1') ? document.getElementById('checkVoceExtra1').checked : false;
    var voce1Nome = document.getElementById('inputNomeVoceExtra1') ? document.getElementById('inputNomeVoceExtra1').value : '';
    var voce1Valore = parseFloat(document.getElementById('inputVoceExtra1') ? document.getElementById('inputVoceExtra1').value : 0) || 0;
    var voce1IVA = parseInt(document.getElementById('selectIVAVoceExtra1') ? document.getElementById('selectIVAVoceExtra1').value : 22) || 22;
    
    var voce2Checked = document.getElementById('checkVoceExtra2') ? document.getElementById('checkVoceExtra2').checked : false;
    var voce2Nome = document.getElementById('inputNomeVoceExtra2') ? document.getElementById('inputNomeVoceExtra2').value : '';
    var voce2Valore = parseFloat(document.getElementById('inputVoceExtra2') ? document.getElementById('inputVoceExtra2').value : 0) || 0;
    var voce2IVA = parseInt(document.getElementById('selectIVAVoceExtra2') ? document.getElementById('selectIVAVoceExtra2').value : 22) || 22;
    
    console.log('📝 Voci Extra lette dal DOM:', {
        enea: { valore: eneaValore, checked: eneaChecked },
        voce1: { nome: voce1Nome, valore: voce1Valore, iva: voce1IVA, checked: voce1Checked },
        voce2: { nome: voce2Nome, valore: voce2Valore, iva: voce2IVA, checked: voce2Checked }
    });
    
    // ═══ RACCOGLI TOTALI DAL DOM (ID CORRETTI) ═══
    var totali = {
        materiali: document.getElementById('totaleCliente') ? document.getElementById('totaleCliente').textContent : '€ 0.00',
        lavori: document.getElementById('totaleLavoriCliente') ? document.getElementById('totaleLavoriCliente').textContent : '€ 0.00',
        subtotale: document.getElementById('subtotaleCliente') ? document.getElementById('subtotaleCliente').textContent : '€ 0.00',
        imponibile10: document.getElementById('valImponibile10') ? document.getElementById('valImponibile10').textContent : '',
        imponibile22: document.getElementById('valImponibile22') ? document.getElementById('valImponibile22').textContent : '',
        iva10: document.getElementById('valIVA10') ? document.getElementById('valIVA10').textContent : '',
        iva22: document.getElementById('valIVA22') ? document.getElementById('valIVA22').textContent : '',
        totaleFinale: document.getElementById('grandTotalCliente') ? document.getElementById('grandTotalCliente').textContent : '€ 0.00',
        tipoIntervento: document.getElementById('tipoInterventoSelect') ? document.getElementById('tipoInterventoSelect').value : 'manutenzione',
        // v8.491: ENEA e Voci Extra (lette dal DOM)
        enea: { valore: eneaValore, checked: eneaChecked },
        voceExtra1: { nome: voce1Nome, valore: voce1Valore, iva: voce1IVA, checked: voce1Checked },
        voceExtra2: { nome: voce2Nome, valore: voce2Valore, iva: voce2IVA, checked: voce2Checked }
    };
    
    console.log('📊 Totali letti dal DOM:', totali);
    console.log('📋 Righe preventivo:', window.righePreventivo ? window.righePreventivo.length : 0);
    
    // Genera HTML in base al tipo
    var righe = window.righePreventivo || [];
    var htmlDoc;
    
    if (tipo === 'preventivo_premium' || tipo === 'conferma_premium') {
        htmlDoc = generaDocumentoPremium(tipo, datiCliente, datiDoc, righe, totali);
    } else {
        htmlDoc = generaHTMLDocumentoStampa('preventivo', datiCliente, datiDoc, righe, totali);
    }
    
    // Apri in nuova finestra
    var win = window.open('', '_blank');
    win.document.write(htmlDoc);
    win.document.close();
    
    // Chiudi modal
    window.chiudiModalDatiCliente();
    console.log('✅ Documento generato:', tipo);
};

// Compatibilità con vecchie chiamate
window.generaDocumentoCliente = function(tipo) {
    window.apriSceltaDocumento();
};


// ============================================================================
// 🆕 v8.504: WIZARD NUOVA POSIZIONE
// ============================================================================

/**
 * Mostra notifica toast (se non esiste la funzione)
 */
if (typeof showNotification === 'undefined') {
    window.showNotification = function(message, type = 'info') {
        // Crea container se non esiste
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            container.style.cssText = 'position: fixed; top: 1rem; right: 1rem; z-index: 9999; display: flex; flex-direction: column; gap: 0.5rem;';
            document.body.appendChild(container);
        }
        
        // Crea notifica
        const notification = document.createElement('div');
        const colors = {
            success: { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
            error: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' },
            warning: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
            info: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' }
        };
        const color = colors[type] || colors.info;
        
        notification.style.cssText = `
            padding: 1rem 1.5rem;
            background: ${color.bg};
            border-left: 4px solid ${color.border};
            color: ${color.text};
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            font-weight: 500;
            animation: slideIn 0.3s ease-out;
            max-width: 350px;
        `;
        notification.textContent = message;
        
        // Aggiungi stile animazione
        if (!document.getElementById('notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = '@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }';
            document.head.appendChild(style);
        }
        
        container.appendChild(notification);
        
        // Rimuovi dopo 4 secondi
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            notification.style.transition = 'all 0.3s';
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    };
}

/**
 * Apre il wizard per aggiungere una nuova posizione
 */
window.apriWizardNuovaPosizione = function() {
    // Verifica che ci sia un progetto caricato
    const project = window.currentData || window.projectData;
    
    if (!project) {
        alert('⚠️ Nessun progetto caricato. Carica prima un progetto.');
        return;
    }
    
    // Verifica che il modulo sia disponibile
    if (typeof POSITION_WIZARD === 'undefined') {
        alert('⚠️ Modulo Position Wizard non caricato. Ricarica la pagina.');
        console.error('POSITION_WIZARD non definito');
        return;
    }
    
    // Apri wizard con callback
    POSITION_WIZARD.open(project, {
        onSave: async function(positions) {
            console.log('📍 Posizioni create:', positions);
            
            // Aggiungi posizioni al progetto
            if (!project.positions) project.positions = [];
            if (!project.posizioni) project.posizioni = [];
            
            positions.forEach(pos => {
                project.positions.push(pos);
                project.posizioni.push(pos);
                
                // 🆕 Aggiorna anche allPositionsData e filteredPositions per refresh sidebar
                if (typeof allPositionsData !== 'undefined') {
                    allPositionsData.push(pos);
                }
                if (typeof filteredPositions !== 'undefined') {
                    filteredPositions.push(pos);
                }
            });
            
            // Aggiorna flag prodotti
            if (!project.prodotti) project.prodotti = {};
            positions.forEach(pos => {
                if (pos.infisso) project.prodotti.infissi = true;
                if (pos.persiana) project.prodotti.persiane = true;
                if (pos.tapparella) project.prodotti.tapparelle = true;
                if (pos.zanzariera) project.prodotti.zanzariere = true;
                if (pos.cassonetto) project.prodotti.cassonetti = true;
            });
            
            // Aggiorna window.currentData
            window.currentData = project;
            
            // 🆕 v8.508: Normalizza dati
            window.currentData = normalizzaProgettoCompleto(window.currentData);
            
            // ✅ v8.58: Ricarica sconti dal progetto aggiornato
            if (typeof SCONTI_FORNITORI !== 'undefined') SCONTI_FORNITORI.loadFromProject();
            
            // Salva su GitHub se connesso
            if (window.githubConfig && window.githubConfig.token) {
                try {
                    showNotification('💾 Salvataggio su GitHub...', 'info');
                    
                    const filename = `progetti/progetto-${project.id}.json`;
                    const url = `https://api.github.com/repos/${window.githubConfig.owner}/${window.githubConfig.repo}/contents/${filename}`;
                    
                    // Prima ottieni SHA attuale
                    const getResponse = await fetch(url, {
                        headers: {
                            'Authorization': `token ${window.githubConfig.token}`,
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    });
                    
                    let sha = null;
                    if (getResponse.ok) {
                        const fileData = await getResponse.json();
                        sha = fileData.sha;
                    }
                    
                    // Salva
                    const content = btoa(unescape(encodeURIComponent(JSON.stringify(project, null, 2))));
                    const saveResponse = await fetch(url, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `token ${window.githubConfig.token}`,
                            'Accept': 'application/vnd.github.v3+json',
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            message: `Aggiunte ${positions.length} posizioni da Dashboard`,
                            content: content,
                            sha: sha
                        })
                    });
                    
                    if (saveResponse.ok) {
                        showNotification(`✅ ${positions.length} posizioni aggiunte e salvate!`, 'success');
                    } else {
                        throw new Error('Errore salvataggio GitHub');
                    }
                } catch (error) {
                    console.error('Errore salvataggio:', error);
                    showNotification('⚠️ Posizioni create ma non salvate su GitHub', 'warning');
                }
            } else {
                showNotification(`✅ ${positions.length} posizioni aggiunte (solo locale)`, 'success');
            }
            
            // 🆕 Refresh UI - aggiorna lista posizioni nella sidebar
            // Aggiorna variabili globali con i nuovi dati
            allPositionsData = project.posizioni || project.positions || [];
            filteredPositions = [...allPositionsData];
            
            // Render lista posizioni
            if (typeof renderPositionsList === 'function') {
                renderPositionsList();
            }
            
            // Render dettaglio ultima posizione aggiunta
            if (typeof renderPositionDetail === 'function' && positions.length > 0) {
                currentPositionIndex = allPositionsData.length - 1;
                renderPositionDetail(currentPositionIndex);
            }
            
            if (typeof populatePosizioniView === 'function') {
                populatePosizioniView(project);
            }
            if (typeof updateVistaGenerale === 'function') {
                updateVistaGenerale(project);
            }
            
            // Aggiorna anche il conteggio posizioni nell'header
            const countDisplay = document.getElementById('projectPositionsCountDisplay');
            if (countDisplay) {
                countDisplay.textContent = `📍 ${project.positions.length} posizioni`;
            }
            const countSpan = document.getElementById('positionsCount');
            if (countSpan) {
                countSpan.textContent = `(${project.positions.length})`;
            }
            
            console.log('✅ UI aggiornata - posizioni:', allPositionsData.length);
        },
        onCancel: function() {
            console.log('📍 Wizard annullato');
        }
    });
};

console.log('✅ Wizard Nuova Posizione v8.504 disponibile');
