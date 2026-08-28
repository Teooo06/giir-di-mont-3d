export class RaceManager {
  constructor(options = {}) {
    this.totalKm = 32.0;
    this.totalElevationGain = 3800;
    this.winnerReferenceTime = '03:15:00';
    this.onStateChange = options.onStateChange || null;

// Checkpoint Ufficiali Reali del Giir di Mont 32 km
    this.defaultCheckpoints = [
      { id: 'cp0', name: 'PARTENZA · Premana', km: 0.0, ele: 960.5, lat: 46.053108, lon: 9.420741, isStart: true },
      { id: 'cp1', name: 'Alpe Chiarino', km: 4.8, ele: 1542.8, lat: 46.042958, lon: 9.446078, refSplit: '00:26:15' },
      { id: 'cp2', name: 'Alpe Vegessa (Cancello 1)', km: 9.0, ele: 1196.1, lat: 46.041193, lon: 9.466374, refSplit: '00:48:30' },
      { id: 'cp3', name: 'Bocchetta di Larec (GPM)', km: 14.5, ele: 2070.3, lat: 46.044809, lon: 9.492315, refSplit: '01:29:40' },
      { id: 'cp4', name: 'Alpe Fraina', km: 16.8, ele: 1395.0, lat: 46.054928, lon: 9.464670, refSplit: '01:43:10' },
      { id: 'cp5', name: 'Alpe Rasga (Intermedio 4)', km: 19.0, ele: 1090.8, lat: 46.054928, lon: 9.464670, refSplit: '01:54:20' },
      { id: 'cp6', name: 'Alpe Premaniga', km: 23.0, ele: 1400.8, lat: 46.060895, lon: 9.425510, refSplit: '02:21:00' },
      { id: 'cp7', name: 'Alpe Solino (Cancello 2)', km: 25.0, ele: 1601.8, lat: 46.060895, lon: 9.425510, refSplit: '02:35:15' },
      { id: 'cp8', name: 'Alpe Deleguaggio (Intermedio 5)', km: 27.5, ele: 1658.9, lat: 46.060895, lon: 9.425510, refSplit: '02:51:30' },
      { id: 'cp9', name: 'ARRIVO · Premana', km: 32.0, ele: 958.4, lat: 46.052978, lon: 9.420907, refSplit: '03:15:00', isFinish: true }
    ];

    // Atleti Top Giir di Mont
    this.defaultAthletes = [
      {
        id: 'ath-1',
        bib: '1',
        name: 'Petro Mamu',
        country: 'ERI',
        team: 'Scarpa Team',
        color: '#dff654',
        status: 'running',
        km: 14.5,
        gap: 'LEADER',
        pace: '6:05 min/km',
        splits: {
          cp0: '00:00:00',
          cp1: '00:26:15',
          cp2: '00:48:30',
          cp3: '01:29:40'
        }
      },
      {
        id: 'ath-2',
        bib: '2',
        name: 'Cesare Maestri',
        country: 'ITA',
        team: 'Nike Trail',
        color: '#00f0ff',
        status: 'running',
        km: 14.1,
        gap: '+01:15',
        pace: '6:10 min/km',
        splits: {
          cp0: '00:00:00',
          cp1: '00:26:40',
          cp2: '00:49:15',
          cp3: '01:30:55'
        }
      },
      {
        id: 'ath-3',
        bib: '241',
        name: 'Morven Goodrum',
        country: 'GBR',
        team: 'Scarpa Racing',
        color: '#ff9500',
        status: 'running',
        km: 13.8,
        gap: '+02:40',
        pace: '6:18 min/km',
        splits: {
          cp0: '00:00:00',
          cp1: '00:27:10',
          cp2: '00:50:20'
        }
      }
    ];

    this.checkpoints = [...this.defaultCheckpoints];
    this.athletes = [];
    this.selectedAthleteId = null;

    // Canale Broadcast per sincronizzazione multi-scheda istantanea
    try {
      this.channel = new BroadcastChannel('giir_sync_channel');
      this.channel.onmessage = (event) => {
        if (event.data && event.data.type === 'RACE_STATE_UPDATED') {
          this.loadFromStorage(false, true);
        }
      };
    } catch (e) {}

    // Inizializza i dati SENZA emettere callback sincroni nel costruttore
    this.loadFromStorage(false, false);
  }

  loadFromStorage(broadcast = false, emit = false) {
    try {
      const saved = localStorage.getItem('giir_race_data_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.athletes && parsed.athletes.length > 0) {
          this.athletes = parsed.athletes;
        } else {
          this.athletes = JSON.parse(JSON.stringify(this.defaultAthletes));
        }
        if (parsed.checkpoints && parsed.checkpoints.length > 0) {
          this.checkpoints = parsed.checkpoints;
        }
        this.selectedAthleteId = parsed.selectedAthleteId || this.athletes[0]?.id || null;
        if (emit) this.emitState();
        return;
      }
    } catch (e) {
      console.warn('[RaceManager] Errore lettura storage:', e);
    }

    this.athletes = JSON.parse(JSON.stringify(this.defaultAthletes));
    this.selectedAthleteId = this.athletes[0]?.id || null;
    this.saveToStorage(broadcast, emit);
  }

  saveToStorage(broadcast = true, emit = true) {
    try {
      localStorage.setItem('giir_race_data_v2', JSON.stringify({
        athletes: this.athletes,
        checkpoints: this.checkpoints,
        selectedAthleteId: this.selectedAthleteId
      }));
      if (broadcast && this.channel) {
        this.channel.postMessage({ type: 'RACE_STATE_UPDATED' });
      }
    } catch (e) {}
    if (emit) this.emitState();
  }

  emitState() {
    if (typeof this.onStateChange === 'function') {
      this.onStateChange(this.getState());
    }
  }

  getState() {
    return {
      athletes: this.athletes,
      checkpoints: this.checkpoints,
      selectedAthlete: this.getSelectedAthlete(),
      totalKm: this.totalKm,
      totalElevationGain: this.totalElevationGain,
      winnerReferenceTime: this.winnerReferenceTime
    };
  }

  getSelectedAthlete() {
    return this.athletes.find(a => a.id === this.selectedAthleteId) || this.athletes[0] || null;
  }

  selectAthlete(id) {
    this.selectedAthleteId = id;
    this.saveToStorage();
  }

  updateAthleteKm(id, km) {
    const athlete = this.athletes.find(a => a.id === id);
    if (athlete) {
      athlete.km = Math.max(0, Math.min(this.totalKm, parseFloat(km) || 0));
      this.saveToStorage();
    }
  }

  updateSplitTime(athleteId, checkpointId, timeStr) {
    const athlete = this.athletes.find(a => a.id === athleteId);
    if (athlete) {
      if (!athlete.splits) athlete.splits = {};
      athlete.splits[checkpointId] = timeStr;
      
      const cp = this.checkpoints.find(c => c.id === checkpointId);
      if (cp && timeStr.trim() !== '') {
        athlete.km = cp.km;
      }
      this.saveToStorage();
    }
  }

  addAthlete(athlete) {
    const newAthlete = {
      id: 'ath-' + Date.now(),
      bib: athlete.bib || `${Math.floor(Math.random() * 500) + 1}`,
      name: athlete.name || 'Nuovo Atleta',
      country: athlete.country || 'ITA',
      team: athlete.team || 'Skyrunner',
      color: athlete.color || '#dff654',
      status: 'running',
      km: parseFloat(athlete.km) || 0,
      gap: athlete.gap || '+00:00',
      pace: '6:15 min/km',
      splits: { cp0: '00:00:00' }
    };
    this.athletes.push(newAthlete);
    this.saveToStorage();
    return newAthlete;
  }

  updateAthleteDetails(id, details) {
    const ath = this.athletes.find(a => a.id === id);
    if (ath) {
      Object.assign(ath, details);
      this.saveToStorage();
    }
  }

  deleteAthlete(id) {
    this.athletes = this.athletes.filter(a => a.id !== id);
    if (this.selectedAthleteId === id) {
      this.selectedAthleteId = this.athletes[0]?.id || null;
    }
    this.saveToStorage();
  }

  resetToDefault() {
    this.athletes = JSON.parse(JSON.stringify(this.defaultAthletes));
    this.checkpoints = [...this.defaultCheckpoints];
    this.selectedAthleteId = this.athletes[0]?.id || null;
    this.saveToStorage();
  }

  // YOU-26: CSV import — ponytail: stdlib split, header-driven, one saveToStorage; covers bib,name,country,team,color,km,gap,status + cp* splits
  importCsv(csvText) {
    const lines = csvText.trim().split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return 0;
    const splitLine = (line) => {
      const out = []; let cur = ''; let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
        else if (c === ',' && !inQ) { out.push(cur); cur = ''; }
        else cur += c;
      }
      out.push(cur);
      return out.map(s => s.trim().replace(/^"|"$/g, ''));
    };
    const header = splitLine(lines[0]).map(h => h.trim().toLowerCase());
    const idxBib = header.indexOf('bib');
    const idxName = header.indexOf('name');
    if (idxBib === -1 && idxName === -1) throw new Error('CSV deve avere colonne bib e name');
    let imported = 0;
    for (let i = 1; i < lines.length; i++) {
      const vals = splitLine(lines[i]);
      const get = (col) => { const idx = header.indexOf(col); return idx !== -1 ? (vals[idx] || '').trim() : ''; };
      const bib = get('bib'); const name = get('name');
      if (!bib && !name) continue;
      const km = parseFloat(get('km')) || 0;
      const data = {
        bib: bib || `${Math.floor(Math.random() * 500) + 1}`,
        name: name || `Atleta ${bib}`,
        country: get('country') || get('nazione') || 'ITA',
        team: get('team') || get('squadra') || 'Skyrunner',
        color: get('color') || get('colore') || '#dff654',
        km: Math.max(0, Math.min(this.totalKm, km)),
        gap: get('gap') || '+00:00',
        status: get('status') || 'running'
      };
      const splits = {};
      header.forEach((h, hi) => { if (h.startsWith('cp')) splits[h] = (vals[hi] || '').trim(); });
      // upsert by bib
      let ath = this.athletes.find(a => a.bib === data.bib);
      if (ath) {
        Object.assign(ath, data);
        if (Object.keys(splits).length) ath.splits = { ...ath.splits, ...splits };
        // if split gives later km, sync km to last non-empty checkpoint
        const lastCp = [...this.checkpoints].reverse().find(cp => splits[cp.id]);
        if (lastCp) ath.km = lastCp.km;
      } else {
        const newAth = {
          id: 'ath-' + Date.now() + '-' + imported,
          ...data,
          pace: '6:15 min/km',
          splits: Object.keys(splits).length ? splits : { cp0: '00:00:00' }
        };
        if (Object.keys(splits).length) {
          const lastCp = [...this.checkpoints].reverse().find(cp => splits[cp.id]);
          if (lastCp) newAth.km = lastCp.km;
        }
        this.athletes.push(newAth);
      }
      imported++;
    }
    if (imported) this.saveToStorage();
    return imported;
  }
}
