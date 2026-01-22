// ============================================================================
// STATO APPLICAZIONE
// ============================================================================
let appState = {
    currentBlocco: 'generale',
    rilievoData: null,
    lastImport: null
};

// ============================================================================
// 🔧 FIX v8.497: Funzioni mancanti che causavano errori
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
// NAVIGAZIONE TRA BLOCCHI
// ============================================================================
function switchBlocco(bloccoName) {
    // ✅ FIX: Chiudi modale preventivo se aperta
    chiudiPreventivo();
    
    // Aggiorna stato
    appState.currentBlocco = bloccoName;

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

    const reader = new FileReader();

    reader.onload = function(e) {
        console.log('📖 FileReader onload triggered');
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
                    quantita: pos.quantita || 1,
                    
                    // MISURE
                    misure: pos.misure || {},
                    
                    // PRODOTTI (converti da singular a oggetto con quantità)
                    infisso: pos.infisso ? {
                        quantita: pos.infisso.qta || 1,
                        tipo: pos.infisso.tipo || '',
                        apertura: pos.infisso.apertura || '',
                        azienda: pos.infisso.azienda || '',
                        brm: {
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
                        quantita: parseInt(pos.tapparella.qta) || parseInt(pos.tapparella.quantita) || 1,
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
                        brm: {
                            L: parseInt(pos.tapparella.BRM_L) || parseInt(pos.tapparella.brm?.L) || 0,
                            H: parseInt(pos.tapparella.BRM_H) || parseInt(pos.tapparella.brm?.H) || 0
                        },
                        // 🆕 v7.82: Mantieni riferimenti originali per compatibilità
                        BRM_L: parseInt(pos.tapparella.BRM_L) || parseInt(pos.tapparella.brm?.L) || null,
                        BRM_H: parseInt(pos.tapparella.BRM_H) || parseInt(pos.tapparella.brm?.H) || null,
                        qta: pos.tapparella.qta || pos.tapparella.quantita || '1',
                        // 🆕 v7.995: Nuovi campi struttura motori
                        serveTapparella: pos.tapparella.serveTapparella !== false,
                        serveMotore: pos.tapparella.serveMotore || false,
                        serveAccessori: pos.tapparella.serveAccessori || false,
                        motoreModelloDefault: pos.tapparella.motoreModelloDefault || '',
                        motori: pos.tapparella.motori || []
                    } : null,
                    
                    cassonetto: pos.cassonetto ? {
                        quantita: pos.cassonetto.qta || 1,
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
                        brm: {
                            L: parseInt(pos.cassonetto.BRM_L) || 0,
                            H: parseInt(pos.cassonetto.BRM_H) || parseInt(pos.cassonetto.HCASS) || 0,
                            C: parseInt(pos.cassonetto.BRM_C) || parseInt(pos.cassonetto.C) || 0,
                            B: parseInt(pos.cassonetto.BRM_B) || parseInt(pos.cassonetto.B) || 0
                        }
                    } : null,
                    
                    persiana: pos.persiana && pos.persiana.qta ? {
                        quantita: pos.persiana.qta || 1,
                        azienda: pos.persiana.azienda || '',
                        tipo: pos.persiana.tipo || '',
                        modello: pos.persiana.modello || '',
                        colore: pos.persiana.colorePersiana || pos.persiana.colore || '',
                        fissaggio: pos.persiana.fissaggio || '',
                        accessoriPersiana: pos.persiana.accessoriPersiana || null
                    } : null,
                    
                    zanzariera: pos.zanzariera && pos.zanzariera.qta ? {
                        quantita: pos.zanzariera.qta || 1
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
                    rilievo_cassonetti: pos.rilievoCassonetti || {}
                };
                
                return converted_pos;
            }),
            
            // TOTALI
            totali: {
                n_posizioni: project.positions?.length || 0,
                n_infissi: (project.positions || []).filter(p => p.infisso && p.infisso.qta).length,
                n_tapparelle: (project.positions || []).filter(p => p.tapparella && p.tapparella.qta).length,
                n_cassonetti: (project.positions || []).filter(p => p.cassonetto && p.cassonetto.qta).length,
                n_persiane: (project.positions || []).filter(p => p.persiana && p.persiana.qta).length,
                n_zanzariere: (project.positions || []).filter(p => p.zanzariera && p.zanzariera.qta).length,
                // 🔐 v7.98_04: Conta ingressi da entrambi i formati
                n_ingressi: (project.positions || []).filter(p => p.ingresso || p.blindata || p.portoncino).length,
                n_blindate: (project.positions || []).filter(p => p.ingresso?.tipo === 'blindata' || p.ingresso?.blindata || p.blindata).length,
                n_portoncini: (project.positions || []).filter(p => p.ingresso?.tipo === 'portoncino' || p.ingresso?.portoncino || p.portoncino).length
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
            if (pos.ingresso?.portoncino && !pos.portoncino) {
                console.log(`   🚪 Normalizing pos ${pos.id}: ingresso.portoncino → portoncino`);
                pos.portoncino = pos.ingresso.portoncino;
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
    
    // FORMATO NON RICONOSCIUTO
    console.error('❌ Unknown JSON format');
    console.error('   Expected: "projects" array OR "posizioni" array OR "positions" array');
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
    
    // ✅ CONTROLLO SICUREZZA: Garantisci che posizioni sia un array
    if (!data.posizioni || !Array.isArray(data.posizioni)) {
        console.warn('⚠️ Dati senza campo posizioni valido, inizializzo array vuoto');
        data.posizioni = [];
    }

    // ⚠️ FIX CRITICO: Salva SEMPRE in currentData, indipendentemente dalla validazione
    // Questo permette al wizard di analizzare i dati e completarli
    window.currentData = data;
    console.log('✅ currentData salvato:', window.currentData);
    
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
    
    // ✅ v8.493: Resetta flag per permettere ripristino config al primo render preventivo
    window._configPreventivoCarcato = false;
    
    // Salva nello stato
    appState.rilievoData = data;
    
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
        posizioni: data.posizioni.length
    };

    // Salva in localStorage
    saveToLocalStorage(data, filename);

    // Mostra successo
    showDataStatus(data);
    showAlert('success', `✅ Rilievo caricato con successo: ${data.posizioni.length} posizioni`);

    // Mostra contenuto
    document.getElementById('generalePlaceholder').style.display = 'none';
    document.getElementById('generaleContent').style.display = 'block';

    // Genera dashboard Blocco Generale
    generateKPIDashboard(data);
    populateFilters(data);
    generateTable(data);

    // Genera Vista Generale Blocco Ufficio
    renderVistaGeneraleUfficio(data);
    
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
        if (pos.infisso && pos.infisso.quantita > 0) completatiPos++;
        
        // Persiana
        if (pos.persiana && pos.persiana.quantita > 0) completatiPos++;
        
        // Tapparella
        if (pos.tapparella && pos.tapparella.quantita > 0) completatiPos++;
        
        // Zanzariera
        if (pos.zanzariera && pos.zanzariera.quantita > 0) completatiPos++;
        
        // Cassonetto
        if (pos.cassonetto && pos.cassonetto.quantita > 0) completatiPos++;
        
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
// CALCOLA STATISTICHE
// ============================================================================
function calculateStatistics(data) {
    const posizioni = data.posizioni || [];
    
    let totaleInfissi = 0;
    let totaleTapparelle = 0;
    let totalePersiane = 0;
    let totaleZanzariere = 0;
    let totaleCassonetti = 0;

    const pianiSet = new Set();
    const stanzeSet = new Set();

    posizioni.forEach(pos => {
        // Conta prodotti
        if (pos.infisso && pos.infisso.quantita > 0) {
            totaleInfissi += pos.infisso.quantita;
        }
        if (pos.tapparella && pos.tapparella.quantita > 0) {
            totaleTapparelle += pos.tapparella.quantita;
        }
        if (pos.persiana && pos.persiana.quantita > 0) {
            totalePersiane += pos.persiana.quantita;
        }
        if (pos.zanzariera && pos.zanzariera.quantita > 0) {
            totaleZanzariere += pos.zanzariera.quantita;
        }
        if (pos.cassonetto && pos.cassonetto.quantita > 0) {
            totaleCassonetti += pos.cassonetto.quantita;
        }

        // Raccogli piani e stanze
        if (pos.piano) pianiSet.add(pos.piano);
        if (pos.stanza) stanzeSet.add(pos.stanza);
    });

    const totaleAltri = totalePersiane + totaleZanzariere + totaleCassonetti;
    const totaleProdotti = totaleInfissi + totaleTapparelle + totaleAltri;

    return {
        totalePosizioni: posizioni.length,
        totaleInfissi,
        totaleTapparelle,
        totalePersiane,
        totaleZanzariere,
        totaleCassonetti,
        totaleAltri,
        totaleProdotti,
        percentualeInfissi: totaleProdotti > 0 ? Math.round((totaleInfissi / totaleProdotti) * 100) : 0,
        percentualeTapparelle: totaleProdotti > 0 ? Math.round((totaleTapparelle / totaleProdotti) * 100) : 0,
        numeroPiani: pianiSet.size,
        numeroStanze: stanzeSet.size,
        completamento: 100 // TODO: calcolare in base a campi compilati
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
        if (pos.infisso && pos.infisso.quantita > 0) prodottiSet.add('Infisso');
        if (pos.tapparella && pos.tapparella.quantita > 0) prodottiSet.add('Tapparella');
        if (pos.persiana && pos.persiana.quantita > 0) prodottiSet.add('Persiana');
        if (pos.zanzariera && pos.zanzariera.quantita > 0) prodottiSet.add('Zanzariera');
        if (pos.cassonetto && pos.cassonetto.quantita > 0) prodottiSet.add('Cassonetto');
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
        // Raccogli prodotti
        const prodotti = [];
        if (pos.infisso && pos.infisso.quantita > 0) {
            prodotti.push(`<span class="product-badge infisso">Infisso x${pos.infisso.quantita}</span>`);
        }
        if (pos.tapparella && pos.tapparella.quantita > 0) {
            prodotti.push(`<span class="product-badge tapparella">Tapparella x${pos.tapparella.quantita}</span>`);
        }
        if (pos.persiana && pos.persiana.quantita > 0) {
            prodotti.push(`<span class="product-badge persiana">Persiana x${pos.persiana.quantita}</span>`);
        }
        if (pos.zanzariera && pos.zanzariera.quantita > 0) {
            prodotti.push(`<span class="product-badge zanzariera">Zanzariera x${pos.zanzariera.quantita}</span>`);
        }
        if (pos.cassonetto && pos.cassonetto.quantita > 0) {
            prodotti.push(`<span class="product-badge cassonetto">Cassonetto x${pos.cassonetto.quantita}</span>`);
        }

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
                <td>${pos.quantita || 1}</td>
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
                (filterProdotto === 'Infisso' && pos.infisso && pos.infisso.quantita > 0) ||
                (filterProdotto === 'Tapparella' && pos.tapparella && pos.tapparella.quantita > 0) ||
                (filterProdotto === 'Persiana' && pos.persiana && pos.persiana.quantita > 0) ||
                (filterProdotto === 'Zanzariera' && pos.zanzariera && pos.zanzariera.quantita > 0) ||
                (filterProdotto === 'Cassonetto' && pos.cassonetto && pos.cassonetto.quantita > 0);
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
        ['Totale Infissi', posizioni.filter(p => p.infisso && p.infisso.quantita > 0).reduce((sum, p) => sum + (parseInt(p.infisso.quantita) || 0), 0)],
        ['Totale Persiane', posizioni.filter(p => p.persiana && p.persiana.quantita > 0).reduce((sum, p) => sum + (parseInt(p.persiana.quantita) || 0), 0)],
        ['Totale Tapparelle', posizioni.filter(p => p.tapparella && p.tapparella.quantita > 0).reduce((sum, p) => sum + (parseInt(p.tapparella.quantita) || 0), 0)],
        ['Totale Zanzariere', posizioni.filter(p => p.zanzariera && p.zanzariera.quantita > 0).reduce((sum, p) => sum + (parseInt(p.zanzariera.quantita) || 0), 0)],
        ['Totale Cassonetti', posizioni.filter(p => p.cassonetto && p.cassonetto.quantita > 0).reduce((sum, p) => sum + (parseInt(p.cassonetto.quantita) || 0), 0)]
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
            pos.quantita || 1,
            pos.L || '',
            pos.H || '',
            (pos.infisso && pos.infisso.quantita > 0) ? 'SI' : 'NO',
            (pos.persiana && pos.persiana.quantita > 0) ? 'SI' : 'NO',
            (pos.tapparella && pos.tapparella.quantita > 0) ? 'SI' : 'NO',
            (pos.zanzariera && pos.zanzariera.quantita > 0) ? 'SI' : 'NO',
            (pos.cassonetto && pos.cassonetto.quantita > 0) ? 'SI' : 'NO'
        ]);
    });
    const wsPosizioni = XLSX.utils.aoa_to_sheet(posizioniData);
    XLSX.utils.book_append_sheet(wb, wsPosizioni, "Posizioni");
    
    // ========== FOGLIO 3: INFISSI ==========
    const infissiData = [
        ['Posizione', 'Ambiente', 'Qtà', 'L×H (mm)', 'Azienda', 'Telaio', 'Materiale', 'Tipo Anta', 'Vetro', 'Colore Int', 'Colore Est']
    ];
    posizioni.forEach(pos => {
        if (pos.infisso && pos.infisso.quantita > 0) {
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
        if (pos.persiana && pos.persiana.quantita > 0) {
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
        if (pos.tapparella && pos.tapparella.quantita > 0) {
            const tapp = pos.tapparella;
            // Calcola prezzo se Plasticino
            let prezzoUnit = 'N/D';
            let prezzoTot = 'N/D';
            const aziendaLower = (tapp.azienda || '').toLowerCase();
            if (aziendaLower.includes('plasticino') || aziendaLower.includes('solar') || aziendaLower.includes('estella')) {
                const L_cm = parseInt(tapp.brm?.L) || parseInt(tapp.larghezza) || parseInt(pos.L) || 0;
                const H_cm = parseInt(tapp.brm?.H) || parseInt(tapp.altezza) || parseInt(pos.H) || 0;
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
        if (pos.zanzariera && pos.zanzariera.quantita > 0) {
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
        if (pos.cassonetto && pos.cassonetto.quantita > 0) {
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
    console.log('✅ JSON exported');
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

    // Carica dati se presenti in localStorage
    loadFromLocalStorage();
    
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
    
    // Se vista posizioni, renderizza se ci sono dati
    if (vistaName === 'posizioni' && currentData && currentData.posizioni) {
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
    
    console.log('✅ Vista Generale Ufficio rendered');
}

// ============================================================================
// SEZIONE A: INFO CLIENTE
// ============================================================================
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
    
    // v7.998: Genera HTML dinamico, nascondendo voci con 0
    let html = `
        <div class="totale-item">
            <div class="totale-numero">${stats.n_posizioni}</div>
            <div class="totale-label">Posizioni</div>
        </div>
        <div class="totale-item">
            <div class="totale-numero">${stats.n_infissi}</div>
            <div class="totale-label">Infissi</div>
        </div>
    `;
    
    // Tapparelle (solo se > 0)
    if (stats.n_tapparelle > 0) {
        html += `
        <div class="totale-item">
            <div class="totale-numero">${stats.n_tapparelle}</div>
            <div class="totale-label">Tapparelle</div>
        </div>
        `;
    }
    
    // Motori (solo se > 0) - v7.998
    if (stats.n_motori > 0) {
        html += `
        <div class="totale-item" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-color: #f59e0b;">
            <div class="totale-numero" style="color: #b45309;">${stats.n_motori}</div>
            <div class="totale-label" style="color: #92400e;">Motori</div>
        </div>
        `;
    }
    
    html += `
        <div class="totale-item">
            <div class="totale-numero">${stats.n_persiane}</div>
            <div class="totale-label">Persiane</div>
        </div>
        <div class="totale-item">
            <div class="totale-numero">${stats.n_zanzariere}</div>
            <div class="totale-label">Zanzariere</div>
        </div>
        <div class="totale-item">
            <div class="totale-numero">${stats.n_cassonetti}</div>
            <div class="totale-label">Cassonetti</div>
        </div>
    `;
    
    document.getElementById('totaliQuantita').innerHTML = html;
}

// Helper: calcola totali commessa
function calculateTotaliCommessa(data) {
    const posizioni = data.posizioni || [];
    
    let n_infissi = 0;
    let n_tapparelle = 0;
    let n_motori = 0;  // v7.998: Conteggio motori separato
    let n_persiane = 0;
    let n_zanzariere = 0;
    let n_cassonetti = 0;
    
    posizioni.forEach(pos => {
        // Infissi
        if (pos.infisso && pos.infisso.quantita > 0) {
            n_infissi += parseInt(pos.infisso.quantita) || 0;
        }
        
        // Tapparelle vs Motori - v7.998
        if (pos.tapparella) {
            const qta = parseInt(pos.tapparella.quantita || pos.tapparella.qta) || 0;
            if (qta > 0) {
                if (pos.tapparella.serveTapparella === true) {
                    // Tapparella vera (con telo)
                    n_tapparelle += qta;
                } else if (pos.tapparella.serveMotore === true) {
                    // Solo motore
                    n_motori += qta;
                }
            }
        }
        
        // Persiane
        if (pos.persiana && pos.persiana.quantita > 0) {
            n_persiane += parseInt(pos.persiana.quantita) || 0;
        }
        
        // Zanzariere
        if (pos.zanzariera && pos.zanzariera.quantita > 0) {
            n_zanzariere += parseInt(pos.zanzariera.quantita) || 0;
        }
        
        // Cassonetti
        if (pos.cassonetto && pos.cassonetto.quantita > 0) {
            n_cassonetti += parseInt(pos.cassonetto.quantita) || 0;
        }
    });
    
    return {
        n_posizioni: posizioni.length,
        n_infissi,
        n_tapparelle,
        n_motori,  // v7.998
        n_persiane,
        n_zanzariere,
        n_cassonetti
    };
}

// ============================================================================
// NUOVO: RIEPILOGO ECONOMICO CON TOTALE
// ============================================================================
function renderRiepilogoEconomico(data) {
    console.log('💰 Calcolo riepilogo economico...');
    
    try {
        // Calcola preventivo usando PreventivoCalculator
        const preventivo = window.PreventivoCalculator.calcolaPreventivo(data);
        
        if (!preventivo.successo || !preventivo.voci) {
            console.warn('⚠️ Preventivo non calcolabile, mostro placeholder');
            document.getElementById('riepilogoEconomico').innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #6b7280; font-style: italic;">
                    Configura i prodotti per calcolare i costi
                </div>
            `;
            return;
        }
        
        // Raggruppa totali per categoria
        const totali = {
            infissi: 0,
            persiane: 0,
            tapparelle: 0,
            zanzariere: 0,
            cassonetti: 0
        };
        
        preventivo.voci.forEach(voce => {
            const importo = parseFloat(voce.importo) || 0;
            const tipo = voce.tipo.toLowerCase();
            
            if (tipo.includes('infisso')) {
                totali.infissi += importo;
            } else if (tipo.includes('persiana')) {
                totali.persiane += importo;
            } else if (tipo.includes('tapparella')) {
                totali.tapparelle += importo;
            } else if (tipo.includes('zanzariera')) {
                totali.zanzariere += importo;
            } else if (tipo.includes('cassonetto')) {
                totali.cassonetti += importo;
            }
        });
        
        const totaleGenerale = Object.values(totali).reduce((sum, val) => sum + val, 0);
        
        // Genera HTML (OPZIONE A: Lista con totale evidenziato)
        let html = '';
        
        if (totali.infissi > 0) {
            html += `
                <div class="economico-item">
                    <span class="economico-label">Infissi</span>
                    <span class="economico-value">€ ${totali.infissi.toFixed(2)}</span>
                </div>
            `;
        }
        
        if (totali.persiane > 0) {
            html += `
                <div class="economico-item">
                    <span class="economico-label">Persiane</span>
                    <span class="economico-value">€ ${totali.persiane.toFixed(2)}</span>
                </div>
            `;
        }
        
        if (totali.tapparelle > 0) {
            html += `
                <div class="economico-item">
                    <span class="economico-label">Tapparelle</span>
                    <span class="economico-value">€ ${totali.tapparelle.toFixed(2)}</span>
                </div>
            `;
        }
        
        if (totali.zanzariere > 0) {
            html += `
                <div class="economico-item">
                    <span class="economico-label">Zanzariere</span>
                    <span class="economico-value">€ ${totali.zanzariere.toFixed(2)}</span>
                </div>
            `;
        }
        
        if (totali.cassonetti > 0) {
            html += `
                <div class="economico-item">
                    <span class="economico-label">Cassonetti</span>
                    <span class="economico-value">€ ${totali.cassonetti.toFixed(2)}</span>
                </div>
            `;
        }
        
        // TOTALE FINALE (evidenziato)
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
    const submenu = document.getElementById('githubProjectsList');
    if (!submenu) return;
    
    // 🆕 v8.500: Bottone Nuovo Progetto sempre visibile in cima
    let html = `
        <a href="#" onclick="openNewProjectModal(); return false;" 
           style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; font-weight: 700; text-align: center; display: flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.75rem;">
            ➕ Nuovo Progetto
        </a>
    `;
    
    if (projects.length === 0) {
        html += '<div style="padding: 1rem; text-align: center; color: #9ca3af; font-size: 0.875rem;">Nessun progetto trovato</div>';
        submenu.innerHTML = html;
        return;
    }
    
    // v8.492: Mostra solo primi 8 progetti di default
    const MAX_VISIBLE = 8;
    const showAll = submenu.dataset.showAll === 'true';
    const visibleProjects = showAll ? projects : projects.slice(0, MAX_VISIBLE);
    const hasMore = projects.length > MAX_VISIBLE;
    
    html += visibleProjects.map(proj => `
        <a href="#" onclick="loadGitHubProject('${proj.id}'); closeSidebar(); return false;">
            👤 ${proj.cliente || proj.nome}
        </a>
    `).join('');
    
    // Pulsante Mostra tutti / Mostra meno
    if (hasMore) {
        if (showAll) {
            html += `
                <a href="#" onclick="toggleProjectsList(false); return false;" 
                   style="background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); color: #6b7280; font-weight: 600; text-align: center; border-top: 1px solid #e5e7eb;">
                    ▲ Mostra meno
                </a>
            `;
        } else {
            html += `
                <a href="#" onclick="toggleProjectsList(true); return false;" 
                   style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: white; font-weight: 600; text-align: center;">
                    ▼ Mostra tutti (${projects.length})
                </a>
            `;
        }
    }
    
    submenu.innerHTML = html;
    
    console.log(`✅ Menu laterale: ${visibleProjects.length}/${projects.length} progetti visibili`);
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
    
    if (!data || !data.posizioni || data.posizioni.length === 0) {
        console.warn('⚠️ Nessuna posizione trovata');
        return;
    }

    // Nascondi placeholder, mostra contenuto (usando classList invece di style.display)
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

// CAMPIONI PREZZI BASE TIPO 101 (Battente 1 anta)
const CAMPIONI_TIPO_101 = [
    // [L_min, L_max, A_min, A_max, prezzo_eur]
    // Larghezza 605-730 (piccole)
    [605, 665, 605, 665, 221],
    [605, 665, 730, 790, 235],
    [605, 665, 855, 915, 248],
    [605, 665, 1040, 1105, 285],
    [605, 665, 1230, 1290, 320],
    [605, 665, 1415, 1480, 350],
    // Larghezza 800-865 (medie-piccole)
    [800, 865, 605, 665, 248],
    [800, 865, 790, 855, 277],
    [800, 865, 1040, 1105, 337],
    [800, 865, 1230, 1290, 370],
    [800, 865, 1415, 1480, 393],
    [800, 865, 1615, 1675, 423],
    // Larghezza 1050-1115 (medie)
    [1050, 1115, 605, 665, 300],
    [1050, 1115, 790, 855, 337],
    [1050, 1115, 1040, 1105, 414],
    [1050, 1115, 1230, 1290, 451],
    [1050, 1115, 1415, 1480, 480],
    [1050, 1115, 1615, 1675, 518],
    // Larghezza 1300-1365 (medie-grandi)
    [1300, 1365, 605, 665, 340],
    [1300, 1365, 790, 855, 382],
    [1300, 1365, 1040, 1105, 466],
    [1300, 1365, 1230, 1290, 511],
    [1300, 1365, 1415, 1480, 541],
    [1300, 1365, 1615, 1675, 586],
    // Larghezza 1550-1615 (grandi)
    [1550, 1615, 605, 665, 367],
    [1550, 1615, 790, 855, 412],
    [1550, 1615, 1040, 1105, 505],
    [1550, 1615, 1230, 1290, 551],
    [1550, 1615, 1415, 1480, 585],
    [1550, 1615, 1615, 1675, 628],
    // Larghezza 1800-1865 (molto grandi)
    [1800, 1865, 605, 665, 392],
    [1800, 1865, 790, 855, 437],
    [1800, 1865, 1040, 1105, 535],
    [1800, 1865, 1230, 1290, 586],
    [1800, 1865, 1415, 1480, 618],
    [1800, 1865, 1615, 1675, 653],
    // Larghezza 2050+ (extra large)
    [2050, 2115, 605, 665, 422],
    [2050, 2115, 790, 855, 474],
    [2050, 2115, 1040, 1105, 581],
    [2050, 2115, 1230, 1290, 636],
    [2050, 2115, 1415, 1480, 672],
    // Larghezza max
    [2790, 2855, 605, 665, 541],
    [2790, 2855, 790, 855, 650],
    [2790, 2855, 1040, 1105, 833],
    [2790, 2855, 1230, 1290, 872],
    [2915, 2980, 605, 665, 552],
    [2915, 2980, 790, 855, 661],
    [2915, 2980, 1040, 1105, 856],
    [2915, 2980, 1230, 1290, 891],
    [2915, 2980, 1415, 1480, 884],
    [2915, 2980, 1615, 1675, 907]
];

// CAMPIONI PREZZI BASE TIPO 401 (Battente 2 ante)
const CAMPIONI_TIPO_401 = [
    // [L_min, L_max, A_min, A_max, prezzo_eur]
    // Larghezza 990-1115 (piccole 2 ante)
    [990, 1050, 605, 665, 378],
    [990, 1050, 730, 790, 403],
    [990, 1050, 855, 915, 423],
    [990, 1050, 1040, 1105, 514],
    [990, 1050, 1230, 1290, 566],
    [990, 1050, 1415, 1480, 613],
    [1115, 1175, 605, 665, 400],
    [1115, 1175, 730, 790, 429],
    [1115, 1175, 855, 915, 450],
    [1115, 1175, 1040, 1105, 541],
    [1115, 1175, 1230, 1290, 601],
    [1115, 1175, 1415, 1480, 658],
    // Larghezza 1300-1425 (medie 2 ante)
    [1300, 1365, 605, 665, 432],
    [1300, 1365, 730, 790, 457],
    [1300, 1365, 855, 915, 488],
    [1300, 1365, 1040, 1105, 588],
    [1300, 1365, 1230, 1290, 653],
    [1300, 1365, 1415, 1480, 712],
    [1425, 1490, 605, 665, 441],
    [1425, 1490, 730, 790, 472],
    [1425, 1490, 855, 915, 498],
    [1425, 1490, 1040, 1105, 604],
    [1425, 1490, 1230, 1290, 664],
    [1425, 1490, 1415, 1480, 725],
    // Larghezza 1550-1675 (grandi 2 ante)
    [1550, 1615, 605, 665, 458],
    [1550, 1615, 730, 790, 492],
    [1550, 1615, 855, 915, 523],
    [1550, 1615, 1040, 1105, 633],
    [1550, 1615, 1230, 1290, 698],
    [1550, 1615, 1415, 1480, 762],
    [1740, 1800, 605, 665, 487],
    [1740, 1800, 730, 790, 526],
    [1740, 1800, 855, 915, 560],
    [1740, 1800, 1040, 1105, 678],
    [1740, 1800, 1230, 1290, 744],
    [1740, 1800, 1415, 1480, 805],
    // Larghezza 1990-2050 (molto grandi)
    [1990, 2050, 605, 665, 509],
    [1990, 2050, 730, 790, 554],
    [1990, 2050, 855, 915, 594],
    [1990, 2050, 1040, 1105, 725],
    [1990, 2050, 1230, 1290, 793],
    [1990, 2050, 1415, 1480, 848],
    // Larghezza max
    [2790, 2855, 605, 665, 741],
    [2790, 2855, 730, 790, 808],
    [2790, 2855, 1040, 1105, 1016],
    [2790, 2855, 1230, 1290, 1116],
    [2915, 2980, 605, 665, 758],
    [2915, 2980, 730, 790, 825],
    [2915, 2980, 855, 915, 878],
    [2915, 2980, 1040, 1105, 1047],
    [2915, 2980, 1230, 1290, 1146],
    [2915, 2980, 1415, 1480, 1233]
];

// TELAI PVC-PVC
const TELAI_PVC = {
    "961": { base_incluso: true, supplemento_ml: 5.20 },
    "962": { base_incluso: true, supplemento_ml: 5.61 },
    "963": { supplemento_ml_chiaro: 2.89, supplemento_ml_scuro: 9.31 },
    "967": { base_incluso: true, supplemento_ml: 5.20 }  // Alias 961
};

// TELAI ALLUMINIO-PVC
const TELAI_ALLUMINIO = {
    "961X": { supplemento_ml_chiaro: 23.6, supplemento_ml_scuro: 25.4 },
    "962X": { supplemento_ml_chiaro: 23.6, supplemento_ml_scuro: 25.4 },
    "963X": { supplemento_ml_chiaro: 23.6, supplemento_ml_scuro: 25.4 },
    "961N5": { supplemento_ml_chiaro: 18.0, supplemento_ml_scuro: 19.3 },
    "962N5": { supplemento_ml_chiaro: 18.0, supplemento_ml_scuro: 19.3 },
    "963N5": { supplemento_ml_chiaro: 18.0, supplemento_ml_scuro: 19.3 },
    "961N": { supplemento_ml_chiaro: 17.2, supplemento_ml_scuro: 20.4 },
    "962N": { supplemento_ml_chiaro: 17.2, supplemento_ml_scuro: 22.4 },
    "963N": { supplemento_ml_chiaro: 18.0, supplemento_ml_scuro: 24.9 }
};

// TELAI INTERNI
const TELAI_INTERNI = {
    "F961": { supplemento_ml_chiaro: 16.9, supplemento_ml_scuro: 18.2 },
    "F962": { supplemento_ml_chiaro: 16.9, supplemento_ml_scuro: 18.2 }
};

// SUPPLEMENTI ANTE (al metro lineare)
const SUPPLEMENTI_ANTE = {
    "classic-line": 0,        // Inclusa (standard)
    "classicline": 0,
    "step-line": 0,           // Inclusa (standard)
    "stepline": 0,
    "nova-line": 10,          // € 10/ml
    "novaline": 10,
    "nova-line-plus": 10,     // € 10/ml
    "novalineplus": 10,
    "nova-line-twin": 12,     // € 12/ml
    "novalinetwin": 12
};

// SUPPLEMENTI VETRI (al m² - solo se superficie > 2.5 m²)
const SUPPLEMENTI_VETRI = {
    "doppio": 0,              // Incluso (standard)
    "triplo": 35,             // € 35/m²
    "triplo-sat": 50,         // € 50/m²
    "triplo-satinato": 50,
    "triplo-selettivo": 60    // € 60/m²
};


// ═══════════════════════════════════════════════════════════════
// 🔧 FUNZIONI PARSING MANIGLIE FINSTRAL - v7.26
// ═══════════════════════════════════════════════════════════════

/**
 * Estrae codice maniglia da stringa tipo "6010 - Finestra alluminio"
 * @param {string} manigliaValue - Valore salvato (es: "6010 - Finestra alluminio" o "standard")
 * @returns {string} - Codice maniglia (es: "6010") o stringa originale se non parsabile
 */
function estraiCodiceManiglia(manigliaValue) {
    if (!manigliaValue || manigliaValue === '') return '';
    
    // Se contiene " - " è formato nuovo: "6010 - Finestra alluminio"
    if (manigliaValue.includes(' - ')) {
        const match = manigliaValue.match(/^(\S+)/);
        return match ? match[1] : '';
    }
    
    // Altrimenti è valore vecchio: "standard", "inox", ecc.
    return manigliaValue;
}

/**
 * Estrae codice colore da stringa tipo "07 - Bianco perla"
 * @param {string} coloreValue - Valore salvato (es: "07 - Bianco perla" o "bianco")
 * @returns {string} - Codice colore (es: "07") o stringa originale se non parsabile
 */
function estraiCodiceColore(coloreValue) {
    if (!coloreValue || coloreValue === '') return '';
    
    // Se contiene " - " è formato nuovo: "07 - Bianco perla"
    if (coloreValue.includes(' - ')) {
        const match = coloreValue.match(/^(\S+)/);
        return match ? match[1] : '';
    }
    
    // Altrimenti è valore vecchio: "bianco", "bronzo", ecc.
    return coloreValue;
}

/**
 * Calcola supplemento maniglia usando database Finstral
 * Supporta sia formato nuovo (6010 - Finestra) che vecchio (standard, inox)
 * @param {string} manigliaValue - Valore maniglia salvato
 * @param {string} coloreValue - Valore colore salvato
 * @returns {number} - Supplemento in € (0 se non trovato o valori vecchi)
 */
function calcolaSupplementoManigliaFinstral(manigliaValue, coloreValue) {
    const codiceManiglia = estraiCodiceManiglia(manigliaValue);
    const codiceColore = estraiCodiceColore(coloreValue);
    
    // Se è formato vecchio (no codici Finstral), usa vecchia logica
    if (!manigliaValue || !manigliaValue.includes(' - ')) {
        // Valori vecchi: "standard", "inox", "design", ecc.
        return calcolaSupplementoManigliaVecchio(manigliaValue);
    }
    
    // Formato nuovo: usa database Finstral
    if (!codiceManiglia || !codiceColore) {
        return 0; // Campi vuoti
    }
    
    // Usa funzione del database
    return getSupplemento(codiceManiglia, codiceColore);
}

/**
 * Fallback per valori vecchi (pre-v4.31)
 * @param {string} tipoManiglia - "standard", "inox", "design", ecc.
 * @returns {number} - Supplemento in €
 */
function calcolaSupplementoManigliaVecchio(tipoManiglia) {
    if (!tipoManiglia) return 0;
    const maniglia = tipoManiglia.toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-');
    
    // Supplementi vecchi (compatibilità)
    const SUPPLEMENTI_VECCHI = {
        "standard": 0,
        "bianco": 0,
        "satinato": 0,
        "inox": 20,
        "design": 40,
        "con-chiave": 50
    };
    
    return SUPPLEMENTI_VECCHI[maniglia] || 0;
}

// SUPPLEMENTI MANIGLIE (DEPRECATO v7.26)
// SOSTITUITO da database MANIGLIE_FINSTRAL
// Mantenuto per riferimento storico
/*
const SUPPLEMENTI_MANIGLIE = {
    "standard": 0,            // Inclusa
    "bianco": 0,              // Inclusa
    "satinato": 0,            // Inclusa (variante standard)
    "inox": 20,               // € 20/pezzo
    "design": 40,             // € 40/pezzo
    "con-chiave": 50          // € 50/pezzo
};
*/

// MAPPING APERTURE → TIPI
const MAPPING_APERTURE_TIPI = {
    // Battenti standard
    'battente_1_anta': 'tipo_101',
    'battente': 'tipo_101',
    'vasistas': 'tipo_101',
    'ribalta': 'tipo_101',
    // Aperture direzionali
    'dx': 'tipo_101',
    'sx': 'tipo_101',
    'destra': 'tipo_101',
    'sinistra': 'tipo_101',
    // Fissi
    'fisso': 'tipo_102',
    'f1': 'tipo_102',  // App usa F1 per fisso 1 campo
    // 2 Ante
    'battente_2_ante': 'tipo_401',
    'due_ante': 'tipo_401',
    'f2': 'tipo_401',  // App usa F2 per fisso 2 campi (o 2 ante)
    '2_ante': 'tipo_401',
    // Scorrevoli
    'scorrevole': 'tipo_501',
    'scorrevole_parallela': 'tipo_501',
    // Fallback
    'default': 'tipo_101'
};

// COSTI EXTRA
const COSTI_EXTRA = {
    posa_per_pezzo: 50,         // € per pezzo
    smontaggio_per_pezzo: 30    // € per pezzo
};

// Funzione: Calcola perimetro BRM in metri lineari
function calcolaPerimetroBRM(larghezza_mm, altezza_mm) {
    return 2 * (larghezza_mm + altezza_mm) / 1000;
}

// Funzione: Trova campione prezzo base
function trovaCampionePrezzoBase(tipo, L_mm, A_mm) {
    let campioni;
    
    if (tipo === 'tipo_101') {
        campioni = CAMPIONI_TIPO_101;
    } else if (tipo === 'tipo_401') {
        campioni = CAMPIONI_TIPO_401;
    } else if (tipo === 'tipo_102') {
        // Fisso: usa tipo 101 con sconto 5%
        campioni = CAMPIONI_TIPO_101;
        const prezzo = trovaCampionePrezzoBase('tipo_101', L_mm, A_mm);
        return prezzo ? prezzo * 0.95 : null;
    } else {
        console.warn(`Tipo ${tipo} non trovato`);
        return null;
    }
    
    // Cerca campione esatto o più vicino
    for (const [L_min, L_max, A_min, A_max, prezzo] of campioni) {
        if (L_mm >= L_min && L_mm <= L_max && 
            A_mm >= A_min && A_mm <= A_max) {
            return prezzo;
        }
    }
    
    // Nessun campione trovato: usa più vicino per sicurezza
    let minDistanza = Infinity;
    let prezzoVicino = null;
    
    for (const [L_min, L_max, A_min, A_max, prezzo] of campioni) {
        const L_centro = (L_min + L_max) / 2;
        const A_centro = (A_min + A_max) / 2;
        const distanza = Math.sqrt(
            Math.pow(L_mm - L_centro, 2) + 
            Math.pow(A_mm - A_centro, 2)
        );
        
        if (distanza < minDistanza) {
            minDistanza = distanza;
            prezzoVicino = prezzo;
        }
    }
    
    console.warn(`⚠️ Prezzo per L=${L_mm}, A=${A_mm} non trovato, uso più vicino: €${prezzoVicino}`);
    return prezzoVicino;
}

// Funzione: Calcola supplemento telaio
function calcolaSupplementoTelaio(codiceTelaio, perimetro_ml, coloreScuro = false) {
    let supplemento = 0;
    
    // Cerca in telai PVC
    if (TELAI_PVC[codiceTelaio]) {
        const telaio = TELAI_PVC[codiceTelaio];
        if (telaio.supplemento_ml) {
            supplemento = telaio.supplemento_ml * perimetro_ml;
        } else {
            const sup_ml = coloreScuro ? telaio.supplemento_ml_scuro : telaio.supplemento_ml_chiaro;
            supplemento = sup_ml * perimetro_ml;
        }
    }
    // Cerca in telai Alluminio
    else if (TELAI_ALLUMINIO[codiceTelaio]) {
        const telaio = TELAI_ALLUMINIO[codiceTelaio];
        const sup_ml = coloreScuro ? telaio.supplemento_ml_scuro : telaio.supplemento_ml_chiaro;
        supplemento = sup_ml * perimetro_ml;
    }
    // Cerca in telai Interni
    else if (TELAI_INTERNI[codiceTelaio]) {
        const telaio = TELAI_INTERNI[codiceTelaio];
        const sup_ml = coloreScuro ? telaio.supplemento_ml_scuro : telaio.supplemento_ml_chiaro;
        supplemento = sup_ml * perimetro_ml;
    }
    
    return supplemento;
}

// Funzione: Determina se colore è scuro (gruppo B)
function isColoreScuro(colore) {
    if (!colore) return false;
    const coloreLC = colore.toLowerCase();
    
    // Gruppo A (chiari): bianco, bianco perla, bianco satinato, bianco goffrato
    const coloriChiari = ['bianco', 'white', 'ral 9010', 'ral 9016', 'perla', 'satinato', 'goffrato'];
    
    // Se contiene una parola chiara, è chiaro
    if (coloriChiari.some(c => coloreLC.includes(c))) {
        return false;
    }
    
    // Altrimenti consideralo scuro (gruppo B)
    return true;
}

// Funzione: Ottieni tipo da apertura
function getTipoDaApertura(apertura) {
    const aperturaLC = (apertura || '').toLowerCase().trim();
    return MAPPING_APERTURE_TIPI[aperturaLC] || MAPPING_APERTURE_TIPI['default'];
}

// Funzione: Calcola supplemento anta
function calcolaSupplementoAnta(tipoAnta, perimetro_ml) {
    if (!tipoAnta) return 0;
    const anta = tipoAnta.toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-');
    const suppl_ml = SUPPLEMENTI_ANTE[anta] || 0;
    return suppl_ml * perimetro_ml;
}

// Funzione: Calcola supplemento vetro
function calcolaSupplementoVetro(tipoVetro, superficie_mq) {
    if (!tipoVetro) return 0;
    const vetro = tipoVetro.toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-');
    
    // ✅ v7.73: Usa database Finstral per vetri 2113/11414
    let suppl_mq = 0;
    if (vetro.includes('triplo') || vetro === '11414' || vetro.includes('max-valor')) {
        suppl_mq = FINSTRAL_PREZZI.supplementiVetro?.["11414"] || 118.00;
    } else if (vetro.includes('doppio') || vetro === '2113') {
        suppl_mq = FINSTRAL_PREZZI.supplementiVetro?.["2113"] || 52.20;
    } else {
        suppl_mq = SUPPLEMENTI_VETRI[vetro] || 0;
    }
    
    // 🆕 v8.45: Supplemento AGGIUNTIVO per vetro satinato
    // Il satinato è un'opzione che si aggiunge al vetro base
    if (vetro.includes('satinato') || vetro.includes('satin')) {
        const supplSatinato = FINSTRAL_PREZZI.supplementiVetro?.satinato || 82.40;
        suppl_mq += supplSatinato;
        console.log(`🔷 Vetro satinato rilevato: +€${supplSatinato}/m² (totale €${suppl_mq}/m²)`);
    }
    
    // Supplemento vetro sempre applicato
    return suppl_mq * superficie_mq;
}

/**
 * ✅ v7.79: Cerca supplemento anta da tabella dimensionale
 * Per ante Slim-line Cristal, Twin, Nova Twin che hanno prezzo €/pezzo invece di €/ml
 * @param {string} tipoAnta - Tipo anta normalizzato (es. "slim-line-cristal")
 * @param {number} altezza_mm - Altezza anta in mm
 * @param {number} larghezza_mm - Larghezza anta in mm
 * @returns {number|null} Supplemento €/pezzo o null se non trovato
 */
function getSupplementoAntaDimensionale(tipoAnta, altezza_mm, larghezza_mm) {
    const tabella = FINSTRAL_PREZZI.tabelleAnteDimensionali?.[tipoAnta];
    if (!tabella) return null; // Non è un tipo con tabella dimensionale
    
    // Trova riga (altezza) più vicina
    const righe = Object.keys(tabella).map(Number).sort((a, b) => a - b);
    let rigaKey = righe[righe.length - 1]; // Default: ultima riga
    for (const r of righe) {
        if (r >= altezza_mm) {
            rigaKey = r;
            break;
        }
    }
    
    // Trova colonna (larghezza) più vicina
    const colonne = Object.keys(tabella[rigaKey] || {}).map(Number).sort((a, b) => a - b);
    let colonnaKey = colonne[colonne.length - 1]; // Default: ultima colonna
    for (const c of colonne) {
        if (c >= larghezza_mm) {
            colonnaKey = c;
            break;
        }
    }
    
    const prezzo = tabella[rigaKey]?.[colonnaKey];
    if (prezzo) {
        console.log(`📊 Tabella anta ${tipoAnta}: A=${altezza_mm}→${rigaKey}, L=${larghezza_mm}→${colonnaKey} = €${prezzo}`);
    }
    return prezzo || 0;
}

// Funzione: Calcola supplemento maniglia (DEPRECATA v7.26)
// SOSTITUITA da calcolaSupplementoManigliaFinstral()
// Mantenuta per debug e compatibilità temporanea
/*
function calcolaSupplementoManiglia(tipoManiglia) {
    if (!tipoManiglia) return 0;
    const maniglia = tipoManiglia.toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-');
    return SUPPLEMENTI_MANIGLIE[maniglia] || 0;
}
*/

/**
 * Estrae numero ante dal campo tipo (F1, F2, F3, F4, PF1, PF2)
 * @param {string} tipo - Tipo infisso/persiana (es. "F2", "PF1")
 * @returns {number} Numero ante (1, 2, 3, 4)
 */
function estraiNumeroAnte(tipo) {
    if (!tipo) return 1;
    
    // Estrai ultima cifra da tipo: F1→1, F2→2, PF2→2, F3→3, F4→4
    const match = tipo.match(/(\d+)$/);
    if (match) {
        return parseInt(match[1]);
    }
    
    return 1; // Default 1 anta
}

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
function calcolaPrezzoCassonettoFinstral(config) {
    const risultato = {
        success: false,
        prezzo: 0,
        dettaglio: {
            prezzoBase: 0,
            supplementoIsolamento: 0,
            numeroIsolamenti: 0
        },
        parametri: {},
        errori: []
    };
    
    try {
        // Estrai parametri
        const L = parseInt(config.L) || parseInt(config.BRM_L) || 0;  // Larghezza mm
        const A = parseInt(config.A) || parseInt(config.BRM_H) || parseInt(config.HCASS) || 0;  // Altezza mm
        const B = parseInt(config.B) || parseInt(config.BRM_B) || 0;  // Profondità mm
        const materiale = (config.materialeCass || config.materiale || 'PVC').toUpperCase();
        const gruppoColore = config.gruppoColoreCass || config.gruppoColore || 'bianco';
        const codiceIsolamento = config.codiceIsolamento || null;
        
        risultato.parametri = { L, A, B, materiale, gruppoColore, codiceIsolamento };
        
        // Validazione
        if (L <= 0) { risultato.errori.push('Larghezza L non valida'); return risultato; }
        if (A <= 0) { risultato.errori.push('Altezza A non valida'); return risultato; }
        
        // Determina codice cassonetto in base a B e materiale
        let codiceCass = config.codiceCass || '';
        if (!codiceCass) {
            if (materiale === 'LEGNO') {
                codiceCass = (B > 335) ? '9-48B' : '9-48';
            } else {
                // PVC: scegli tra 148 e 300 in base a B
                if (B <= 148) {
                    codiceCass = '148';
                } else if (B <= 300) {
                    codiceCass = '300';
                } else {
                    // B > 300 → versione B
                    codiceCass = (B <= 148 + 200) ? '148B' : '300B';
                }
            }
        }
        risultato.parametri.codiceCass = codiceCass;
        
        // Seleziona tabella prezzi
        let tabella = null;
        let colonnaColore = '';
        
        if (materiale === 'LEGNO') {
            tabella = codiceCass.includes('B') ? FINSTRAL_CASSONETTI_PREZZI.legno_948B : FINSTRAL_CASSONETTI_PREZZI.legno_948;
            colonnaColore = (gruppoColore === 'legno2+3' || gruppoColore === 'gruppo23' || gruppoColore === 'gruppo2+3') ? 'gruppo23' : 'gruppo1';
        } else {
            // PVC
            if (codiceCass === '148B') tabella = FINSTRAL_CASSONETTI_PREZZI.pvc_148B;
            else if (codiceCass === '300') tabella = FINSTRAL_CASSONETTI_PREZZI.pvc_300;
            else if (codiceCass === '300B') tabella = FINSTRAL_CASSONETTI_PREZZI.pvc_300B;
            else tabella = FINSTRAL_CASSONETTI_PREZZI.pvc_148;
            colonnaColore = (gruppoColore === 'scuri' || gruppoColore.includes('scur')) ? 'scuri' : 'bianco';
        }
        
        risultato.parametri.tabella = tabella.codice;
        risultato.parametri.colonnaColore = colonnaColore;
        
        // Verifica limite larghezza
        if (L > tabella.maxL) {
            risultato.errori.push(`Larghezza ${L}mm supera max ${tabella.maxL}mm per ${tabella.codice}`);
            return risultato;
        }
        
        // Trova indice colonna L (arrotondamento alla casella superiore)
        let idxL = tabella.colonneL.findIndex(col => L <= col);
        if (idxL === -1) idxL = tabella.colonneL.length - 1;
        
        // Trova indice riga A (arrotondamento alla casella superiore)
        let idxA = tabella.righeA.findIndex(row => A <= row);
        if (idxA === -1) idxA = tabella.righeA.length - 1;
        
        risultato.parametri.idxL = idxL;
        risultato.parametri.idxA = idxA;
        risultato.parametri.LArrotondato = tabella.colonneL[idxL];
        risultato.parametri.AArrotondato = tabella.righeA[idxA];
        
        // Ottieni prezzo dalla matrice
        const matricePrezzi = tabella[colonnaColore];
        if (!matricePrezzi || !matricePrezzi[idxA] || matricePrezzi[idxA][idxL] === undefined) {
            risultato.errori.push('Prezzo non trovato nella griglia');
            return risultato;
        }
        
        const prezzoBase = matricePrezzi[idxA][idxL];
        risultato.dettaglio.prezzoBase = prezzoBase;
        
        // Supplemento isolamento
        let supplementoIsolamento = 0;
        let numeroIsolamenti = 0;
        if (codiceIsolamento && FINSTRAL_CASSONETTI_PREZZI.isolamento[codiceIsolamento]) {
            const iso = FINSTRAL_CASSONETTI_PREZZI.isolamento[codiceIsolamento];
            // Se L > 1000mm servono più pezzi
            numeroIsolamenti = Math.ceil(L / 1000);
            supplementoIsolamento = iso.prezzo * numeroIsolamenti;
            risultato.dettaglio.supplementoIsolamento = supplementoIsolamento;
            risultato.dettaglio.numeroIsolamenti = numeroIsolamenti;
            risultato.dettaglio.codiceIsolamento = codiceIsolamento;
            risultato.dettaglio.spessoreIsolamento = iso.spessore;
        }
        
        // Totale
        risultato.prezzo = Math.round((prezzoBase + supplementoIsolamento) * 100) / 100;
        risultato.success = true;
        
        console.log('📦 Calcolo cassonetto Finstral:', risultato);
        return risultato;
        
    } catch (e) {
        risultato.errori.push('Errore calcolo: ' + e.message);
        console.error('❌ Errore calcolaPrezzoCassonettoFinstral:', e);
        return risultato;
    }
}

// ✅ v7.73: FUNZIONE MAPPING COLORE TESTO → CODICE FINSTRAL
function mappaColoreACodiceFinstral(coloreInput, tipo = 'pvc') {
    if (!coloreInput) return tipo === 'pvc' ? '01' : 'M01'; // Default bianco
    
    const colore = coloreInput.toLowerCase().trim();
    
    // 1. Cerca match esatto in coloriComuni
    for (const [nome, dati] of Object.entries(FINSTRAL_PREZZI.coloriComuni)) {
        if (colore === nome.toLowerCase() || colore.includes(nome.toLowerCase())) {
            return tipo === 'pvc' ? (dati.pvc || '01') : (dati.alluminio || 'M01');
        }
    }
    
    // 2. Pattern matching per codici RAL
    const ralMatch = colore.match(/ral\s*(\d{4})/i);
    if (ralMatch) {
        return tipo === 'pvc' ? '01' : 'RAL'; // Alluminio gruppo 2
    }
    
    // 3. Pattern matching per codici diretti Finstral (es. "F716", "L19", "M01")
    const codiceMatch = colore.match(/^([FLM]\d+|G\d+|LC\d+)/i);
    if (codiceMatch) {
        return codiceMatch[1].toUpperCase();
    }
    
    // ✅ v7.79: Pattern per codici PVC numerici (es. "45 - Bianco", "06 - Grigio")
    const codicePVCMatch = colore.match(/^(\d{2})\s*[-–]/);
    if (codicePVCMatch && tipo === 'pvc') {
        return codicePVCMatch[1];  // Restituisce "45", "06", "01", ecc.
    }
    
    // 4. Pattern matching per colori comuni
    if (colore.includes('bianco') || colore.includes('white')) {
        return tipo === 'pvc' ? '01' : 'M01';
    }
    if (colore.includes('grigio') || colore.includes('grey') || colore.includes('gray')) {
        if (colore.includes('antracite') || colore.includes('scuro')) {
            return tipo === 'pvc' ? '46' : 'F716';
        }
        return tipo === 'pvc' ? '46' : 'F744'; // grigio seta
    }
    if (colore.includes('nero') || colore.includes('black')) {
        return tipo === 'pvc' ? '06' : 'F905';
    }
    if (colore.includes('castagno') || colore.includes('marrone')) {
        return tipo === 'pvc' ? '13' : 'L13';
    }
    if (colore.includes('rovere') || colore.includes('oak')) {
        return tipo === 'pvc' ? '19' : 'L19';
    }
    if (colore.includes('noce')) {
        return tipo === 'pvc' ? '55' : 'L55';
    }
    
    // 5. Default
    return tipo === 'pvc' ? '01' : 'M01';
}

// ✅ v7.73: Determina gruppo colore PVC (A o B)
function getGruppoColorePVC(codicePVC) {
    if (FINSTRAL_PREZZI.supplementiColorePVC.gruppoA.includes(codicePVC)) return 'A';
    if (FINSTRAL_PREZZI.supplementiColorePVC.gruppoB.includes(codicePVC)) return 'B';
    return 'A'; // Default
}

// ═══════════════════════════════════════════════════════════════════════════
// ✅ v7.77: FUNZIONI HELPER FERRAMENTA / APERTURE / CERNIERE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Ottiene codice ferramenta completo per tipo apertura
 * @param {string} tipoApertura - AR, A, R, FX, VA, SP, SPR, PFS
 * @param {boolean} cerniereScomparsa - true = scomparsa (2xx), false = vista (4xx)
 * @returns {object} - { codice, nome, minL, minH }
 */
function getCodiceApertura(tipoApertura, cerniereScomparsa = false) {
    const apertura = FINSTRAL_PREZZI.tipiApertura[tipoApertura];
    if (!apertura) {
        console.warn(`⚠️ Tipo apertura non trovato: ${tipoApertura}`);
        return { codice: "411.0", nome: "Anta/Ribalta", minL: 350, minH: 325 };
    }
    
    const codice = cerniereScomparsa && apertura.codiceScomparsa 
        ? apertura.codiceScomparsa 
        : apertura.codiceVista;
    
    return {
        codice: codice,
        nome: apertura.nome,
        minL: apertura.minL,
        minH: apertura.minH,
        hasCerniereScomparsa: !!apertura.codiceScomparsa
    };
}

/**
 * Formatta label tipo apertura per UI
 * @param {string} codice - AR, A, R, FX, VA, SP, SPR, PFS
 * @returns {string} - label leggibile
 */
function formatTipoApertura(codice) {
    const labels = {
        'AR': 'Anta/Ribalta',
        'A': 'Solo Anta',
        'R': 'Solo Ribalta',
        'FX': 'Fisso',
        'VA': 'Vasistas',
        'SP': 'Scorrevole',
        'SPR': 'Scorr. Ribalta',
        'PFS': 'Porta-Fin. Ser.'
    };
    return labels[codice] || codice;
}

/**
 * Calcola supplemento cerniere a scomparsa
 * @param {string} tipoApertura - AR, A, R, FX, VA, PFS
 * @param {number} numAnte - numero ante (default 1)
 * @returns {number} - supplemento in €
 */
function getSupplementoCerniereScomparsa(tipoApertura, numAnte = 1) {
    const suppl = FINSTRAL_PREZZI.supplementiCerniere[tipoApertura];
    if (!suppl) return 0;
    return suppl * numAnte;
}

/**
 * Calcola supplemento totale ferramenta
 * @param {object} config - { tipoApertura, cerniereScomparsa, sicurezza[], aerazione, comfort[], rc2 }
 * @returns {object} - { totale, dettaglio }
 */
function calcolaSupplementoFerramenta(config) {
    let totale = 0;
    const dettaglio = [];

    // Cerniere scomparsa
    if (config.cerniereScomparsa && config.tipoApertura) {
        const suppl = getSupplementoCerniereScomparsa(config.tipoApertura, config.numAnte || 1);
        if (suppl > 0) {
            totale += suppl;
            dettaglio.push({ tipo: 'Cerniere scomparsa', importo: suppl });
        }
    }

    // Sicurezza
    if (config.sicurezza && Array.isArray(config.sicurezza)) {
        config.sicurezza.forEach(s => {
            const suppl = FINSTRAL_PREZZI.supplementiSicurezza[s] || 0;
            if (suppl > 0) {
                totale += suppl;
                dettaglio.push({ tipo: `Sicurezza ${s}`, importo: suppl });
            }
        });
    }

    // Aerazione
    if (config.aerazione) {
        const suppl = FINSTRAL_PREZZI.supplementiAerazione[config.aerazione] || 0;
        if (suppl > 0) {
            totale += suppl;
            dettaglio.push({ tipo: `Aerazione ${config.aerazione}`, importo: suppl });
        }
    }

    // Comfort
    if (config.comfort && Array.isArray(config.comfort)) {
        config.comfort.forEach(c => {
            const suppl = FINSTRAL_PREZZI.supplementiComfort[c] || 0;
            if (suppl > 0) {
                totale += suppl;
                dettaglio.push({ tipo: `Comfort ${c}`, importo: suppl });
            }
        });
    }

    // RC2
    if (config.rc2) {
        const tipoAnta = (config.tipoAnta || '').toLowerCase();
        const supplRC2 = tipoAnta.includes('nova') 
            ? FINSTRAL_PREZZI.rc2.supplemento['nova-line']
            : FINSTRAL_PREZZI.rc2.supplemento['altri'];
        totale += supplRC2;
        dettaglio.push({ tipo: 'RC2 Antieffrazione', importo: supplRC2 });
    }

    console.log(`🔩 Supplemento ferramenta: €${totale.toFixed(2)}`, dettaglio);
    return { totale, dettaglio };
}

/**
 * Verifica compatibilità RC2 per telaio
 * @param {string} telaio - codice telaio (961, 967, etc.)
 * @returns {boolean}
 */
function isTelaioRC2Compatibile(telaio) {
    return FINSTRAL_PREZZI.rc2.telaiCompatibili.includes(telaio);
}

/**
 * Verifica misure minime per tipo apertura
 * @param {string} tipoApertura 
 * @param {number} larghezza - mm
 * @param {number} altezza - mm
 * @returns {boolean}
 */
function verificaMisureMinime(tipoApertura, larghezza, altezza) {
    const apertura = FINSTRAL_PREZZI.tipiApertura[tipoApertura];
    if (!apertura) return true; // Non verificabile
    return larghezza >= apertura.minL && altezza >= apertura.minH;
}

console.log('🔩 Helper ferramenta caricati: getCodiceApertura, getSupplementoCerniereScomparsa, calcolaSupplementoFerramenta');

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
        
        // 🔐 DEBUG BLINDATA
        console.log(`🔐 Pos ${index + 1} blindata:`, pos.blindata);
        
        // Processa INFISSI
        if (pos.infisso && pos.infisso.qta > 0) {
            const infisso = pos.infisso;
            
            // 🆕 v8.470: LOGICA FALLBACK BRM COMPLETA
            // Priorità: BRM → LF+100/HF+50 → LVT+100/HVT+50 → TMV-40/HMT-20
            let L_mm = infisso.BRM_L || infisso.brm?.L;
            let H_mm = infisso.BRM_H || infisso.brm?.H;
            let brmStimato = false;
            let brmOrigine = 'BRM';
            
            // FALLBACK 1: LF/HF (foro) + 100/50
            if (!L_mm && pos.misure?.LF) {
                L_mm = parseInt(pos.misure.LF) + 100;
                brmStimato = true;
                brmOrigine = 'LF+100';
                console.warn(`⚠️ Pos ${index + 1}: BRM_L null → LF(${pos.misure.LF})+100 = ${L_mm}`);
            }
            if (!H_mm && pos.misure?.HF) {
                H_mm = parseInt(pos.misure.HF) + 50;
                brmStimato = true;
                brmOrigine = brmOrigine.includes('LF') ? 'LF+100/HF+50' : 'HF+50';
                console.warn(`⚠️ Pos ${index + 1}: BRM_H null → HF(${pos.misure.HF})+50 = ${H_mm}`);
            }
            
            // FALLBACK 2: LVT/HVT (vano totale) + 100/50
            if (!L_mm && pos.misure?.LVT) {
                L_mm = parseInt(pos.misure.LVT) + 100;
                brmStimato = true;
                brmOrigine = 'LVT+100';
                console.warn(`⚠️ Pos ${index + 1}: BRM_L null → LVT(${pos.misure.LVT})+100 = ${L_mm}`);
            }
            if (!H_mm && pos.misure?.HVT) {
                H_mm = parseInt(pos.misure.HVT) + 50;
                brmStimato = true;
                brmOrigine = brmOrigine.includes('LVT') ? 'LVT+100/HVT+50' : 'HVT+50';
                console.warn(`⚠️ Pos ${index + 1}: BRM_H null → HVT(${pos.misure.HVT})+50 = ${H_mm}`);
            }
            
            // FALLBACK 3: TMV/HMT (telaio muratura) - 40/20
            if (!L_mm && pos.misure?.TMV) {
                L_mm = parseInt(pos.misure.TMV) - 40;
                brmStimato = true;
                brmOrigine = 'TMV-40';
                console.warn(`⚠️ Pos ${index + 1}: BRM_L null → TMV(${pos.misure.TMV})-40 = ${L_mm}`);
            }
            if (!H_mm && pos.misure?.HMT) {
                H_mm = parseInt(pos.misure.HMT) - 20;
                brmStimato = true;
                brmOrigine = brmOrigine.includes('TMV') ? 'TMV-40/HMT-20' : 'HMT-20';
                console.warn(`⚠️ Pos ${index + 1}: BRM_H null → HMT(${pos.misure.HMT})-20 = ${H_mm}`);
            }
            
            // Log se BRM stimato
            if (brmStimato) {
                console.log(`📐 Pos ${index + 1}: BRM STIMATO da ${brmOrigine} → ${L_mm} × ${H_mm} mm`);
            }
            
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
                    
                    // Quantità
                    const quantita = parseInt(pos.quantita) || parseInt(infisso.qta) || 1;
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
                    const supplTelaio = FINSTRAL_PREZZI.supplementiTelaio?.[telaio];
                    if (supplTelaio) {
                        supplementoTelaioFinstral = Math.round(supplTelaio[materiale] * perimetro_ml * 100) / 100;
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
                            // ✅ v7.79 FIX: Nova-line è SOLO PVC, usa sempre valore PVC
                            const isNovaLine_fb = antaNorm.includes('nova');
                            const materialeProfilo_fb = isNovaLine_fb ? 'pvc' : materiale;
                            const valoreProf_fb = supplProfilo[materialeProfilo_fb] || supplProfilo['pvc'] || 0;
                            supplementoProfiloAntaFinstral = Math.round(valoreProf_fb * perimetroBattenti_fb * 100) / 100;
                            console.log(`📊 Fallback profilo ${antaNorm}[${materialeProfilo_fb}]: €${valoreProf_fb}/ml × ${perimetroBattenti_fb.toFixed(2)}ml = €${supplementoProfiloAntaFinstral}`);
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
                
                // Quantità (priorità: pos.quantita > infisso.qta > 1)
                const quantita = parseInt(pos.quantita) || parseInt(infisso.qta) || 1;
                
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
        if (pos.tapparella && serveTapparella && (pos.tapparella.quantita === undefined || pos.tapparella.quantita === null || pos.tapparella.quantita > 0)) {
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
                // ✅ v7.58 FIX PRIORITÀ CORRETTA TAPPARELLE
                // 1° BRM_L/BRM_H (campo diretto)
                // 2° brm?.L/brm?.H (retrocompatibilità)
                // 3° LF/HF (Larghezza/Altezza Foro) + MAGGIORAZIONI
                // 4° LVT/HVT (ultimo fallback)
                
                let L_mm = parseInt(tapp.BRM_L) || parseInt(tapp.brm?.L) || 0;
                let H_mm = parseInt(tapp.BRM_H) || parseInt(tapp.brm?.H) || 0;
                let usaMisureForo = false;  // 🆕 v7.81: Flag per maggiorazioni
                
                console.log(`🔍 v7.58 Tapparella Pos ${index + 1}:`);
                console.log(`   - tapp.BRM_L = ${tapp.BRM_L}, tapp.BRM_H = ${tapp.BRM_H}`);
                console.log(`   - tapp.brm?.L = ${tapp.brm?.L}, tapp.brm?.H = ${tapp.brm?.H}`);
                
                // 🔧 FALLBACK 1: LF e HF (misure foro tapparella)
                if (!L_mm && pos.misure?.LF) {
                    L_mm = parseInt(pos.misure.LF);
                    usaMisureForo = true;
                    console.log(`   ⚠️ Fallback LF: ${L_mm}mm (da foro)`);
                }
                if (!H_mm && pos.misure?.HF) {
                    H_mm = parseInt(pos.misure.HF);
                    usaMisureForo = true;
                    console.log(`   ⚠️ Fallback HF: ${H_mm}mm (da foro)`);
                }
                
                // 🔧 FALLBACK 2 (ultimo): LVT e HVT (misure infisso)
                if (!L_mm && pos.misure?.LVT) {
                    L_mm = parseInt(pos.misure.LVT);
                    console.log(`   ⚠️⚠️ Fallback ULTIMO LVT: ${L_mm}mm`);
                }
                if (!H_mm && pos.misure?.HVT) {
                    H_mm = parseInt(pos.misure.HVT);
                    console.log(`   ⚠️⚠️ Fallback ULTIMO HVT: ${H_mm}mm`);
                }
                
                // Ultimo fallback: pos.L/H generico
                if (!L_mm) L_mm = parseInt(pos.L) || 0;
                if (!H_mm) H_mm = parseInt(pos.H) || 0;
                
                // 🆕 v7.81: MAGGIORAZIONI per misure foro (LF/HF)
                // Il telo deve essere più grande del foro per coprirlo
                let L_telo_mm = L_mm;
                let H_telo_mm = H_mm;
                if (usaMisureForo) {
                    L_telo_mm = L_mm + 40;   // +40mm larghezza
                    H_telo_mm = H_mm + 200;  // +200mm altezza
                    console.log(`   📏 v7.81 Maggiorazione foro: ${L_mm}+40=${L_telo_mm}mm × ${H_mm}+200=${H_telo_mm}mm`);
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
        if (pos.persiana && (pos.persiana.quantita === undefined || pos.persiana.quantita === null || pos.persiana.quantita > 0)) {
            const pers = pos.persiana;
            const quantita = parseInt(pers.quantita) || 1;
            
            // 🔧 v7.51 FIX: Fallback COMPLETO come infissi (usa pos.misure.LVT/HVT)
            let L_mm = parseInt(pers.brm?.L) || parseInt(pers.larghezza) || 0;
            let H_mm = parseInt(pers.brm?.H) || parseInt(pers.altezza) || 0;
            
            // Fallback a pos.misure (come infissi!)
            if (!L_mm && pos.misure?.LVT) {
                L_mm = parseInt(pos.misure.LVT);
                console.log(`🔍 v7.51 Persiana fallback LVT: ${L_mm}mm`);
            }
            if (!H_mm && pos.misure?.HVT) {
                H_mm = parseInt(pos.misure.HVT);
                console.log(`🔍 v7.51 Persiana fallback HVT: ${H_mm}mm`);
            }
            
            // Ultimo fallback
            if (!L_mm) L_mm = parseInt(pos.L) || 0;
            if (!H_mm) H_mm = parseInt(pos.H) || 0;
            
            console.log(`🔍 Persiana Pos ${index + 1}: L=${L_mm}mm, H=${H_mm}mm`);
            
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
        if (pos.zanzariera && (pos.zanzariera.quantita === undefined || pos.zanzariera.quantita === null || pos.zanzariera.quantita > 0)) {
            const zanz = pos.zanzariera;
            const quantita = parseInt(zanz.quantita) || 1;
            
            // 🔧 v7.51 FIX: Fallback COMPLETO come infissi (usa pos.misure.LVT/HVT)
            let L_mm = parseInt(zanz.brm?.L) || parseInt(zanz.larghezza) || 0;
            let H_mm = parseInt(zanz.brm?.H) || parseInt(zanz.altezza) || 0;
            
            // Fallback a pos.misure (come infissi!)
            if (!L_mm && pos.misure?.LVT) {
                L_mm = parseInt(pos.misure.LVT);
                console.log(`🔍 v7.51 Zanzariera fallback LVT: ${L_mm}mm`);
            }
            if (!H_mm && pos.misure?.HVT) {
                H_mm = parseInt(pos.misure.HVT);
                console.log(`🔍 v7.51 Zanzariera fallback HVT: ${H_mm}mm`);
            }
            
            // Ultimo fallback
            if (!L_mm) L_mm = parseInt(pos.L) || 0;
            if (!H_mm) H_mm = parseInt(pos.H) || 0;
            
            console.log(`🔍 Zanzariera Pos ${index + 1}: L=${L_mm}mm, H=${H_mm}mm`);
            
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
        if (pos.cassonetto && (pos.cassonetto.qta === undefined || pos.cassonetto.qta === null || parseInt(pos.cassonetto.qta) > 0)) {
            const cass = pos.cassonetto;
            const quantita = parseInt(cass.qta) || 1;
            
            // 🆕 v7.996: Usa campi corretti BRM_L, BRM_H, B, C
            let L_mm = parseInt(cass.BRM_L) || 0;
            let A_mm = parseInt(cass.BRM_H) || parseInt(cass.HCASS) || 0;
            let B_mm = parseInt(cass.BRM_B) || parseInt(cass.B) || 0;
            let C_mm = parseInt(cass.BRM_C) || parseInt(cass.C) || 0;
            
            // Fallback
            if (!L_mm && cass.LS) {
                const ls = parseInt(cass.LS) || 0;
                const srsx = parseInt(cass.SRSX) || 0;
                const srdx = parseInt(cass.SRDX) || 0;
                L_mm = ls + srsx + srdx;
                console.log(`🔍 v7.996 Cassonetto fallback L: LS(${ls})+SRSX(${srsx})+SRDX(${srdx}) = ${L_mm}mm`);
            }
            
            console.log(`📦 v7.996 Cassonetto Pos ${index + 1}: L=${L_mm}mm, A=${A_mm}mm, B=${B_mm}mm, C=${C_mm}mm`);
            
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
        // 🚪 PORTONCINI FIN-DOOR FINSTRAL - v7.99
        // ============================================================================
        // Normalizza portoncino da ingresso.portoncino se non già presente
        if (pos.ingresso?.portoncino && !pos.portoncino) {
            pos.portoncino = pos.ingresso.portoncino;
            console.log(`   🚪 NORMALIZZATO pos ${index + 1}: ingresso.portoncino → portoncino`);
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
                const prezzoCalcolato = calcolaPrezzoPortoncinoFindoor(ptc);
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
                    supplementoTelaio: (prezzoCalcolato.supplementoModello || 0).toFixed(2),
                    supplementoAnta: (prezzoCalcolato.cilindro || 0).toFixed(2),
                    supplementoVetro: (prezzoCalcolato.cerniere || 0).toFixed(2),
                    supplementoColore: ((prezzoCalcolato.supplementoColoreInt || 0) + (prezzoCalcolato.supplementoColoreEst || 0)).toFixed(2),
                    supplementoManiglia: (prezzoCalcolato.maniglia || 0).toFixed(2),
                    supplementoMontante: (prezzoCalcolato.fonoassorbente || 0).toFixed(2),
                    prezzoUnitario: prezzoUnitario.toFixed(2),
                    quantita: quantita,
                    totale: totaleRiga.toFixed(2),
                    _tipoPortoncino: true,
                    _moltiplicatoreTipo: prezzoCalcolato.moltiplicatoreTipo
                });
                
                totaleMateriali += totaleRiga;
                numeroPezzi += quantita;
                
                console.log(`✅ Portoncino Pos ${index + 1}: €${prezzoUnitario.toFixed(2)} (×${prezzoCalcolato.moltiplicatoreTipo})`);
            } else {
                console.warn(`⚠️ Pos ${index + 1}: Misure portoncino non trovate`);
            }
        }
    });
    
    console.log('🔍 Array righe DOPO forEach:', righe.length);
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
        const isInfisso = riga.tipo.toLowerCase().includes('infisso') || 
                          riga.tipo.toLowerCase().includes('finestra') ||
                          riga.tipo.toLowerCase().includes('scorrevole') ||
                          riga.tipo.toLowerCase().includes('hst') ||  // 🆕 v8.475: FIN-Slide HST
                          riga.isFinSlide ||  // 🆕 v8.475: Flag FIN-Slide
                          riga.tipo.toLowerCase().includes('porta');
        const isBlindato = riga.tipo.toLowerCase().includes('blindata') || riga._tipoBlindato;
        const isPortoncino = riga.tipo.toLowerCase().includes('portoncino') || riga._tipoPortoncino;
        const isClickable = isTapparella || isPersiana || isCassonetto || isInfisso || isBlindato || isPortoncino || isMotore;
        
        if (isClickable) {
            tr.style.cursor = 'pointer';
            tr.title = '🔍 Clicca per vedere il dettaglio costi';
            // Colori hover diversi per tipo
            // 🔌 v8.09: Motore = arancione chiaro #ffedd5
            const hoverColor = isTapparella ? '#fef3c7' : isPersiana ? '#f3e8ff' : isCassonetto ? '#ffedd5' : isBlindato ? '#fee2e2' : isPortoncino ? '#fce7f3' : isMotore ? '#fed7aa' : '#dbeafe';
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
    
    // Aggiorna anche appState.rilievoData per export JSON
    if (appState.rilievoData) {
        appState.rilievoData.configPreventivo = configPreventivo;
        appState.rilievoData.clientData = window.currentData.clientData;
    }
    
    console.log('💾 v8.493: configPreventivo salvata:', configPreventivo);
    console.log('💾 v8.493: clientData aggiornato:', window.currentData.clientData);
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
        
        const prezzoCalcolato = calcolaPrezzoPortoncinoFindoor(ptc);
        
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
        return {
            displayName: displayName,
            prodotti: [],
            totali: {
                infissi: 0,
                tapparelle: 0,
                motori: 0,
                persiane: 0,
                cassonetti: 0,
                zanzariere: 0,
                blindate: 0
            },
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
                    // Crea chiave: "posizione-tipoProdotto" es: "1-infisso"
                    let tipoProdotto = 'unknown';
                    if (riga.tipo.toLowerCase().includes('infisso') || riga.tipo.toLowerCase().includes('hst') || riga.tipo.toLowerCase().includes('scorrevole') || riga.tipo.toLowerCase().includes('pf') || riga.tipo.toLowerCase().includes('f1') || riga.tipo.toLowerCase().includes('f2')) tipoProdotto = 'infisso';
                    else if (riga.tipo.toLowerCase().includes('tapparella')) tipoProdotto = 'tapparella';
                    else if (riga.tipo.toLowerCase().includes('persiana')) tipoProdotto = 'persiana';
                    else if (riga.tipo.toLowerCase().includes('zanzariera')) tipoProdotto = 'zanzariera';
                    else if (riga.tipo.toLowerCase().includes('cassonetto')) tipoProdotto = 'cassonetto';
                    else if (riga.tipo.toLowerCase().includes('blindata')) tipoProdotto = 'blindata';
                    else if (riga.tipo.toLowerCase().includes('motore')) tipoProdotto = 'motore';
                    
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
        // Processa ogni tipo di prodotto
        ['infisso', 'tapparella', 'persiana', 'cassonetto', 'zanzariera', 'blindata'].forEach(tipoProdotto => {
            const prodotto = tipoProdotto === 'blindata' ? pos.blindata : pos[tipoProdotto];
            
            // ✅ FIX: Accetta anche quantita undefined/null (tratta come 1)
            // 🔐 v7.98: Per blindata usa campo 'attivo' invece di 'quantita'
            let quantitaProdotto = 0;
            let hasProdotto = false;
            
            if (tipoProdotto === 'blindata') {
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
                    aziendeMap.set(aziendaKey, {
                        displayName: aziendaDisplay,  // Nome per visualizzazione
                        prodotti: [],
                        totali: {
                            infissi: 0,
                            tapparelle: 0,
                            motori: 0,  // v7.998
                            persiane: 0,
                            cassonetti: 0,
                            zanzariere: 0,
                            blindate: 0
                        },
                        posizioniCoinvolte: new Set()
                    });
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
                
                // Aggiorna totali
                if (tipoProdotto === 'infisso') aziendaData.totali.infissi += quantitaProdotto;
                else if (tipoProdotto === 'persiana') aziendaData.totali.persiane += quantitaProdotto;
                else if (tipoProdotto === 'cassonetto') aziendaData.totali.cassonetti += quantitaProdotto;
                else if (tipoProdotto === 'zanzariera') aziendaData.totali.zanzariere += quantitaProdotto;
                else if (tipoProdotto === 'blindata') aziendaData.totali.blindate += quantitaProdotto;
                
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
    
    // Determina quali badge mostrare
    const badges = [];
    if (aziendaData.totali.infissi > 0) badges.push({ label: `${aziendaData.totali.infissi} Infissi`, class: 'infissi' });
    if (aziendaData.totali.tapparelle > 0) badges.push({ label: `${aziendaData.totali.tapparelle} Tapparelle`, class: 'tapparelle' });
    if (aziendaData.totali.motori > 0) badges.push({ label: `${aziendaData.totali.motori} Motori`, class: 'motori' });
    if (aziendaData.totali.persiane > 0) badges.push({ label: `${aziendaData.totali.persiane} Persiane`, class: 'persiane' });
    if (aziendaData.totali.cassonetti > 0) badges.push({ label: `${aziendaData.totali.cassonetti} Cassonetti`, class: 'cassonetti' });
    if (aziendaData.totali.zanzariere > 0) badges.push({ label: `${aziendaData.totali.zanzariere} Zanzariere`, class: 'zanzariere' });
    if (aziendaData.totali.blindate > 0) badges.push({ label: `${aziendaData.totali.blindate} Blindate`, class: 'blindate' });
    
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
    
    // 🆕 v8.500: Lista posizioni con bottone Nuova Posizione
    let html = filteredPositions.map((pos, index) => `
        <div class="position-list-item ${index === currentPositionIndex ? 'active' : ''}" 
             onclick="selectPosition(${index})">
            <div class="position-item-details" style="padding: 0.75rem;">
                <strong>${pos.ambiente || pos.nome || pos.stanza || 'Posizione ' + (index + 1)}</strong>
            </div>
        </div>
    `).join('');
    
    // 🆕 v8.500: Bottone Nuova Posizione
    html += `
        <button class="pm-add-position-btn" onclick="openNewPositionModal()">
            <span>➕</span>
            <span>Nuova Posizione</span>
        </button>
    `;
    
    container.innerHTML = html;
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
            <div class="position-qty">Quantità: ${pos.quantita || 1}</div>
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
    // 🔐 v7.98: Aggiunto blindata
    // 🔧 v8.499: FIX - Supporta sia 'quantita' che 'qta' (editor usa qta)
    const getQty = (prod) => parseInt(prod?.quantita) || parseInt(prod?.qta) || 0;
    
    const hasProdotti = (pos.infisso && getQty(pos.infisso) > 0) ||
                      (pos.tapparella && getQty(pos.tapparella) > 0) ||
                      (pos.cassonetto && getQty(pos.cassonetto) > 0) ||
                      (pos.persiana && getQty(pos.persiana) > 0) ||
                      (pos.zanzariera && getQty(pos.zanzariera) > 0) ||
                      (pos.blindata && (parseInt(pos.blindata.LNP_L) > 0 || parseInt(pos.blindata.LNP_H) > 0 || pos.blindata.versione));
    
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
    
    // ✅ v7.76 FIX: Determina quale prodotto è il PRIMO disponibile (sarà active)
    // 🔐 v7.98: Aggiunto blindata e portoncino
    // 🔌 v8.00: Aggiunto motore come tab separato
    const prodotti = [
        { key: 'infisso', label: '🪟 Infisso', data: pos.infisso },
        { key: 'tapparella', label: '🔽 Tapparella', data: pos.tapparella },
        { key: 'motore', label: '🔌 Motore', data: pos.tapparella?.serveMotore ? pos.tapparella : null },  // v8.00
        { key: 'cassonetto', label: '📦 Cassonetto', data: pos.cassonetto },
        { key: 'persiana', label: '🪟 Persiana', data: pos.persiana },
        { key: 'zanzariera', label: '🦟 Zanzariera', data: pos.zanzariera },
        { key: 'blindata', label: '🔐 Blindata', data: pos.blindata || pos.ingresso?.blindata },
        { key: 'portoncino', label: '🚪 Portoncino', data: pos.portoncino || pos.ingresso?.portoncino }
    ];
    
    // 🆕 v7.82: Filtra solo quelli con quantita > 0 (supporta sia qta che quantita)
    // 🔐 v7.98: Blindata e Portoncino non usano quantita, controlla se esistono
    // 🔌 v8.00: Motore esiste se serveMotore=true
    const prodottiDisponibili = prodotti.filter(p => {
        if (!p.data) return false;
        if (p.key === 'blindata') {
            return parseInt(p.data.LNP_L) > 0 || parseInt(p.data.LNP_H) > 0 || p.data.versione;
        }
        if (p.key === 'portoncino') {
            return p.data.azienda || p.data.modelloAnta || p.data.tipoApertura || p.data.formaTelaio;
        }
        if (p.key === 'motore') {
            // 🔌 v8.00: Motore esiste se serveMotore=true
            return p.data.serveMotore === true;
        }
        if (p.key === 'tapparella') {
            // 🔌 v8.00: Tapparella esiste solo se serveTapparella=true (o undefined per retrocompat)
            const serveTap = p.data.serveTapparella !== false;
            const qty = parseInt(p.data.quantita) || parseInt(p.data.qta) || 0;
            return serveTap && qty > 0;
        }
        const qty = parseInt(p.data.quantita) || parseInt(p.data.qta) || 0;
        return qty > 0;
    });
    
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
    
    // 🆕 v7.82: Supporta sia qta che quantita
    const qty = parseInt(prodotto?.quantita) || parseInt(prodotto?.qta) || 0;
    if (!prodotto || qty === 0) return '';
    
    // 🆕 v8.473: FALLBACK BRM INTELLIGENTE - CORRETTO
    // Se BRM_L/H sono esplicitamente null → usa fallback anche se brm.L/H esistono
    // Priorità: BRM_L/H validi → brm.L/H validi → LF+100/HF+50 → LVT+100/HVT+50
    let brmL = 0;
    let brmH = 0;
    let brmStimato = false;
    let brmOrigine = 'BRM';
    
    // Prima controlla BRM_L/BRM_H (campi nuovi)
    if (prodotto.BRM_L && parseInt(prodotto.BRM_L) > 0) {
        brmL = parseInt(prodotto.BRM_L);
    } else if (prodotto.brm?.L && parseInt(prodotto.brm.L) > 0) {
        // Solo se BRM_L non è esplicitamente null
        if (prodotto.BRM_L !== null) {
            brmL = parseInt(prodotto.brm.L);
        }
    }
    
    if (prodotto.BRM_H && parseInt(prodotto.BRM_H) > 0) {
        brmH = parseInt(prodotto.BRM_H);
    } else if (prodotto.brm?.H && parseInt(prodotto.brm.H) > 0) {
        // Solo se BRM_H non è esplicitamente null
        if (prodotto.BRM_H !== null) {
            brmH = parseInt(prodotto.brm.H);
        }
    }
    
    // FALLBACK 1: LF/HF + 100/50
    if (!brmL && posMisure?.LF) {
        brmL = parseInt(posMisure.LF) + 100;
        brmStimato = true;
        brmOrigine = 'LF+100';
    }
    if (!brmH && posMisure?.HF) {
        brmH = parseInt(posMisure.HF) + 50;
        brmStimato = true;
        brmOrigine = brmOrigine.includes('LF') ? 'LF+100/HF+50' : 'HF+50';
    }
    
    // FALLBACK 2: LVT/HVT + 100/50
    if (!brmL && posMisure?.LVT) {
        brmL = parseInt(posMisure.LVT) + 100;
        brmStimato = true;
        brmOrigine = 'LVT+100';
    }
    if (!brmH && posMisure?.HVT) {
        brmH = parseInt(posMisure.HVT) + 50;
        brmStimato = true;
        brmOrigine = brmOrigine.includes('LVT') ? 'LVT+100/HVT+50' : 'HVT+50';
    }
    
    // FALLBACK 3: TMV/HMT - 40/20
    if (!brmL && posMisure?.TMV) {
        brmL = parseInt(posMisure.TMV) - 40;
        brmStimato = true;
        brmOrigine = 'TMV-40';
    }
    if (!brmH && posMisure?.HMT) {
        brmH = parseInt(posMisure.HMT) - 20;
        brmStimato = true;
        brmOrigine = brmOrigine.includes('TMV') ? 'TMV-40/HMT-20' : 'HMT-20';
    }
    
    const brm = { L: brmL, H: brmH, stimato: brmStimato, origine: brmOrigine };
    
    // Per INFISSI: usa nuovo design con override detection
    if (tipo === 'infisso') {
        return renderInfissoContent(prodotto, brm, isActive);
    }
    
    // 🆕 v7.94: Ottieni config globale per questo tipo di prodotto
    let configGlobale = {};
    if (tipo === 'persiana') {
        configGlobale = projectData?.configPersiana || projectData?.configPersiane || {};
    } else if (tipo === 'tapparella') {
        configGlobale = projectData?.configTapparella || projectData?.configTapparelle || {};
    } else if (tipo === 'cassonetto') {
        configGlobale = projectData?.configCassonetto || projectData?.configCassonetti || {};
    } else if (tipo === 'zanzariera') {
        configGlobale = projectData?.configZanzariera || projectData?.configZanzariere || {};
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
    const quantita = parseInt(tapparella.qta || tapparella.quantita) || 1;
    
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
                    <div class="wall-char-item">
                        <div class="wall-char-label">Modello Anta</div>
                        <div class="wall-char-value" style="font-weight: bold; color: #7c3aed;">${ptc.modelloAnta}</div>
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
        if (pos.infisso && pos.infisso.quantita > 0) {
            materiali.infissi.push({
                tipo: pos.infisso.tipo || 'N/D',
                azienda: pos.infisso.azienda || 'N/D',
                quantita: pos.infisso.quantita,
                brm: pos.infisso.brm || {},
                posizione: pos.ambiente || pos.nome || pos.stanza || pos.id
            });
        }
        
        if (pos.persiana && pos.persiana.quantita > 0) {
            materiali.persiane.push({
                tipo: pos.persiana.tipo || 'Persiana',
                azienda: pos.persiana.azienda || 'N/D',
                quantita: pos.persiana.quantita,
                brm: pos.persiana.brm || {},
                posizione: pos.ambiente || pos.nome || pos.stanza || pos.id
            });
        }
        
        if (pos.tapparella && pos.tapparella.quantita > 0) {
            materiali.tapparelle.push({
                tipo: pos.tapparella.tipo || 'Tapparella',
                motorizzata: pos.tapparella.motorizzazione !== 'manuale',
                azienda: pos.tapparella.azienda || 'N/D',
                quantita: pos.tapparella.quantita,
                brm: pos.tapparella.brm || {},
                posizione: pos.ambiente || pos.nome || pos.stanza || pos.id
            });
        }
        
        if (pos.zanzariera && pos.zanzariera.quantita > 0) {
            materiali.zanzariere.push({
                tipo: pos.zanzariera.tipo || 'Zanzariera',
                quantita: pos.zanzariera.quantita,
                brm: pos.zanzariera.brm || {},
                posizione: pos.ambiente || pos.nome || pos.stanza || pos.id
            });
        }
        
        if (pos.cassonetto && pos.cassonetto.quantita > 0) {
            materiali.cassonetti.push({
                tipo: pos.cassonetto.tipo || 'Cassonetto',
                quantita: pos.cassonetto.quantita,
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
    if (pos.infisso && pos.infisso.quantita > 0) {
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
    if (pos.tapparella && pos.tapparella.quantita > 0 && pos.tapparella.brm) {
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
    if (pos.cassonetto && pos.cassonetto.quantita > 0) {
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
    if (pos.tapparella && pos.tapparella.quantita > 0) {
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
    if (pos.cassonetto && pos.cassonetto.quantita > 0) {
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
    
    if (pos.infisso && pos.infisso.quantita > 0) {
        html += `
            <div class="material-list-item">
                🪟 <strong>Infisso ${pos.infisso.tipo || 'N/D'}</strong> - ${pos.infisso.azienda || 'N/D'}
                <br>Finitura: ${pos.infisso.finitura_int || 'N/D'} / ${pos.infisso.finitura_est || 'N/D'}
                <br>Quantità: ${pos.infisso.quantita}
            </div>
        `;
    }
    
    if (pos.tapparella && pos.tapparella.quantita > 0) {
        html += `
            <div class="material-list-item">
                🪟 <strong>Tapparella</strong> ${pos.tapparella.motorizzazione !== 'manuale' ? '⚡ Motorizzata' : 'Manuale'}
                <br>Azienda: ${pos.tapparella.azienda || 'N/D'}
                <br>Quantità: ${pos.tapparella.quantita}
            </div>
        `;
    }
    
    if (pos.cassonetto && pos.cassonetto.quantita > 0) {
        html += `
            <div class="material-list-item">
                📦 <strong>Cassonetto ${pos.cassonetto.tipo || 'N/D'}</strong>
                <br>Quantità: ${pos.cassonetto.quantita}
            </div>
        `;
    }
    
    if (pos.persiana && pos.persiana.quantita > 0) {
        html += `
            <div class="material-list-item">
                🪟 <strong>Persiana ${pos.persiana.tipo || 'N/D'}</strong>
                <br>Azienda: ${pos.persiana.azienda || 'N/D'}
                <br>Quantità: ${pos.persiana.quantita}
            </div>
        `;
    }
    
    if (pos.zanzariera && pos.zanzariera.quantita > 0) {
        html += `
            <div class="material-list-item">
                🦟 <strong>Zanzariera ${pos.zanzariera.tipo || 'N/D'}</strong>
                <br>Quantità: ${pos.zanzariera.quantita}
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
        
        // Controlla ogni tipo di prodotto
        ['infisso', 'persiana', 'zanzariera', 'cassonetto', 'tapparella'].forEach(tipoProdotto => {
            const prodotto = pos[tipoProdotto];
            
            // Se prodotto esiste e ha quantità > 0
            if (prodotto && (prodotto.quantita > 0 || prodotto.qta > 0)) {
                const qta = prodotto.quantita || prodotto.qta || 1;
                prodottiPosizione.push({
                    tipo: tipoProdotto,
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

        ['infisso', 'persiana', 'zanzariera', 'cassonetto', 'tapparella'].forEach(tipoProdotto => {
            const prodotto = pos[tipoProdotto];
            
            if (prodotto && (prodotto.quantita > 0 || prodotto.qta > 0)) {
                const config = CAMPI_PRODOTTI_POSA[tipoProdotto];
                if (!config) return;

                const qta = prodotto.quantita || prodotto.qta || 1;
                
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
function renderProjectsList(projects) {
    const container = document.getElementById('progetti-list-container');
    const card = document.getElementById('githubProjectsCard');
    
    if (!container) return;
    
    // Mostra card se ci sono progetti
    if (card) {
        card.style.display = projects.length > 0 ? 'block' : 'none';
    }
    
    if (projects.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #718096;">
                Nessun progetto sincronizzato trovato su GitHub
            </div>
        `;
        return;
    }
    
    let html = `
        <div style="padding: 1rem 0;">
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem;">
    `;
    
    projects.forEach(p => {
        const completamentoColor = p.completamento >= 80 ? '#10b981' : 
                                  p.completamento >= 50 ? '#f59e0b' : '#ef4444';
        
        html += `
            <div style="background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); border-radius: 12px; padding: 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.1); cursor: pointer; transition: all 0.2s; border: 2px solid transparent;" 
                 onclick="loadGitHubProject('${p.id}')"
                 onmouseover="this.style.transform='translateY(-4px)'; this.style.borderColor='#6366f1'; this.style.boxShadow='0 8px 16px rgba(99, 102, 241, 0.2)'"
                 onmouseout="this.style.transform='translateY(0)'; this.style.borderColor='transparent'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)'">
                
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                    <h3 style="font-size: 1.1rem; color: #2d3748; margin: 0; font-weight: 700;">${p.nome}</h3>
                    <span style="background: ${completamentoColor}; color: white; padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.85rem; font-weight: 700;">
                        ${p.completamento}%
                    </span>
                </div>
                
                <div style="color: #4a5568; font-size: 0.95rem; margin-bottom: 0.5rem; font-weight: 500;">
                    👤 ${p.cliente}
                </div>
                
                <div style="color: #718096; font-size: 0.9rem; margin-bottom: 0.5rem;">
                    🏠 ${p.ambiente}
                </div>
                
                <div style="color: #718096; font-size: 0.9rem; margin-bottom: 0.5rem;">
                    📍 ${p.posizioni} posizion${p.posizioni !== 1 ? 'i' : 'e'}
                </div>
                
                <div style="color: #a0aec0; font-size: 0.85rem; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                    <span>📅 ${p.dataModifica}</span>
                    <span style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: white; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">GitHub</span>
                </div>
            </div>
        `;
    });
    
    html += `
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

/**
 * Carica progetto specifico da GitHub
 */
/**
 * Converte formato GitHub nel formato compatibile con la dashboard
 */
function convertGitHubToDashboardFormat(githubData) {
    console.log('🔄 Conversione formato GitHub → Dashboard');
    console.log('📦 Dati ricevuti:', githubData);
    console.log('🔍 Campi disponibili:', Object.keys(githubData));
    console.log('📋 configInfissi presente:', !!githubData.configInfissi);
    console.log('📋 configInfissi contenuto:', githubData.configInfissi);
    
    // Se già ha il campo "posizioni", ritorna così com'è
    if (githubData.posizioni && Array.isArray(githubData.posizioni)) {
        console.log('✅ Formato già corretto con posizioni array');
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
                    quantita: parseInt(pos.infisso.qta) || 0,
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
                normalized.persiana = {
                    ...pos.persiana,
                    quantita: parseInt(pos.persiana.qta) || 0,
                    azienda: pos.persiana.azienda || 'Non specificata',
                    modello: pos.persiana.modello || pos.persiana.tipo,
                    brm: {
                        L: pos.persiana.BRM_L || 0,
                        H: pos.persiana.BRM_H || 0
                    },
                    colore: pos.persiana.colorePersiana || pos.persiana.colore
                };
            }
            
            // Normalizza zanzariera
            if (pos.zanzariera) {
                normalized.zanzariera = {
                    ...pos.zanzariera,
                    quantita: parseInt(pos.zanzariera.qta) || 0,
                    azienda: pos.zanzariera.azienda || 'Non specificata',
                    modello: pos.zanzariera.modello || pos.zanzariera.tipo,
                    brm: {
                        L: pos.zanzariera.BRM_L || 0,
                        H: pos.zanzariera.BRM_H || 0
                    },
                    colore: pos.zanzariera.coloreTelaio
                };
            }
            
            // Normalizza tapparella
            if (pos.tapparella) {
                normalized.tapparella = {
                    ...pos.tapparella,
                    quantita: parseInt(pos.tapparella.qta) || 0,
                    azienda: pos.tapparella.azienda || 'Non specificata',
                    brm: {
                        L: pos.tapparella.BRM_L || 0,
                        H: pos.tapparella.BRM_H || 0
                    }
                };
            }
            
            // Normalizza cassonetto
            if (pos.cassonetto) {
                normalized.cassonetto = {
                    ...pos.cassonetto,
                    quantita: parseInt(pos.cassonetto.qta) || 0,
                    azienda: pos.cassonetto.azienda || 'Non specificata',
                    // 🆕 v8.12: Misure rilevate
                    LS: parseInt(pos.cassonetto.LS) || 0,
                    HCASS: parseInt(pos.cassonetto.HCASS) || 0,
                    B: parseInt(pos.cassonetto.B) || 0,
                    C: parseInt(pos.cassonetto.C) || 0,
                    brm: {
                        L: parseInt(pos.cassonetto.BRM_L) || 0,
                        H: parseInt(pos.cassonetto.BRM_H) || parseInt(pos.cassonetto.HCASS) || 0,
                        C: parseInt(pos.cassonetto.BRM_C) || parseInt(pos.cassonetto.C) || 0,
                        B: parseInt(pos.cassonetto.BRM_B) || parseInt(pos.cassonetto.B) || 0
                    }
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
            
            // 🆕 v8.474: FIX CRITICO - BRM con fallback LF+100/HF+50
            ['infisso', 'tapparella', 'persiana', 'zanzariera', 'cassonetto'].forEach(tipoProdotto => {
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
    
    const project = window.githubProjects?.find(p => p.id === projectId);
    if (!project) {
        showAlert('error', 'Progetto non trovato');
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
    
    // LISTINO FINSTRAL PREZZI MEDI
    listino_finstral: {
        telai: {
            "961": { nome: "Base 961", pvc_pvc: 0, pvc_alluminio: 25.0 },
            "965": { nome: "965 Ribassato", pvc_pvc: 8.0, pvc_alluminio: 30.0 },
            "967": { nome: "967 Forma Z", pvc_pvc: 10.9, pvc_alluminio: 35.0 },
            "Z62": { nome: "Z62 Compatto", pvc_pvc: 5.21, pvc_alluminio: 28.0 },
            "Z91": { nome: "Z91 Rinforzato", pvc_pvc: 16.1, pvc_alluminio: 38.0 },
            "962": { nome: "962 Intermedio", pvc_pvc: 17.0, pvc_alluminio: 32.0 },
            "924": { nome: "924 Leggero", pvc_pvc: 18.0, pvc_alluminio: 33.0 },
            "951": { nome: "951 Rinforzato", pvc_pvc: 22.5, pvc_alluminio: 40.0 }
        },
        ante: {
            "classic-line": { nome: "Classic-line", codice: "973", pvc_pvc: 180, pvc_alluminio: 220 },
            "step-line": { nome: "Step-line", codice: "974", pvc_pvc: 190, pvc_alluminio: 230 },
            "nova-line": { nome: "Nova-line", pvc_pvc: 200, pvc_alluminio: 250 },
            "slim-line": { nome: "Slim-line", pvc_pvc: 195, pvc_alluminio: 240 }
        },
        vetri: {
            "doppio": { nome: "Doppio", prezzo: 45 },
            "doppio-sat": { nome: "Doppio Satinato", prezzo: 55 },
            "triplo": { nome: "Triplo", prezzo: 65 },
            "triplo-sat": { nome: "Triplo Satinato", prezzo: 75 }
        }
    },
    
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
            const infQta = parseInt(pos.infisso?.quantita) || parseInt(pos.infisso?.qta) || 0;
            if (pos.infisso && infQta > 0) {
                pos.infisso.quantita = infQta;
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
            const zanzQta = parseInt(pos.zanzariera?.quantita) || parseInt(pos.zanzariera?.qta) || 0;
            if (pos.zanzariera && zanzQta > 0) {
                pos.zanzariera.quantita = zanzQta;
                const voce = this.calcolaVoceZanzariera(pos, idx + 1);
                if (voce.successo) {
                    risultato.voci.push(voce);
                    risultato.totali.materiali += parseFloat(voce.importo);
                } else {
                    risultato.warnings.push(voce.errore);
                }
            }
            
            // PERSIANE - 🆕 v7.82: Supporta sia qta che quantita
            const persQta = parseInt(pos.persiana?.quantita) || parseInt(pos.persiana?.qta) || 0;
            if (pos.persiana && persQta > 0) {
                pos.persiana.quantita = persQta;
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
            const tappQta = parseInt(pos.tapparella?.quantita) || parseInt(pos.tapparella?.qta) || 0;
            if (pos.tapparella && tappQta > 0) {
                // Assicura che quantita sia valorizzato
                pos.tapparella.quantita = tappQta;
                const voce = this.calcolaVoceTapparella(pos, idx + 1);
                if (voce.successo) {
                    risultato.voci.push(voce);
                    risultato.totali.materiali += parseFloat(voce.importo);
                } else {
                    risultato.warnings.push(voce.errore);
                }
            }
            
            // CASSONETTI - 🆕 v7.82: Supporta sia qta che quantita
            const cassQta = parseInt(pos.cassonetto?.quantita) || parseInt(pos.cassonetto?.qta) || 0;
            if (pos.cassonetto && cassQta > 0) {
                pos.cassonetto.quantita = cassQta;
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
            
            // 2. SUPPLEMENTO TELAIO (se diverso da 961 base)
            if (infisso.telaio && infisso.telaio !== '961') {
                const supplementi_telaio = {
                    '965': { pvc_pvc: 8.0, pvc_alluminio: 30.0 },
                    '967': { pvc_pvc: 10.9, pvc_alluminio: 35.0 },
                    'Z62': { pvc_pvc: 5.21, pvc_alluminio: 28.0 },
                    'Z91': { pvc_pvc: 16.1, pvc_alluminio: 38.0 },
                    '962': { pvc_pvc: 17.0, pvc_alluminio: 32.0 },
                    '924': { pvc_pvc: 18.0, pvc_alluminio: 33.0 },
                    '951': { pvc_pvc: 22.5, pvc_alluminio: 40.0 }
                };
                
                const supp_telaio = supplementi_telaio[infisso.telaio];
                if (supp_telaio) {
                    const prezzo_ml = isMaterialePVC ? supp_telaio.pvc_pvc : supp_telaio.pvc_alluminio;
                    const costo = perimetro * prezzo_ml;
                    
                    prezzo_totale += costo;
                    const materiale_label = isMaterialePVC ? 'PVC/PVC' : 'PVC/Alu';
                    dettaglio.push(`Supp.Tel.${infisso.telaio}(${materiale_label}): +${costo.toFixed(0)}€`);
                }
            }
            
            // 3. SUPPLEMENTO MATERIALE (Alluminio su telaio base 961)
            if (!isMaterialePVC && (!infisso.telaio || infisso.telaio === '961')) {
                const costo = perimetro * 25;
                prezzo_totale += costo;
                dettaglio.push(`Rivestimento Alluminio: +${costo.toFixed(0)}€`);
            }
            
            // 4. SUPPLEMENTO ANTA (se diversa da Classic/Step-line base)
            if (infisso.tipoAnta && 
                !['classic-line', 'step-line'].includes(infisso.tipoAnta.toLowerCase())) {
                const supplementi_anta = {
                    'nova-line': { pvc_pvc: 20, pvc_alluminio: 30 },
                    'slim-line': { pvc_pvc: 15, pvc_alluminio: 20 }
                };
                
                const supp_anta = supplementi_anta[infisso.tipoAnta.toLowerCase()];
                if (supp_anta) {
                    const prezzo_mq = isMaterialePVC ? supp_anta.pvc_pvc : supp_anta.pvc_alluminio;
                    const costo = superficie * prezzo_mq;
                    
                    prezzo_totale += costo;
                    dettaglio.push(`Supp.Anta ${infisso.tipoAnta}: +${costo.toFixed(0)}€`);
                }
            }
            
            // 5. SUPPLEMENTO VETRO (se diverso da doppio standard)
            if (infisso.vetro && infisso.vetro !== 'doppio') {
                const supplementi_vetro = {
                    'doppio-sat': 10,
                    'triplo': 20,
                    'triplo-sat': 30
                };
                
                const supp_vetro_mq = supplementi_vetro[infisso.vetro.toLowerCase()];
                if (supp_vetro_mq) {
                    const costo = superficie * supp_vetro_mq;
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
    // ═══ LEGGI DATI GIÀ VISUALIZZATI NELLA UI ═══
    // I dati sono già stati estratti e mostrati - li leggo da lì!
    
    var progetto = window.currentData || window.projectData;
    console.log('📋 Precompila da dati già caricati');
    
    // NOME CLIENTE: già mostrato nell'header
    var clienteDisplay = document.getElementById('projectClientDisplay');
    var nomeCliente = clienteDisplay ? clienteDisplay.textContent.replace('👤 ', '').trim() : '';
    
    // Se vuoto, fallback a dati progetto
    if (!nomeCliente || nomeCliente === 'Cliente Non Specificato') {
        if (progetto) {
            var c = progetto.cliente || progetto.clientData || {};
            nomeCliente = c.nome || c.ragione_sociale || progetto.client || '';
            if (c.cognome) nomeCliente += ' ' + c.cognome;
        }
    }
    
    // INDIRIZZO: da info cliente o progetto
    var indirizzo = '';
    if (progetto) {
        var c = progetto.cliente || progetto.clientData || {};
        var via = c.indirizzo || c.via || progetto.indirizzo || '';
        var citta = c.citta || c.città || progetto.citta || '';
        var cap = c.cap || '';
        indirizzo = via;
        if (citta && indirizzo.indexOf(citta) < 0) {
            indirizzo += (cap ? ', ' + cap : '') + ' ' + citta;
        }
    }
    
    // ALTRI DATI: da progetto
    var telefono = '', email = '', cf = '';
    if (progetto) {
        var c = progetto.cliente || progetto.clientData || {};
        telefono = c.telefono || c.phone || '';
        email = c.email || '';
        cf = c.cf || c.codiceFiscale || c.piva || '';
    }
    
    // OGGETTO: nome progetto già mostrato
    var progettoDisplay = document.getElementById('projectNameDisplay');
    var oggetto = progettoDisplay ? progettoDisplay.textContent.trim() : 'Fornitura e posa serramenti';
    
    // ═══ COMPILA I CAMPI ═══
    document.getElementById('clienteNome').value = nomeCliente;
    document.getElementById('clienteTelefono').value = telefono;
    document.getElementById('clienteEmail').value = email;
    document.getElementById('clienteIndirizzo').value = indirizzo;
    document.getElementById('clienteCF').value = cf;
    document.getElementById('docOggetto').value = oggetto;
    
    // Data odierna
    document.getElementById('docData').value = new Date().toISOString().split('T')[0];
    
    // Numero documento
    var anno = new Date().getFullYear();
    var prefisso = tipo === 'conferma_premium' ? 'ORD-' : 'PREV-';
    document.getElementById('docNumero').value = prefisso + anno + '/';
    
    console.log('✅ Precompilato:', nomeCliente, indirizzo);
}

window.chiudiModalDatiCliente = function() {
    var modal = document.getElementById('modalDatiCliente');
    if (modal) modal.style.display = 'none';
};

function resetFormDatiCliente() {
    var campi = ['clienteNome', 'clienteTelefono', 'clienteIndirizzo', 'clienteEmail', 'clienteCF', 'docNumero', 'docOggetto', 'docNote'];
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

function generaDocumentoPremium(tipo, cliente, doc, righe, totali) {
    var isConferma = tipo === 'conferma_premium';
    var titoloDoc = isConferma ? 'Conferma Ordine' : 'Preventivo';
    var dataObj = new Date(doc.data);
    var dataFormattata = dataObj.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
    
    // ═══ LOGHI BASE64 v8.40 ═══
    var logoBianco = 'data:image/png;base64,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';
    var logoScuro = 'data:image/jpeg;base64,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ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/aAAwDAAABEQIRAD8A9VooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAorlPE3j+w0Zns7ALe3yMyOuSIYmA/iOPmO4gFVPYgkGvO9W8T63rTP9uun8qTg28ZMduAGLqNgODg9C2TwOeKAPWL/AMWeHNMk8m8v4hJudWSPdOyshAYM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LPI8kjebOMs5LMcCQAcntUf/AAgHhL/nw/8AI1x/8doA8dr6Drnv+EA8Jf8APh/5GuP/AI7XQ0AFFFFABRRRQAUUUUAFFFFAHPeP/wDkUr//ALd//R8VeO173qGn2mqWklhfx+bby7d6ZZM7WDjlSp6qO9Y3/CAeEv8Anw/8jXH/AMdoA8drsfhb/wAjBcf9g+T/ANGwV2P/AAgHhL/nw/8AI1x/8dq5pXhjQ9FuGutMtvIleMxs3mSyZUlWIw7sOqigDVooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAK8M8Rf8jBqf8A2ELr/wBGvXudeGeIv+Rg1P8A7CF1/wCjXoAz6KKKAPcvDv8AyL+mf9g+1/8ARSVo1neHf+Rf0z/sH2v/AKKStGgAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACvDPEX/Iwan/2ELr/0a9e514Z4i/5GDU/+whdf+jXoAz6KKKAPcvDv/Iv6Z/2D7X/0UlaNZ3h3/kX9M/7B9r/6KStGgAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACvDPEX/Iwan/ANhC6/8ARr17nXhniL/kYNT/AOwhdf8Ao16AM+iiigD3Lw7/AMi/pn/YPtf/AEUlaNZ3h3/kX9M/7B9r/wCikrRoAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigArwzxF/yMGp/9hC6/9GvXudeGeIv+Rg1P/sIXX/o16AM+iiigD3Lw7/yL+mf9g+1/9FJWjWd4d/5F/TP+wfa/+ikrRoAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigArwzxF/yMGp/wDYQuv/AEa9e514Z4i/5GDU/wDsIXX/AKNegDPooooA9y8O/wDIv6Z/2D7X/wBFJWjWd4d/5F/TP+wfa/8AopK0aACiio7i4t7SFri6lSCJMbpJGEaDJAGSSAOTigCSis7/AISLw/8A9BOz/wDAiH/4uj/hIvD/AP0E7P8A8CIf/i6ANGiiigAorKvvFPh7Tci7v4VZZDG0aN50qsM5DJGHYYxzkdadpviTQtXYJp97FLIzMqxEmKZio3HCOFYjHcDH5UAadFFVLrVdLsZBDe3lvbSMoYJNLHExUkgHDMDjINAFuis7/hIvD/8A0E7P/wACIf8A4upLfWdHu5lt7W+tp5Xztjjmjkc4BJwAxJ4GaALtFV7vUdPsNn2+6htvMzs86RIt23GcbiM4yM1W/wCEi8P/APQTs/8AwIh/+LoA0aKzv+Ei8P8A/QTs/wDwIh/+LqS31nR7uZbe1vraeV87Y45o5HOAScAMSeBmgC7RVCTXtDhkaGbUbSOSNiro08SsrA4IILZBBpv/AAkXh/8A6Cdn/wCBEP8A8XQBo0Vnf8JF4f8A+gnZ/wDgRD/8XWjQAUUVjX3jDw3ptwbW7vkWVc7lRZJtpBKlWMauAwI5B5oA2aKjt7i3u4VuLWVJ4nztkjYSIcEg4IJB5GKkoAKKKoSa9ocMjQzajaRyRsVdGniVlYHBBBbIINAF+is7/hIvD/8A0E7P/wACIf8A4unR69oc0iww6jaSSSMFRFniZmYnAAAbJJNAF+iqVxrOj2kzW91fW0EqY3Ry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FFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQB//2Q==';
    var logoFinestra = 'data:image/png;base64,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';
    
    console.log('📄 generaDocumentoPremium V4');
    console.log('   Righe ricevute:', righe.length);
    console.log('   Cliente:', cliente.nome);
    console.log('   Totali:', totali);
    
    // ═══════════════════════════════════════════════════════════════════════════
    // RAGGRUPPA RIGHE PER POSIZIONE
    // ═══════════════════════════════════════════════════════════════════════════
    var posizioniMap = {};
    righe.forEach(function(r) {
        var pos = r.posizione || 1;
        if (!posizioniMap[pos]) {
            posizioniMap[pos] = { 
                ambiente: r.ambiente || 'Posizione ' + pos, 
                prodotti: [], 
                totale: 0 
            };
        }
        posizioniMap[pos].prodotti.push(r);
        posizioniMap[pos].totale += parseFloat(r._totaleCliente) || 0;
    });
    
    console.log('   Posizioni raggruppate:', Object.keys(posizioniMap).length);
    
    // ═══════════════════════════════════════════════════════════════════════════
    // FUNZIONE SVG PER TIPO FINESTRA (DIN STANDARD)
    // ═══════════════════════════════════════════════════════════════════════════
    function getSVGFinestra(tipo) {
        var tipoLower = (tipo || '').toLowerCase();
        
        // F2 SX - Anta-ribalta SX + Battente DX
        if (tipoLower.indexOf('f2') >= 0 && tipoLower.indexOf('sx') >= 0) {
            return '<svg viewBox="0 0 100 120" style="width:100%;height:auto;max-height:100px"><rect x="5" y="5" width="90" height="110" fill="none" stroke="#1e3a5f" stroke-width="3" rx="2"/><line x1="50" y1="5" x2="50" y2="115" stroke="#1e3a5f" stroke-width="2"/><rect x="9" y="9" width="38" height="102" fill="#e0f2fe" stroke="#1e3a5f" stroke-width="1"/><rect x="53" y="9" width="38" height="102" fill="#e0f2fe" stroke="#1e3a5f" stroke-width="1"/><polyline points="9,9 47,60 9,111" fill="none" stroke="#1e3a5f" stroke-width="1"/><polyline points="9,111 28,9 47,111" fill="none" stroke="#d4a017" stroke-width="1"/><rect x="44" y="56" width="3" height="8" fill="#1e3a5f"/><polyline points="91,111 53,60 91,9" fill="none" stroke="#1e3a5f" stroke-width="1"/></svg>';
        }
        // F2 DX
        if (tipoLower.indexOf('f2') >= 0 && tipoLower.indexOf('dx') >= 0) {
            return '<svg viewBox="0 0 100 120" style="width:100%;height:auto;max-height:100px"><rect x="5" y="5" width="90" height="110" fill="none" stroke="#1e3a5f" stroke-width="3" rx="2"/><line x1="50" y1="5" x2="50" y2="115" stroke="#1e3a5f" stroke-width="2"/><rect x="9" y="9" width="38" height="102" fill="#e0f2fe" stroke="#1e3a5f" stroke-width="1"/><rect x="53" y="9" width="38" height="102" fill="#e0f2fe" stroke="#1e3a5f" stroke-width="1"/><polyline points="9,111 47,60 9,9" fill="none" stroke="#1e3a5f" stroke-width="1"/><polyline points="91,9 53,60 91,111" fill="none" stroke="#1e3a5f" stroke-width="1"/><polyline points="91,111 72,9 53,111" fill="none" stroke="#d4a017" stroke-width="1"/><rect x="53" y="56" width="3" height="8" fill="#1e3a5f"/></svg>';
        }
        // PF2 SX
        if (tipoLower.indexOf('pf') >= 0 && tipoLower.indexOf('sx') >= 0) {
            return '<svg viewBox="0 0 100 160" style="width:100%;height:auto;max-height:120px"><rect x="5" y="5" width="90" height="150" fill="none" stroke="#1e3a5f" stroke-width="3" rx="2"/><line x1="50" y1="5" x2="50" y2="155" stroke="#1e3a5f" stroke-width="2"/><rect x="9" y="9" width="38" height="142" fill="#e0f2fe" stroke="#1e3a5f" stroke-width="1"/><rect x="53" y="9" width="38" height="142" fill="#e0f2fe" stroke="#1e3a5f" stroke-width="1"/><polyline points="9,9 47,80 9,151" fill="none" stroke="#1e3a5f" stroke-width="1"/><polyline points="9,151 28,9 47,151" fill="none" stroke="#d4a017" stroke-width="1"/><rect x="44" y="95" width="3" height="8" fill="#1e3a5f"/><polyline points="91,151 53,80 91,9" fill="none" stroke="#1e3a5f" stroke-width="1"/></svg>';
        }
        // PF2 DX
        if (tipoLower.indexOf('pf') >= 0 && tipoLower.indexOf('dx') >= 0) {
            return '<svg viewBox="0 0 100 160" style="width:100%;height:auto;max-height:120px"><rect x="5" y="5" width="90" height="150" fill="none" stroke="#1e3a5f" stroke-width="3" rx="2"/><line x1="50" y1="5" x2="50" y2="155" stroke="#1e3a5f" stroke-width="2"/><rect x="9" y="9" width="38" height="142" fill="#e0f2fe" stroke="#1e3a5f" stroke-width="1"/><rect x="53" y="9" width="38" height="142" fill="#e0f2fe" stroke="#1e3a5f" stroke-width="1"/><polyline points="9,151 47,80 9,9" fill="none" stroke="#1e3a5f" stroke-width="1"/><polyline points="91,9 53,80 91,151" fill="none" stroke="#1e3a5f" stroke-width="1"/><polyline points="91,151 72,9 53,151" fill="none" stroke="#d4a017" stroke-width="1"/><rect x="53" y="95" width="3" height="8" fill="#1e3a5f"/></svg>';
        }
        // F1 SX
        if (tipoLower.indexOf('f1') >= 0 && tipoLower.indexOf('sx') >= 0 && tipoLower.indexOf('fisso') < 0) {
            return '<svg viewBox="0 0 60 120" style="width:100%;height:auto;max-height:100px"><rect x="5" y="5" width="50" height="110" fill="none" stroke="#1e3a5f" stroke-width="3" rx="2"/><rect x="9" y="9" width="42" height="102" fill="#e0f2fe" stroke="#1e3a5f" stroke-width="1"/><polyline points="9,9 51,60 9,111" fill="none" stroke="#1e3a5f" stroke-width="1"/><polyline points="9,111 30,9 51,111" fill="none" stroke="#d4a017" stroke-width="1"/><rect x="48" y="56" width="3" height="8" fill="#1e3a5f"/></svg>';
        }
        // F1 DX
        if (tipoLower.indexOf('f1') >= 0 && tipoLower.indexOf('dx') >= 0 && tipoLower.indexOf('fisso') < 0) {
            return '<svg viewBox="0 0 60 120" style="width:100%;height:auto;max-height:100px"><rect x="5" y="5" width="50" height="110" fill="none" stroke="#1e3a5f" stroke-width="3" rx="2"/><rect x="9" y="9" width="42" height="102" fill="#e0f2fe" stroke="#1e3a5f" stroke-width="1"/><polyline points="51,9 9,60 51,111" fill="none" stroke="#1e3a5f" stroke-width="1"/><polyline points="51,111 30,9 9,111" fill="none" stroke="#d4a017" stroke-width="1"/><rect x="9" y="56" width="3" height="8" fill="#1e3a5f"/></svg>';
        }
        // F1 generico (senza SX/DX) - v8.485: Default 1 anta anta-ribalta DX
        if (tipoLower.indexOf('f1') >= 0 && tipoLower.indexOf('fisso') < 0 && tipoLower.indexOf('f2') < 0 && tipoLower.indexOf('pf') < 0) {
            return '<svg viewBox="0 0 60 120" style="width:100%;height:auto;max-height:100px"><rect x="5" y="5" width="50" height="110" fill="none" stroke="#1e3a5f" stroke-width="3" rx="2"/><rect x="9" y="9" width="42" height="102" fill="#e0f2fe" stroke="#1e3a5f" stroke-width="1"/><polyline points="51,9 9,60 51,111" fill="none" stroke="#1e3a5f" stroke-width="1"/><polyline points="51,111 30,9 9,111" fill="none" stroke="#d4a017" stroke-width="1"/><rect x="9" y="56" width="3" height="8" fill="#1e3a5f"/></svg>';
        }
        // PF1 generico (senza SX/DX) - v8.485: Default 1 anta porta-finestra
        if (tipoLower.indexOf('pf1') >= 0 && tipoLower.indexOf('fisso') < 0) {
            return '<svg viewBox="0 0 60 160" style="width:100%;height:auto;max-height:120px"><rect x="5" y="5" width="50" height="150" fill="none" stroke="#1e3a5f" stroke-width="3" rx="2"/><rect x="9" y="9" width="42" height="142" fill="#e0f2fe" stroke="#1e3a5f" stroke-width="1"/><polyline points="51,9 9,80 51,151" fill="none" stroke="#1e3a5f" stroke-width="1"/><polyline points="51,151 30,9 9,151" fill="none" stroke="#d4a017" stroke-width="1"/><rect x="9" y="95" width="3" height="8" fill="#1e3a5f"/></svg>';
        }
        // Fisso
        if (tipoLower.indexOf('fisso') >= 0 || tipoLower.indexOf('fix') >= 0) {
            return '<svg viewBox="0 0 60 120" style="width:100%;height:auto;max-height:100px"><rect x="5" y="5" width="50" height="110" fill="none" stroke="#1e3a5f" stroke-width="3" rx="2"/><rect x="9" y="9" width="42" height="102" fill="#e0f2fe" stroke="#1e3a5f" stroke-width="1"/></svg>';
        }
        // Default F2
        return '<svg viewBox="0 0 100 120" style="width:100%;height:auto;max-height:100px"><rect x="5" y="5" width="90" height="110" fill="none" stroke="#1e3a5f" stroke-width="3" rx="2"/><line x1="50" y1="5" x2="50" y2="115" stroke="#1e3a5f" stroke-width="2"/><rect x="9" y="9" width="38" height="102" fill="#e0f2fe" stroke="#1e3a5f" stroke-width="1"/><rect x="53" y="9" width="38" height="102" fill="#e0f2fe" stroke="#1e3a5f" stroke-width="1"/><polyline points="9,9 47,60 9,111" fill="none" stroke="#1e3a5f" stroke-width="1"/><polyline points="9,111 28,9 47,111" fill="none" stroke="#d4a017" stroke-width="1"/><rect x="44" y="56" width="3" height="8" fill="#1e3a5f"/><polyline points="91,111 53,60 91,9" fill="none" stroke="#1e3a5f" stroke-width="1"/></svg>';
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // GENERA HTML POSIZIONI
    // ═══════════════════════════════════════════════════════════════════════════
    var htmlPosizioni = '';
    Object.keys(posizioniMap).sort(function(a,b){return a-b;}).forEach(function(posNum) {
        var pos = posizioniMap[posNum];
        console.log('   Generazione posizione', posNum, ':', pos.prodotti.length, 'prodotti');
        
        // Trova prodotto principale (Infisso, Blindata, Portoncino)
        var infisso = pos.prodotti.find(function(p) { 
            return p.tipo && (p.tipo.indexOf('Infisso') >= 0 || p.tipo.indexOf('Blindata') >= 0 || p.tipo.indexOf('Portoncino') >= 0); 
        });
        
        // Se non trovato, usa il primo prodotto
        if (!infisso && pos.prodotti.length > 0) {
            infisso = pos.prodotti[0];
        }
        
        // Accessori = tutto tranne infisso principale
        var accessori = pos.prodotti.filter(function(p) { return p !== infisso; });
        
        if (!infisso) return;
        
        // Estrai tipo finestra
        var tipoFinestra = (infisso.tipo || 'F2').replace('Infisso ', '').replace('🔐 ', '');
        var svgFinestra = getSVGFinestra(tipoFinestra);
        
        // CARD POSIZIONE
        htmlPosizioni += '<div class="position-card">';
        
        // HEADER
        htmlPosizioni += '<div class="position-header">';
        htmlPosizioni += '<div class="position-number">' + posNum + '</div>';
        htmlPosizioni += '<div class="position-ambiente">' + pos.ambiente + '</div>';
        htmlPosizioni += '<div class="position-total">€ ' + pos.totale.toFixed(2) + '</div>';
        htmlPosizioni += '</div>';
        
        // PRODOTTO PRINCIPALE
        htmlPosizioni += '<div class="main-product">';
        htmlPosizioni += '<div class="product-image">' + svgFinestra + '<div class="product-image-label">' + tipoFinestra + '</div></div>';
        htmlPosizioni += '<div class="product-info">';
        htmlPosizioni += '<div style="display:flex;justify-content:space-between;align-items:flex-start;">';
        htmlPosizioni += '<div><div class="product-title">' + (infisso.tipo || 'INFISSO') + '</div>';
        htmlPosizioni += '<div class="product-subtitle">' + (infisso.azienda || 'Finstral') + ' | Telaio ' + (infisso.telaio || '-') + (infisso.tipoAnta ? ' | ' + infisso.tipoAnta : '') + '</div></div>';
        htmlPosizioni += '<div class="product-price">€ ' + (parseFloat(infisso._totaleCliente) || 0).toFixed(2) + '</div>';
        htmlPosizioni += '</div>';
        htmlPosizioni += '<div class="specs-grid">';
        htmlPosizioni += '<div class="spec-row"><span class="spec-icon">📐</span><span class="spec-label">Dimensioni</span><span class="spec-value">' + (infisso.larghezza || '-') + ' × ' + (infisso.altezza || '-') + ' mm</span></div>';
        htmlPosizioni += '<div class="spec-row"><span class="spec-icon">📏</span><span class="spec-label">Superficie</span><span class="spec-value">' + (infisso.superficie || '-') + ' m²</span></div>';
        
        // VETRO - determina tipo e caratteristiche
        var vetroInfo = infisso.vetro || '-';
        var isTriploVetro = vetroInfo.indexOf('3') >= 0 || vetroInfo.toLowerCase().indexOf('triplo') >= 0;
        var isSatinato = vetroInfo.toLowerCase().indexOf('satinato') >= 0 || vetroInfo.toLowerCase().indexOf('opaco') >= 0;
        var vetroDescrizione = isTriploVetro ? 'Triplo vetro' : 'Doppio vetro';
        if (isSatinato) vetroDescrizione += ' satinato';
        if (vetroInfo !== '-') vetroDescrizione += ' (' + vetroInfo + ')';
        
        htmlPosizioni += '<div class="spec-row"><span class="spec-icon">🔲</span><span class="spec-label">Vetro</span><span class="spec-value">' + vetroDescrizione + '</span></div>';
        htmlPosizioni += '</div></div></div>';
        
        // PRESTAZIONI - Uw basato su vetro
        var uwValue = isTriploVetro ? 'Uw ≤ 1.0 W/m²K' : 'Uw ≤ 1.3 W/m²K';
        htmlPosizioni += '<div class="performance-section"><div class="perf-grid">';
        htmlPosizioni += '<div class="perf-item"><div class="perf-icon">🌡️</div><div class="perf-label">Isolamento Termico</div><div class="perf-value">' + uwValue + '</div></div>';
        htmlPosizioni += '<div class="perf-item"><div class="perf-icon">🔇</div><div class="perf-label">Isolamento Acustico</div><div class="perf-value">Elevato comfort</div></div>';
        htmlPosizioni += '<div class="perf-item"><div class="perf-icon">💨</div><div class="perf-label">Tenuta Aria</div><div class="perf-value">Massima ermeticità</div></div>';
        htmlPosizioni += '</div><div class="perf-note">* Per valori certificati consultare scheda tecnica Finstral</div></div>';
        
        // SERVIZIO
        htmlPosizioni += '<div class="service-section"><div class="service-title">⭐ Il Valore del Nostro Servizio</div>';
        htmlPosizioni += '<div class="service-grid">';
        htmlPosizioni += '<div class="service-item"><span class="service-icon">📱</span><div class="service-name">Rilievo Digitale</div><div class="service-desc">iPad + software proprietario</div></div>';
        htmlPosizioni += '<div class="service-item"><span class="service-icon">📐</span><div class="service-name">Progettazione</div><div class="service-desc">Configurazione 3D su misura</div></div>';
        htmlPosizioni += '<div class="service-item"><span class="service-icon">👥</span><div class="service-name">Team Dedicato</div><div class="service-desc">Personale interno qualificato</div></div>';
        htmlPosizioni += '<div class="service-item"><span class="service-icon">⏱️</span><div class="service-name">Tempi Certi</div><div class="service-desc">Consegne sempre puntuali</div></div>';
        htmlPosizioni += '</div></div>';
        
        // ACCESSORI
        if (accessori.length > 0) {
            htmlPosizioni += '<div class="accessories-section"><div class="accessories-title">📦 Accessori inclusi</div><div class="accessories-grid">';
            accessori.forEach(function(acc) {
                var tipoLower = (acc.tipo || '').toLowerCase();
                var icona = '📦', iconClass = 'altro';
                if (tipoLower.indexOf('tapparella') >= 0) { icona = '🪟'; iconClass = 'tapparella'; }
                else if (tipoLower.indexOf('cassonetto') >= 0) { icona = '📦'; iconClass = 'cassonetto'; }
                else if (tipoLower.indexOf('persiana') >= 0) { icona = '🏠'; iconClass = 'persiana'; }
                else if (tipoLower.indexOf('zanzariera') >= 0) { icona = '🦟'; iconClass = 'zanzariera'; }
                else if (tipoLower.indexOf('motore') >= 0) { icona = '⚡'; iconClass = 'motore'; }
                
                htmlPosizioni += '<div class="accessory-card">';
                htmlPosizioni += '<div class="accessory-icon ' + iconClass + '">' + icona + '</div>';
                htmlPosizioni += '<div class="accessory-info"><div class="accessory-name">' + (acc.tipo || 'Accessorio') + '</div>';
                htmlPosizioni += '<div class="accessory-details">' + (acc.azienda || '') + ' ' + (acc.telaio || '') + '</div></div>';
                htmlPosizioni += '<div class="accessory-price">€ ' + (parseFloat(acc._totaleCliente) || 0).toFixed(2) + '</div>';
                htmlPosizioni += '</div>';
            });
            htmlPosizioni += '</div></div>';
        }
        
        // POSA
        htmlPosizioni += '<div class="posa-section"><div class="posa-title">🔧 Posa in Opera Professionale</div>';
        htmlPosizioni += '<div class="posa-grid">';
        htmlPosizioni += '<div class="posa-item"><span class="posa-icon">🔨</span><div class="posa-content"><div class="posa-name">Installazione Certificata</div><div class="posa-desc">Posa a regola d\'arte con materiali RAL</div></div></div>';
        htmlPosizioni += '<div class="posa-item"><span class="posa-icon">🗑️</span><div class="posa-content"><div class="posa-name">Smontaggio + Smaltimento</div><div class="posa-desc">Rimozione infissi e conferimento</div></div></div>';
        htmlPosizioni += '<div class="posa-item"><span class="posa-icon">✅</span><div class="posa-content"><div class="posa-name">Collaudo Finale</div><div class="posa-desc">Verifica funzionamento e pulizia</div></div></div>';
        htmlPosizioni += '</div></div>';
        
        htmlPosizioni += '</div>'; // fine position-card
    });
    
    // ═══════════════════════════════════════════════════════════════════════════
    // COSTRUISCI DOCUMENTO COMPLETO
    // ═══════════════════════════════════════════════════════════════════════════
    var html = '<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><title>' + titoloDoc + ' - ' + cliente.nome + '</title>';
    html += '<style>';
    html += '@page{size:A4;margin:10mm}';
    html += '*{box-sizing:border-box;margin:0;padding:0}';
    html += 'body{font-family:"Segoe UI",Tahoma,sans-serif;font-size:10pt;line-height:1.4;color:#1f2937;background:#f8fafc}';
    
    // COPERTINA
    html += '.cover-page{height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;background:linear-gradient(135deg,#1e3a5f 0%,#2d5a87 50%,#1e3a5f 100%);color:white;text-align:center;page-break-after:always;position:relative}';
    html += '.cover-title{font-size:36pt;font-weight:300;letter-spacing:6px;margin-bottom:10px;text-transform:uppercase}';
    html += '.cover-subtitle{font-size:12pt;opacity:0.7;margin-bottom:50px;letter-spacing:2px}';
    html += '.cover-cliente-box{background:rgba(255,255,255,0.1);padding:30px 50px;border-radius:12px}';
    html += '.cover-cliente{font-size:20pt;font-weight:600;margin-bottom:8px}';
    html += '.cover-indirizzo{font-size:12pt;opacity:0.9}';
    html += '.cover-data{position:absolute;bottom:40px;font-size:11pt;opacity:0.6}';
    html += '.cover-numero{position:absolute;top:30px;right:30px;background:rgba(255,255,255,0.15);padding:12px 25px;border-radius:8px;font-size:11pt}';
    html += '.cover-badges{display:flex;gap:40px;margin-top:50px}';
    html += '.cover-badge{display:flex;flex-direction:column;align-items:center;background:rgba(255,255,255,0.08);padding:15px 20px;border-radius:12px;min-width:100px}';
    html += '.cover-badge-icon{font-size:26pt;margin-bottom:8px}';
    html += '.cover-badge-text{font-size:8pt;text-transform:uppercase;letter-spacing:1px;font-weight:600}';
    
    // PAGINE CONTENUTO
    html += '.content-page{background:white;padding:25px;margin:20px auto;max-width:210mm;box-shadow:0 4px 20px rgba(0,0,0,0.1)}';
    html += '@media print{.content-page{margin:0;box-shadow:none;page-break-after:always}.no-print{display:none!important}body{background:white}}';
    
    // HEADER PAGINA
    html += '.page-header{display:flex;justify-content:space-between;align-items:center;padding-bottom:15px;border-bottom:2px solid #1e3a5f;margin-bottom:25px}';
    html += '.page-header-info{text-align:right;font-size:9pt;color:#6b7280}';
    html += '.page-header-doc{font-weight:700;color:#1e3a5f;font-size:11pt}';
    
    // POSIZIONE CARD
    html += '.position-card{border:2px solid #1e3a5f;border-radius:16px;margin-bottom:25px;overflow:hidden;page-break-inside:avoid}';
    html += '.position-header{background:linear-gradient(135deg,#1e3a5f 0%,#2d5a87 100%);color:white;padding:15px 25px;display:flex;justify-content:space-between;align-items:center}';
    html += '.position-number{background:white;color:#1e3a5f;width:45px;height:45px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18pt}';
    html += '.position-ambiente{font-size:16pt;font-weight:600;flex:1;margin-left:20px}';
    html += '.position-total{font-size:18pt;font-weight:700;background:rgba(255,255,255,0.2);padding:8px 20px;border-radius:8px}';
    
    // PRODOTTO PRINCIPALE
    html += '.main-product{display:flex;padding:20px;gap:25px;background:#f8fafc;border-bottom:1px solid #e5e7eb}';
    html += '.product-image{width:120px;min-width:120px;display:flex;flex-direction:column;align-items:center;justify-content:center}';
    html += '.product-image-label{margin-top:8px;font-weight:700;color:#1e3a5f;font-size:9pt;text-align:center}';
    html += '.product-info{flex:1}';
    html += '.product-title{font-size:13pt;font-weight:700;color:#1e3a5f;margin-bottom:3px}';
    html += '.product-subtitle{font-size:9pt;color:#6b7280;margin-bottom:10px}';
    html += '.product-price{font-size:15pt;font-weight:700;color:#059669}';
    html += '.specs-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px 12px}';
    html += '.spec-row{display:flex;align-items:center;gap:5px;font-size:8.5pt}';
    html += '.spec-icon{font-size:11pt;width:20px;text-align:center}';
    html += '.spec-label{color:#6b7280;min-width:65px}';
    html += '.spec-value{font-weight:600;color:#1f2937}';
    
    // PRESTAZIONI
    html += '.performance-section{padding:12px 20px;background:white;border-bottom:1px solid #e5e7eb}';
    html += '.perf-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:15px}';
    html += '.perf-item{text-align:center}';
    html += '.perf-icon{font-size:18pt;margin-bottom:5px}';
    html += '.perf-icon-svg{margin-bottom:5px;display:flex;justify-content:center}';
    html += '.perf-label{font-size:8pt;color:#6b7280;margin-bottom:3px}';
    html += '.perf-value{font-size:10pt;font-weight:700;color:#1e3a5f}';
    html += '.perf-note{font-size:7pt;color:#9ca3af;font-style:italic;margin-top:8px;text-align:right}';
    
    // SERVIZIO
    html += '.service-section{background:linear-gradient(135deg,#fef3c7 0%,#fde68a 100%);padding:15px 20px;border-bottom:1px solid #f59e0b}';
    html += '.service-title{font-size:9pt;font-weight:700;color:#92400e;margin-bottom:12px;text-transform:uppercase;letter-spacing:1px}';
    html += '.service-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}';
    html += '.service-item{background:white;padding:12px;border-radius:10px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.06);border:1px solid rgba(245,158,11,0.3)}';
    html += '.service-icon{font-size:20pt;display:block;margin-bottom:5px}';
    html += '.service-name{font-weight:700;font-size:8pt;color:#78350f}';
    html += '.service-desc{font-size:7pt;color:#92400e}';
    
    // ACCESSORI
    html += '.accessories-section{padding:15px 20px;background:white;border-bottom:1px solid #e5e7eb}';
    html += '.accessories-title{font-size:9pt;font-weight:700;color:#374151;margin-bottom:12px;text-transform:uppercase}';
    html += '.accessories-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}';
    html += '.accessory-card{display:flex;align-items:center;gap:12px;padding:10px 12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px}';
    html += '.accessory-icon{width:40px;height:40px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18pt}';
    html += '.accessory-icon.tapparella{background:#dbeafe}';
    html += '.accessory-icon.cassonetto{background:#f3e8ff}';
    html += '.accessory-icon.motore{background:#fef3c7}';
    html += '.accessory-icon.zanzariera{background:#d1fae5}';
    html += '.accessory-icon.persiana{background:#fee2e2}';
    html += '.accessory-info{flex:1}';
    html += '.accessory-name{font-weight:700;font-size:9pt;color:#1f2937}';
    html += '.accessory-details{font-size:7pt;color:#6b7280}';
    html += '.accessory-price{font-weight:700;font-size:11pt;color:#059669}';
    
    // POSA
    html += '.posa-section{background:linear-gradient(135deg,#ecfdf5 0%,#d1fae5 100%);padding:15px 20px;border-top:2px solid #10b981}';
    html += '.posa-title{font-size:9pt;font-weight:700;color:#065f46;margin-bottom:12px;text-transform:uppercase}';
    html += '.posa-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}';
    html += '.posa-item{display:flex;align-items:flex-start;gap:10px;background:white;padding:12px;border-radius:10px;border-left:3px solid #10b981}';
    html += '.posa-icon{font-size:18pt}';
    html += '.posa-name{font-weight:700;font-size:8pt;color:#065f46}';
    html += '.posa-desc{font-size:7pt;color:#047857}';
    
    // RIEPILOGO
    html += '.summary-section{border:2px solid #1e3a5f;border-radius:16px;overflow:hidden;margin-top:25px}';
    html += '.summary-header{background:linear-gradient(135deg,#1e3a5f 0%,#2d5a87 100%);color:white;padding:15px 25px;font-size:14pt;font-weight:600}';
    html += '.summary-body{padding:20px 25px}';
    html += '.summary-row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:11pt}';
    html += '.summary-row.total{background:linear-gradient(135deg,#1e3a5f 0%,#2d5a87 100%);color:white;margin:15px -25px -20px;padding:18px 25px;font-size:16pt;font-weight:700;border:none}';
    // v8.492: CSS per layout 2 colonne Imponibile/IVA
    html += '.summary-columns{display:flex;gap:20px;margin-bottom:15px}';
    html += '.summary-col{flex:1;min-width:0}';
    html += '.summary-col-header{font-weight:700;font-size:12pt;color:#1e3a5f;padding:10px 0;border-bottom:2px solid #1e3a5f;margin-bottom:10px}';
    html += '.summary-col-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:10pt}';
    html += '.summary-col-total{display:flex;justify-content:space-between;padding:12px 0;font-weight:700;font-size:11pt;border-top:2px solid #e5e7eb;margin-top:10px}';
    
    // PRINT
    html += '.print-btn{position:fixed;top:20px;right:20px;background:linear-gradient(135deg,#1e3a5f 0%,#2d5a87 100%);color:white;border:none;padding:15px 30px;border-radius:12px;cursor:pointer;font-size:14pt;font-weight:600;box-shadow:0 4px 20px rgba(30,58,95,0.4);z-index:1000}';
    html += '</style></head><body>';
    
    // PULSANTE STAMPA
    html += '<button class="print-btn no-print" onclick="window.print()">🖨️ Stampa PDF</button>';
    
    // COPERTINA
    html += '<div class="cover-page">';
    html += '<div class="cover-numero">' + doc.numero + '</div>';
    html += '<img src="' + logoBianco + '" alt="Open Porte & Finestre" style="max-width:280px;margin-bottom:30px">';
    html += '<div class="cover-title">' + titoloDoc + '</div>';
    html += '<div class="cover-subtitle">Serramenti e Infissi di Qualità</div>';
    html += '<div class="cover-cliente-box"><div class="cover-cliente">' + cliente.nome + '</div>';
    html += '<div class="cover-indirizzo">' + cliente.indirizzo + '</div></div>';
    html += '<div class="cover-badges">';
    html += '<div class="cover-badge"><span class="cover-badge-icon">📱</span><span class="cover-badge-text">Rilievo Digitale</span></div>';
    html += '<div class="cover-badge"><span class="cover-badge-icon">👥</span><span class="cover-badge-text">Team Dedicato</span></div>';
    html += '<div class="cover-badge"><span class="cover-badge-icon">⏱️</span><span class="cover-badge-text">Tempi Certi</span></div>';
    html += '<div class="cover-badge"><span class="cover-badge-icon">🛡️</span><span class="cover-badge-text">Garanzia 10 Anni</span></div>';
    html += '</div>';
    html += '<div class="cover-data">' + dataFormattata + '</div>';
    html += '</div>';
    
    // PAGINA CHI SIAMO
    html += '<div class="content-page chi-siamo-page" style="display:flex;flex-direction:column;justify-content:center;align-items:center;min-height:90vh">';
    html += '<img src="' + logoFinestra + '" alt="Open Porte & Finestre" style="max-width:450px;margin-bottom:35px">';
    html += '<div style="max-width:650px;text-align:center">';
    html += '<h2 style="color:#1e3a5f;font-size:20pt;margin-bottom:25px">Selezioniamo il Meglio per Voi</h2>';
    html += '<p style="font-size:11pt;line-height:1.8;color:#4b5563;margin-bottom:15px">Non siamo produttori, siamo <strong>selezionatori</strong>. Scegliamo tra i brand più innovativi del mercato il prodotto perfetto per ogni esigenza: <strong>Finstral</strong> per gli infissi, <strong>Oikos</strong> per le porte blindate, <strong>FerreroLegno</strong> e <strong>Flessya</strong> per gli interni, <strong>Somfy</strong> per l\'automazione.</p>';
    html += '<p style="font-size:11pt;line-height:1.8;color:#4b5563;margin-bottom:15px">Il nostro valore? <strong>Collegare</strong> prodotto, posa e assistenza in un unico flusso. Dal <strong>rilievo digitale</strong> alla <strong>progettazione 3D</strong>, dalla <strong>posa con squadre interne</strong> al <strong>post-vendita garantito</strong>.</p>';
    html += '<p style="font-size:11pt;line-height:1.8;color:#4b5563">Ogni intervento è eseguito da <strong>posatori interni e collaboratori di fiducia</strong>, perché la qualità non finisce con la scelta del prodotto: si completa con l\'installazione a regola d\'arte.</p>';
    html += '</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:25px;margin-top:40px;max-width:700px">';
    html += '<div style="text-align:center;padding:15px"><div style="font-size:11pt;margin-bottom:8px">🏆</div><div style="font-size:9pt;color:#1e3a5f;font-weight:600">Brand Selezionati</div><div style="font-size:8pt;color:#6b7280">Solo i migliori</div></div>';
    html += '<div style="text-align:center;padding:15px"><div style="font-size:11pt;margin-bottom:8px">📱</div><div style="font-size:9pt;color:#1e3a5f;font-weight:600">Rilievo Digitale</div><div style="font-size:8pt;color:#6b7280">Precisione millimetrica</div></div>';
    html += '<div style="text-align:center;padding:15px"><div style="font-size:11pt;margin-bottom:8px">👷</div><div style="font-size:9pt;color:#1e3a5f;font-weight:600">Posa Interna</div><div style="font-size:8pt;color:#6b7280">Team di fiducia</div></div>';
    html += '<div style="text-align:center;padding:15px"><div style="font-size:11pt;margin-bottom:8px">🛡️</div><div style="font-size:9pt;color:#1e3a5f;font-weight:600">Post-Vendita</div><div style="font-size:8pt;color:#6b7280">Sempre al tuo fianco</div></div>';
    html += '</div>';
    html += '</div>';
    
    // PAGINA CONTENUTO
    html += '<div class="content-page">';
    html += '<div class="page-header"><div><img src="' + logoScuro + '" alt="Open" style="height:40px"></div>';
    html += '<div class="page-header-info"><div class="page-header-doc">' + doc.numero + '</div>' + dataFormattata + '</div></div>';
    
    // POSIZIONI
    html += htmlPosizioni;
    
    // RIEPILOGO - v8.492: Layout 2 colonne Imponibile/IVA
    html += '<div class="summary-section"><div class="summary-header">💰 Riepilogo Economico</div><div class="summary-body">';
    
    // v8.492: Calcola valori prima di costruire HTML
    var imponibileNum = parseFloat((totali.subtotale || '€ 0').replace(/[€\s]/g, '').replace(',', '.')) || 0;
    var iva10Num = parseFloat((totali.iva10 || '€ 0').replace(/[€\s]/g, '').replace(',', '.')) || 0;
    var iva22Num = parseFloat((totali.iva22 || '€ 0').replace(/[€\s]/g, '').replace(',', '.')) || 0;
    var ivaTotaleNum = iva10Num + iva22Num;
    
    // v8.492: Contenitore 2 colonne
    html += '<div class="summary-columns">';
    
    // COLONNA SINISTRA: IMPONIBILE
    html += '<div class="summary-col">';
    html += '<div class="summary-col-header">IMPONIBILE</div>';
    html += '<div class="summary-col-row"><span>Totale Materiali</span><span>' + totali.materiali + '</span></div>';
    html += '<div class="summary-col-row"><span>Posa in Opera</span><span>' + totali.lavori + '</span></div>';
    
    // ENEA incluso se checked
    if (totali.enea && totali.enea.checked && totali.enea.valore !== 0) {
        html += '<div class="summary-col-row"><span>Pratica ENEA</span><span>€ ' + totali.enea.valore.toFixed(2) + '</span></div>';
    }
    
    // Voci Extra incluse se checked
    if (totali.voceExtra1 && totali.voceExtra1.checked && totali.voceExtra1.valore !== 0) {
        var nomeVoce1 = totali.voceExtra1.nome || 'Voce aggiuntiva';
        html += '<div class="summary-col-row"><span>' + nomeVoce1 + '</span><span>€ ' + totali.voceExtra1.valore.toFixed(2) + '</span></div>';
    }
    if (totali.voceExtra2 && totali.voceExtra2.checked && totali.voceExtra2.valore !== 0) {
        var nomeVoce2 = totali.voceExtra2.nome || 'Voce aggiuntiva';
        html += '<div class="summary-col-row"><span>' + nomeVoce2 + '</span><span>€ ' + totali.voceExtra2.valore.toFixed(2) + '</span></div>';
    }
    
    // Totale Imponibile
    html += '<div class="summary-col-total"><span>Totale Imponibile</span><span>€ ' + imponibileNum.toFixed(2) + '</span></div>';
    html += '</div>'; // Fine colonna sinistra
    
    // COLONNA DESTRA: IVA
    html += '<div class="summary-col">';
    html += '<div class="summary-col-header">IVA</div>';
    
    if (totali.iva10) {
        html += '<div class="summary-col-row"><span>IVA 10% su ' + totali.imponibile10 + '</span><span>' + totali.iva10 + '</span></div>';
    }
    if (totali.iva22) {
        html += '<div class="summary-col-row"><span>IVA 22% su ' + totali.imponibile22 + '</span><span>' + totali.iva22 + '</span></div>';
    }
    
    // Se non c'è IVA, mostra messaggio
    if (!totali.iva10 && !totali.iva22) {
        html += '<div class="summary-col-row" style="color:#6b7280;font-style:italic"><span>Nessuna IVA applicata</span><span>-</span></div>';
    }
    
    // Totale IVA
    html += '<div class="summary-col-total"><span>Totale IVA</span><span>€ ' + ivaTotaleNum.toFixed(2) + '</span></div>';
    html += '</div>'; // Fine colonna destra
    
    html += '</div>'; // Fine summary-columns
    
    // TOTALE PREVENTIVO
    html += '<div class="summary-row total"><span>TOTALE ' + titoloDoc.toUpperCase() + '</span><span>' + totali.totaleFinale + '</span></div>';
    html += '</div></div>';
    
    // v8.491: Voci eventuali NON incluse nel totale (non checked ma con valore != 0)
    var vociEventuali = '';
    if (totali.enea && !totali.enea.checked && totali.enea.valore !== 0) {
        vociEventuali += '<div style="margin-top:10px;padding:10px 15px;background:#fef3c7;border-radius:8px;font-size:9pt;">📄 Eventuale pratica ENEA: <strong>€ ' + totali.enea.valore.toFixed(2) + '</strong> (IVA 22%)</div>';
    }
    if (totali.voceExtra1 && !totali.voceExtra1.checked && totali.voceExtra1.valore !== 0) {
        var nomeVoce1Ev = totali.voceExtra1.nome || 'Voce aggiuntiva';
        vociEventuali += '<div style="margin-top:10px;padding:10px 15px;background:#f5f3ff;border-radius:8px;font-size:9pt;">📝 Eventuale ' + nomeVoce1Ev + ': <strong>€ ' + totali.voceExtra1.valore.toFixed(2) + '</strong> (IVA ' + totali.voceExtra1.iva + '%)</div>';
    }
    if (totali.voceExtra2 && !totali.voceExtra2.checked && totali.voceExtra2.valore !== 0) {
        var nomeVoce2Ev = totali.voceExtra2.nome || 'Voce aggiuntiva';
        vociEventuali += '<div style="margin-top:10px;padding:10px 15px;background:#fdf4ff;border-radius:8px;font-size:9pt;">📝 Eventuale ' + nomeVoce2Ev + ': <strong>€ ' + totali.voceExtra2.valore.toFixed(2) + '</strong> (IVA ' + totali.voceExtra2.iva + '%)</div>';
    }
    if (vociEventuali) {
        html += vociEventuali;
    }
    
    // FOOTER
    html += '<div style="margin-top:30px;font-size:8pt;color:#6b7280"><strong>Validità:</strong> 30 giorni | <strong>Tempi:</strong> ' + doc.tempiConsegna + '</div>';
    html += '</div>';
    
    html += '</body></html>';
    
    return html;
}
function generaHTMLDocumentoStampa(tipo, cliente, doc, righe, totali) {
    var isPreventivo = tipo === 'preventivo';
    var titoloDoc = isPreventivo ? 'PREVENTIVO' : 'CONFERMA D\'ORDINE';
    var dataObj = new Date(doc.data);
    var dataFormattata = dataObj.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
    
    var tipiIntervento = {
        'nessuna': 'Senza IVA',
        'manutenzione': 'Manutenzione ordinaria/straordinaria',
        'ristrutturazione': 'Ristrutturazione edilizia',
        'nuova_costruzione_prima': 'Nuova costruzione - Prima casa',
        'nuova_costruzione_altra': 'Nuova costruzione - Altra abitazione',
        'sola_fornitura': 'Sola fornitura materiali'
    };
    var descIntervento = tipiIntervento[totali.tipoIntervento] || '';
    
    // Righe tabella
    var righeHtml = '';
    righe.forEach(function(riga, i) {
        var prezzoCliente = riga._totaleCliente || riga.totale;
        righeHtml += '<tr>' +
            '<td style="text-align:center;">' + (i + 1) + '</td>' +
            '<td>' + (riga.ambiente || '') + '</td>' +
            '<td>' + (riga.tipo || '') + (riga.azienda ? ' - ' + riga.azienda : '') + '</td>' +
            '<td style="text-align:center;">' + (riga.larghezza || '') + '×' + (riga.altezza || '') + '</td>' +
            '<td style="text-align:center;">' + (riga.quantita || 1) + '</td>' +
            '<td style="text-align:right;font-weight:600;">€ ' + parseFloat(prezzoCliente).toFixed(2) + '</td>' +
            '</tr>';
    });
    
    // Acconto per conferma
    var accontoHtml = '';
    if (!isPreventivo) {
        var totaleNum = parseFloat(totali.totaleFinale.replace(/[€\s.]/g, '').replace(',', '.')) || 0;
        var acconto = totaleNum * (doc.accontoPct / 100);
        var saldo = totaleNum - acconto;
        accontoHtml = '<tr style="background:#fef3c7;">' +
            '<td colspan="4" style="text-align:right;font-weight:600;">Acconto alla conferma (' + doc.accontoPct + '%):</td>' +
            '<td style="text-align:right;font-weight:700;color:#d97706;">€ ' + acconto.toFixed(2) + '</td></tr>' +
            '<tr><td colspan="4" style="text-align:right;font-weight:600;">Saldo alla consegna:</td>' +
            '<td style="text-align:right;font-weight:600;">€ ' + saldo.toFixed(2) + '</td></tr>';
    }
    
    return '<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><title>' + titoloDoc + ' ' + doc.numero + '</title>' +
        '<style>@page{size:A4;margin:15mm}*{box-sizing:border-box;margin:0;padding:0}body{font-family:Segoe UI,Tahoma,sans-serif;font-size:11pt;line-height:1.4;color:#1f2937;padding:20px}' +
        '.header{display:flex;justify-content:space-between;margin-bottom:30px;padding-bottom:20px;border-bottom:3px solid #2563eb}' +
        '.azienda-nome{font-size:14pt;font-weight:700;color:#1e40af}' +
        '.azienda-info{text-align:right;font-size:9pt;color:#4b5563}' +
        '.documento-info{display:flex;justify-content:space-between;margin-bottom:25px}' +
        '.tipo-documento{font-size:18pt;font-weight:700;color:#1e40af;padding:10px 20px;background:linear-gradient(135deg,#dbeafe,#bfdbfe);border-radius:8px}' +
        '.numero-data{text-align:right}.numero-data .numero{font-size:14pt;font-weight:700}.numero-data .data{color:#6b7280}' +
        '.cliente-box{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:15px;margin-bottom:25px}' +
        '.cliente-box h4{color:#374151;margin-bottom:10px;font-size:10pt;text-transform:uppercase}' +
        '.cliente-nome{font-size:13pt;font-weight:700;color:#111827}.cliente-dettagli{color:#4b5563;margin-top:5px}' +
        '.oggetto{background:#eff6ff;padding:12px 15px;border-left:4px solid #2563eb;margin-bottom:20px}' +
        '.oggetto-label{font-size:9pt;color:#6b7280;text-transform:uppercase}.oggetto-testo{font-weight:600;color:#1e40af}' +
        'table{width:100%;border-collapse:collapse;margin-bottom:20px}' +
        'th{background:#1e40af;color:white;padding:10px 8px;text-align:left;font-size:10pt}' +
        'td{padding:8px;border-bottom:1px solid #e5e7eb;font-size:10pt}tr:nth-child(even){background:#f9fafb}' +
        '.totali-table{width:50%;margin-left:auto}.totali-table td{padding:6px 10px}' +
        '.totale-finale{background:#1e40af;color:white;font-size:14pt;font-weight:700}' +
        '.condizioni{margin-top:30px;font-size:9pt;color:#6b7280}.condizioni h4{color:#374151;margin-bottom:10px}.condizioni ul{margin-left:20px}.condizioni li{margin-bottom:5px}' +
        '.firma-section{margin-top:40px;display:flex;justify-content:space-between}.firma-box{width:45%}.firma-box h5{font-size:10pt;color:#374151;margin-bottom:40px}.firma-linea{border-top:1px solid #9ca3af;padding-top:5px;font-size:9pt;color:#6b7280}' +
        '.footer{margin-top:40px;padding-top:15px;border-top:2px solid #e5e7eb;text-align:center;font-size:8pt;color:#9ca3af}' +
        '.print-btn{position:fixed;top:20px;right:20px;background:#2563eb;color:white;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;font-size:14pt;font-weight:600}' +
        '@media print{.print-btn{display:none}}</style></head><body>' +
        '<button class="print-btn" onclick="window.print()">🖨️ Stampa PDF</button>' +
        '<div class="header"><div><div class="azienda-nome">OPEN PORTE & FINESTRE</div><div style="font-size:10pt;color:#4b5563;margin-top:5px">Serramenti di qualità</div></div>' +
        '<div class="azienda-info"><div>Via Example 123 - 24100 Bergamo</div><div>Tel. 035 123456</div><div>P.IVA 01234567890</div></div></div>' +
        '<div class="documento-info"><div class="tipo-documento">' + titoloDoc + '</div><div class="numero-data"><div class="numero">' + doc.numero + '</div><div class="data">' + dataFormattata + '</div></div></div>' +
        '<div class="cliente-box"><h4>Intestatario</h4><div class="cliente-nome">' + cliente.nome + '</div><div class="cliente-dettagli">' +
        (cliente.indirizzo ? cliente.indirizzo + '<br>' : '') +
        (cliente.telefono ? 'Tel. ' + cliente.telefono : '') + (cliente.email ? ' - ' + cliente.email : '') +
        (cliente.cf ? '<br>C.F./P.IVA: ' + cliente.cf : '') + '</div></div>' +
        '<div class="oggetto"><div class="oggetto-label">Oggetto</div><div class="oggetto-testo">' + doc.oggetto + '</div>' +
        (descIntervento ? '<div style="font-size:9pt;color:#6b7280;margin-top:5px">Tipo intervento: ' + descIntervento + '</div>' : '') + '</div>' +
        '<table><thead><tr><th style="width:5%;text-align:center">N.</th><th style="width:15%">Ambiente</th><th style="width:40%">Descrizione</th><th style="width:15%;text-align:center">Misure</th><th style="width:8%;text-align:center">Qtà</th><th style="width:17%;text-align:right">Importo</th></tr></thead><tbody>' + righeHtml + '</tbody></table>' +
        '<table class="totali-table"><tr><td colspan="4" style="text-align:right">Totale Materiali:</td><td style="text-align:right;font-weight:600">' + totali.materiali + '</td></tr>' +
        '<tr><td colspan="4" style="text-align:right">Posa e installazione:</td><td style="text-align:right">' + totali.lavori + '</td></tr>' +
        '<tr style="border-top:2px solid #d1d5db"><td colspan="4" style="text-align:right;font-weight:600">Imponibile:</td><td style="text-align:right;font-weight:600">' + totali.subtotale + '</td></tr>' +
        (totali.iva10 ? '<tr><td colspan="4" style="text-align:right;font-size:9pt">IVA 10%:</td><td style="text-align:right">' + totali.iva10 + '</td></tr>' : '') +
        (totali.iva22 ? '<tr><td colspan="4" style="text-align:right;font-size:9pt">IVA 22%:</td><td style="text-align:right">' + totali.iva22 + '</td></tr>' : '') +
        '<tr class="totale-finale"><td colspan="4" style="text-align:right;padding:12px">TOTALE:</td><td style="text-align:right;padding:12px">' + totali.totaleFinale + '</td></tr>' + accontoHtml + '</table>' +
        (doc.note ? '<div style="margin-top:30px;padding:15px;background:#fffbeb;border:1px solid #fbbf24;border-radius:8px"><h4 style="color:#92400e;margin-bottom:8px">📝 Note</h4><p>' + doc.note + '</p></div>' : '') +
        '<div class="condizioni"><h4>' + (isPreventivo ? 'Condizioni di Offerta' : 'Condizioni Contrattuali') + '</h4><ul>' +
        (isPreventivo ? '<li><strong>Validità:</strong> 30 giorni</li><li>Prezzi per merce resa in cantiere, posa inclusa</li><li>Escluse opere murarie e ponteggi</li>' :
        '<li><strong>Acconto:</strong> ' + doc.accontoPct + '% alla conferma</li><li><strong>Saldo:</strong> alla consegna</li><li><strong>Tempi:</strong> ' + doc.tempiConsegna + '</li>') +
        '<li>Garanzia secondo normativa vigente</li></ul></div>' +
        '<div class="firma-section"><div class="firma-box"><h5>Per accettazione - Il Cliente</h5><div class="firma-linea">Firma: _______________________</div></div>' +
        '<div class="firma-box"><h5>Open Porte & Finestre</h5><div class="firma-linea">Firma: _______________________</div></div></div>' +
        '<div class="footer"><p>Open Porte & Finestre - Bergamo - Tel. 035 123456 - P.IVA 01234567890</p></div></body></html>';
}

console.log('✅ Script Stampa Documenti caricato - window.generaDocumentoCliente disponibile');

// ═══════════════════════════════════════════════════════════════════════════════
// 🆕 v8.500: MODAL NUOVO PROGETTO + NUOVA POSIZIONE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Inietta CSS e HTML per i modals al caricamento
 */
(function initProjectModals() {
    // CSS
    const style = document.createElement('style');
    style.id = 'project-modal-styles';
    style.textContent = `
        .pm-modal-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(4px);
            z-index: 10000;
            justify-content: center;
            align-items: center;
            padding: 1rem;
        }
        .pm-modal-overlay.active { display: flex; }
        .pm-modal {
            background: white;
            border-radius: 16px;
            width: 100%;
            max-width: 500px;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            animation: pm-modal-enter 0.3s ease-out;
        }
        @keyframes pm-modal-enter {
            from { opacity: 0; transform: scale(0.95) translateY(-20px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .pm-modal-header {
            padding: 1.5rem;
            border-bottom: 1px solid #e5e7eb;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
            border-radius: 16px 16px 0 0;
        }
        .pm-modal-header.green { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
        .pm-modal-title { font-size: 1.25rem; font-weight: 700; color: white; display: flex; align-items: center; gap: 0.5rem; }
        .pm-modal-close {
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 1.25rem;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }
        .pm-modal-close:hover { background: rgba(255,255,255,0.3); transform: rotate(90deg); }
        .pm-modal-body { padding: 1.5rem; }
        .pm-form-group { margin-bottom: 1.25rem; }
        .pm-form-label { display: block; font-weight: 600; color: #374151; margin-bottom: 0.5rem; font-size: 0.9rem; }
        .pm-form-input, .pm-form-select {
            width: 100%;
            padding: 0.75rem 1rem;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            font-size: 1rem;
            transition: all 0.2s;
            background: white;
            box-sizing: border-box;
        }
        .pm-form-input:focus, .pm-form-select:focus {
            outline: none;
            border-color: #6366f1;
            box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }
        .pm-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .pm-modal-footer {
            padding: 1rem 1.5rem;
            border-top: 1px solid #e5e7eb;
            display: flex;
            justify-content: flex-end;
            gap: 0.75rem;
            background: #f9fafb;
            border-radius: 0 0 16px 16px;
        }
        .pm-btn {
            padding: 0.75rem 1.5rem;
            border-radius: 8px;
            font-weight: 600;
            font-size: 0.95rem;
            cursor: pointer;
            transition: all 0.2s;
            border: none;
        }
        .pm-btn-secondary { background: #e5e7eb; color: #374151; }
        .pm-btn-secondary:hover { background: #d1d5db; }
        .pm-btn-primary { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; }
        .pm-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4); }
        .pm-products-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; }
        .pm-product-checkbox {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem;
            background: #f3f4f6;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .pm-product-checkbox:hover { background: #e5e7eb; }
        .pm-add-position-btn {
            width: 100%;
            padding: 0.75rem;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            border: 2px dashed rgba(255,255,255,0.5);
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            transition: all 0.2s;
            margin-top: 0.5rem;
        }
        .pm-add-position-btn:hover { background: linear-gradient(135deg, #059669 0%, #047857 100%); border-style: solid; }
    `;
    document.head.appendChild(style);
    
    // HTML Modals
    const modalsHTML = `
        <!-- Modal Nuovo Progetto -->
        <div id="newProjectModal" class="pm-modal-overlay" onclick="if(event.target === this) closeNewProjectModal()">
            <div class="pm-modal">
                <div class="pm-modal-header">
                    <div class="pm-modal-title"><span>📁</span><span>Nuovo Progetto</span></div>
                    <button class="pm-modal-close" onclick="closeNewProjectModal()">×</button>
                </div>
                <div class="pm-modal-body">
                    <div class="pm-form-group">
                        <label class="pm-form-label">Nome Progetto *</label>
                        <input type="text" id="newProjectName" class="pm-form-input" placeholder="Es. Ristrutturazione Rossi">
                    </div>
                    <div class="pm-form-group">
                        <label class="pm-form-label">Cliente *</label>
                        <input type="text" id="newProjectClient" class="pm-form-input" placeholder="Es. Mario Rossi">
                    </div>
                    <div class="pm-form-row">
                        <div class="pm-form-group">
                            <label class="pm-form-label">Telefono</label>
                            <input type="tel" id="newProjectPhone" class="pm-form-input" placeholder="Es. 333 1234567">
                        </div>
                        <div class="pm-form-group">
                            <label class="pm-form-label">Email</label>
                            <input type="email" id="newProjectEmail" class="pm-form-input" placeholder="Es. mario@email.it">
                        </div>
                    </div>
                    <div class="pm-form-group">
                        <label class="pm-form-label">Indirizzo</label>
                        <input type="text" id="newProjectAddress" class="pm-form-input" placeholder="Es. Via Roma 1, Bergamo">
                    </div>
                    <div class="pm-form-group">
                        <label class="pm-form-label">Prodotti da rilevare</label>
                        <div class="pm-products-grid">
                            <label class="pm-product-checkbox"><input type="checkbox" id="newProdInfissi" checked><span>🪟 Infissi</span></label>
                            <label class="pm-product-checkbox"><input type="checkbox" id="newProdPersiane"><span>🚪 Persiane</span></label>
                            <label class="pm-product-checkbox"><input type="checkbox" id="newProdTapparelle"><span>🔽 Tapparelle</span></label>
                            <label class="pm-product-checkbox"><input type="checkbox" id="newProdZanzariere"><span>🦟 Zanzariere</span></label>
                            <label class="pm-product-checkbox"><input type="checkbox" id="newProdCassonetti"><span>📦 Cassonetti</span></label>
                            <label class="pm-product-checkbox"><input type="checkbox" id="newProdBlindate"><span>🔐 Blindate</span></label>
                        </div>
                    </div>
                </div>
                <div class="pm-modal-footer">
                    <button class="pm-btn pm-btn-secondary" onclick="closeNewProjectModal()">Annulla</button>
                    <button class="pm-btn pm-btn-primary" onclick="createNewProjectFromModal()">✅ Crea Progetto</button>
                </div>
            </div>
        </div>
        
        <!-- Modal Nuova Posizione -->
        <div id="newPositionModal" class="pm-modal-overlay" onclick="if(event.target === this) closeNewPositionModal()">
            <div class="pm-modal">
                <div class="pm-modal-header green">
                    <div class="pm-modal-title"><span>📍</span><span>Nuova Posizione</span></div>
                    <button class="pm-modal-close" onclick="closeNewPositionModal()">×</button>
                </div>
                <div class="pm-modal-body">
                    <div class="pm-form-row">
                        <div class="pm-form-group">
                            <label class="pm-form-label">Ambiente *</label>
                            <select id="newPosAmbiente" class="pm-form-select">
                                <option value="">-- Seleziona --</option>
                                <option value="Soggiorno">Soggiorno</option>
                                <option value="Cucina">Cucina</option>
                                <option value="Camera">Camera</option>
                                <option value="Camera Matrimoniale">Camera Matrimoniale</option>
                                <option value="Cameretta">Cameretta</option>
                                <option value="Bagno">Bagno</option>
                                <option value="Studio">Studio</option>
                                <option value="Ingresso">Ingresso</option>
                                <option value="Corridoio">Corridoio</option>
                                <option value="Balcone">Balcone</option>
                                <option value="Terrazzo">Terrazzo</option>
                                <option value="Cantina">Cantina</option>
                                <option value="Garage">Garage</option>
                            </select>
                        </div>
                        <div class="pm-form-group">
                            <label class="pm-form-label">Piano</label>
                            <select id="newPosPiano" class="pm-form-select">
                                <option value="">-- Seleziona --</option>
                                <option value="Interrato">Interrato</option>
                                <option value="Piano Terra">Piano Terra</option>
                                <option value="Piano Rialzato">Piano Rialzato</option>
                                <option value="Primo Piano">Primo Piano</option>
                                <option value="Secondo Piano">Secondo Piano</option>
                                <option value="Terzo Piano">Terzo Piano</option>
                                <option value="Mansarda">Mansarda</option>
                            </select>
                        </div>
                    </div>
                    <div class="pm-form-group">
                        <label class="pm-form-label">Note</label>
                        <input type="text" id="newPosNote" class="pm-form-input" placeholder="Note aggiuntive...">
                    </div>
                </div>
                <div class="pm-modal-footer">
                    <button class="pm-btn pm-btn-secondary" onclick="closeNewPositionModal()">Annulla</button>
                    <button class="pm-btn pm-btn-primary" onclick="createNewPositionFromModal()">✅ Aggiungi Posizione</button>
                </div>
            </div>
        </div>
    `;
    
    const container = document.createElement('div');
    container.id = 'project-modals-container';
    container.innerHTML = modalsHTML;
    document.body.appendChild(container);
    
    console.log('✅ v8.500: Modal Nuovo Progetto/Posizione inizializzati');
})();

/**
 * Apre modal nuovo progetto
 */
function openNewProjectModal() {
    document.getElementById('newProjectModal').classList.add('active');
    setTimeout(() => document.getElementById('newProjectName').focus(), 100);
    closeSidebar(); // Chiudi sidebar
}

/**
 * Chiude modal nuovo progetto
 */
function closeNewProjectModal() {
    document.getElementById('newProjectModal').classList.remove('active');
}

/**
 * Apre modal nuova posizione
 */
function openNewPositionModal() {
    document.getElementById('newPositionModal').classList.add('active');
    setTimeout(() => document.getElementById('newPosAmbiente').focus(), 100);
}

/**
 * Chiude modal nuova posizione
 */
function closeNewPositionModal() {
    document.getElementById('newPositionModal').classList.remove('active');
}

/**
 * Crea nuovo progetto dal modal
 */
async function createNewProjectFromModal() {
    const name = document.getElementById('newProjectName').value.trim();
    const client = document.getElementById('newProjectClient').value.trim();
    const phone = document.getElementById('newProjectPhone').value.trim();
    const email = document.getElementById('newProjectEmail').value.trim();
    const address = document.getElementById('newProjectAddress').value.trim();
    
    // Validazione
    if (!name) {
        showAlert('error', '❌ Nome progetto obbligatorio');
        document.getElementById('newProjectName').focus();
        return;
    }
    if (!client) {
        showAlert('error', '❌ Cliente obbligatorio');
        document.getElementById('newProjectClient').focus();
        return;
    }
    
    // Prodotti
    const prodotti = {
        infissi: document.getElementById('newProdInfissi').checked,
        persiane: document.getElementById('newProdPersiane').checked,
        tapparelle: document.getElementById('newProdTapparelle').checked,
        zanzariere: document.getElementById('newProdZanzariere').checked,
        cassonetti: document.getElementById('newProdCassonetti').checked,
        blindate: document.getElementById('newProdBlindate').checked
    };
    
    // Genera ID progetto
    const currentYear = new Date().getFullYear();
    const existingIds = (window.githubProjects || []).map(p => p.id).filter(id => id && id.startsWith(currentYear + 'P'));
    const existingNumbers = existingIds.map(id => { const m = id.match(/^(\d{4})P(\d{3})$/); return m ? parseInt(m[2]) : 0; }).filter(n => n > 0);
    const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
    const projectId = `${currentYear}P${String(nextNumber).padStart(3, '0')}`;
    
    // Crea progetto
    const now = new Date().toISOString();
    const project = {
        id: projectId,
        name: name,
        client: client,
        customerName: client,
        customerPhone: phone,
        customerEmail: email,
        customerAddress: address,
        clientData: { nome: client, telefono: phone, email: email, indirizzo: address },
        prodotti: prodotti,
        configInfissi: {},
        configPersiane: {},
        configTapparelle: {},
        configZanzariere: {},
        configCassonetti: {},
        positions: [],
        posizioni: [],
        createdAt: now,
        metadata: {
            version: 1,
            created: now,
            updated: now,
            syncStatus: 'local'
        }
    };
    
    console.log('📦 Nuovo progetto creato:', project);
    
    // Chiudi modal
    closeNewProjectModal();
    
    // Salva su GitHub
    if (typeof GITHUB_SYNC !== 'undefined' && GITHUB_SYNC.hasToken()) {
        showAlert('info', '💾 Salvataggio su GitHub...');
        
        try {
            const success = await GITHUB_SYNC.salvaProgetto(project, { source: 'dashboard-new' });
            if (success) {
                showAlert('success', `✅ Progetto "${name}" creato!`);
                
                // Ricarica lista progetti
                if (typeof loadProjectsFromGitHub === 'function') {
                    await loadProjectsFromGitHub();
                }
            } else {
                showAlert('warning', '⚠️ Progetto creato ma non salvato su GitHub');
            }
        } catch (err) {
            console.error('Errore salvataggio:', err);
            showAlert('error', '❌ Errore: ' + err.message);
        }
    } else {
        showAlert('warning', '⚠️ GitHub non configurato');
    }
    
    // Reset form
    document.getElementById('newProjectName').value = '';
    document.getElementById('newProjectClient').value = '';
    document.getElementById('newProjectPhone').value = '';
    document.getElementById('newProjectEmail').value = '';
    document.getElementById('newProjectAddress').value = '';
}

/**
 * Crea nuova posizione dal modal
 */
async function createNewPositionFromModal() {
    // Verifica progetto caricato
    if (!window.currentData && !window.projectData) {
        showAlert('error', '❌ Nessun progetto caricato');
        return;
    }
    
    const project = window.currentData || window.projectData;
    const ambiente = document.getElementById('newPosAmbiente').value;
    const piano = document.getElementById('newPosPiano').value;
    const note = document.getElementById('newPosNote').value.trim();
    
    if (!ambiente) {
        showAlert('error', '❌ Seleziona un ambiente');
        return;
    }
    
    // Genera ID posizione
    const posNum = (project.positions?.length || project.posizioni?.length || 0) + 1;
    const posId = `${project.id || 'proj'}_${String(posNum).padStart(2, '0')}`;
    
    const newPos = {
        id: posId,
        name: `Pos. ${posNum}`,
        ambiente: ambiente,
        piano: piano,
        note: note,
        quantita: '1',
        misure: {},
        infisso: null,
        persiana: null,
        tapparella: null,
        zanzariera: null,
        cassonetto: null
    };
    
    // Aggiungi a progetto
    if (!project.positions) project.positions = [];
    if (!project.posizioni) project.posizioni = [];
    project.positions.push(newPos);
    project.posizioni.push(newPos);
    
    // Aggiorna UI
    if (typeof allPositionsData !== 'undefined') allPositionsData.push(newPos);
    if (typeof filteredPositions !== 'undefined') filteredPositions.push(newPos);
    
    // Chiudi modal
    closeNewPositionModal();
    
    // Re-render
    if (typeof renderPositionsList === 'function') renderPositionsList();
    
    const newIndex = (filteredPositions?.length || 1) - 1;
    if (typeof selectPosition === 'function') selectPosition(newIndex);
    
    // Salva
    if (typeof GITHUB_SYNC !== 'undefined' && GITHUB_SYNC.hasToken()) {
        try {
            await GITHUB_SYNC.salvaProgetto(project, { source: 'dashboard-position' });
        } catch (err) {
            console.error('Errore salvataggio:', err);
        }
    }
    
    showAlert('success', `✅ Posizione "${ambiente}" aggiunta!`);
    
    // Reset
    document.getElementById('newPosAmbiente').value = '';
    document.getElementById('newPosPiano').value = '';
    document.getElementById('newPosNote').value = '';
}

console.log('✅ v8.500: Funzioni Nuovo Progetto/Posizione caricate');
