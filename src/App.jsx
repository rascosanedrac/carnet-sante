import { useState, useMemo, useEffect, useCallback } from "react";

// ─── DATA ────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "carnet_sante_episodes";

const SYMPTOMES = [
  { id: "ventre", label: "Mal de ventre", emoji: "🤢", color: "#F97316" },
  { id: "tete",   label: "Mal de tête",   emoji: "🤕", color: "#8B5CF6" },
];

const INTENSITES = [
  { val: 1, emoji: "😐", label: "Légère" },
  { val: 2, emoji: "😟", label: "Modérée" },
  { val: 3, emoji: "😣", label: "Forte" },
  { val: 4, emoji: "😭", label: "Très forte" },
];

const MAX_DUREE = 240;
const STEP_DUREE = 10;

function dureeLabel(min) {
  if (!min && min !== 0) return "Non précisée";
  if (min === 0) return "< 10 min";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

const CATEGORIES_ALIMENTS = [
  { id: "laitier",   label: "Produits laitiers",        emoji: "🥛", couleur: "#60A5FA",
    aliments: ["Lait","Fromage","Yaourt","Crème","Beurre","Glace"] },
  { id: "gluten",    label: "Gluten / Céréales",         emoji: "🍞", couleur: "#F59E0B",
    aliments: ["Pain","Pâtes","Pizza","Gâteau","Biscuits","Céréales"] },
  { id: "sucre",     label: "Sucres / Sucreries",        emoji: "🍬", couleur: "#EC4899",
    aliments: ["Bonbons","Chocolat","Jus de fruits","Soda","Miel","Confiture"] },
  { id: "proteines", label: "Viandes / Poissons",        emoji: "🍗", couleur: "#EF4444",
    aliments: ["Poulet","Bœuf","Porc","Poisson","Thon","Charcuterie"] },
  { id: "legumes",   label: "Légumes",                   emoji: "🥦", couleur: "#10B981",
    aliments: ["Tomates","Brocoli","Carottes","Poivrons","Oignons","Chou"] },
  { id: "fruits",    label: "Fruits",                    emoji: "🍎", couleur: "#F97316",
    aliments: ["Pomme","Banane","Fraises","Oranges","Raisins","Kiwi"] },
  { id: "oeufs",     label: "Œufs / Légumineuses",       emoji: "🥚", couleur: "#FBBF24",
    aliments: ["Œufs","Lentilles","Pois chiches","Haricots","Soja"] },
  { id: "fastfood",  label: "Fast-food / Plats préparés",emoji: "🍔", couleur: "#6B7280",
    aliments: ["McDonald's","Burger","Frites","Pizza industrielle","Nuggets"] },
];

// ─── UTILS ───────────────────────────────────────────────────────────────────

function nowISO() { return new Date().toISOString().slice(0, 16); }

function formatDisplay(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { weekday:"long", day:"numeric", month:"long" }) +
    " à " + d.toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit" });
}

function formatShort(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day:"2-digit", month:"2-digit" }) +
    " " + d.toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit" });
}

const emptyForm = () => ({
  date: nowISO(),
  symptome: "",
  intensite: 2,
  dureeMin: 30,
  aliments: {},
  note: "",
});

// ─── HOOK localStorage ───────────────────────────────────────────────────────

function useLocalEpisodes() {
  const [episodes, setEpisodesState] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  const setEpisodes = useCallback((updater) => {
    setEpisodesState(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  return [episodes, setEpisodes];
}

// ─── EXPORT / IMPORT ─────────────────────────────────────────────────────────

function exportJSON(episodes) {
  const blob = new Blob([JSON.stringify({ version: 1, exportDate: new Date().toISOString(), episodes }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `carnet-sante-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportCSV(episodes) {
  const headers = ["Date","Symptôme","Intensité","Durée (min)","Aliments","Catégories","Note"];
  const rows = episodes.map(e => {
    const sym = SYMPTOMES.find(s => s.id === e.symptome)?.label || e.symptome;
    const int = INTENSITES.find(i => i.val === e.intensite)?.label || e.intensite;
    const alims = Object.keys(e.aliments).join(" | ");
    const cats = [...new Set(Object.values(e.aliments).map(c => {
      const cat = CATEGORIES_ALIMENTS.find(x => x.id === c);
      return cat ? cat.label : c;
    }))].join(" | ");
    return [
      new Date(e.date).toLocaleString("fr-FR"),
      sym, int, e.dureeMin, alims, cats,
      (e.note || "").replace(/"/g, '""')
    ].map(v => `"${v}"`).join(",");
  });
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `carnet-sante-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportRapportTxt(episodes, stats, rapport) {
  const blob = new Blob([rapport], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rapport-medecin-${new Date().toISOString().slice(0,10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── FORMULAIRE ──────────────────────────────────────────────────────────────

function FormulaireEpisode({ form, setForm, onSave, onCancel, saveLabel = "Enregistrer" }) {
  const [catOuverte, setCatOuverte] = useState(null);
  const [alisCat, setAlisCat] = useState({});
  const [aliLibre, setAliLibre] = useState("");

  const toggleAliment = (nom, catId) => {
    setForm(f => {
      const next = { ...f.aliments };
      if (next[nom]) delete next[nom]; else next[nom] = catId;
      return { ...f, aliments: next };
    });
  };

  const ajouterDansCat = (catId) => {
    const nom = (alisCat[catId] || "").trim();
    if (!nom) return;
    setForm(f => ({ ...f, aliments: { ...f.aliments, [nom]: catId } }));
    setAlisCat(p => ({ ...p, [catId]: "" }));
  };

  const ajouterLibre = () => {
    const nom = aliLibre.trim();
    if (!nom) return;
    setForm(f => ({ ...f, aliments: { ...f.aliments, [nom]: "autre" } }));
    setAliLibre("");
  };

  const selectedAlimNames = Object.keys(form.aliments);
  const pct = Math.round((form.dureeMin / MAX_DUREE) * 100);
  const sliderColor = form.dureeMin <= 60 ? "#10B981" : form.dureeMin <= 120 ? "#F59E0B" : "#EF4444";
  const canSave = form.symptome && form.dureeMin >= 0;

  return (
    <div>
      {/* TYPE */}
      <SectionCard titre="TYPE DE DOULEUR">
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          {SYMPTOMES.map(s => (
            <button key={s.id} onClick={() => setForm(f => ({ ...f, symptome: s.id }))}
              style={{
                padding:"18px 10px", borderRadius:12, cursor:"pointer",
                border:`2px solid ${form.symptome===s.id ? s.color : "#E5E7EB"}`,
                background: form.symptome===s.id ? `${s.color}15` : "white",
                display:"flex", flexDirection:"column", alignItems:"center", gap:6,
                transition:"all 0.15s", fontFamily:"inherit",
                boxShadow: form.symptome===s.id ? `0 0 0 3px ${s.color}30` : "none",
              }}>
              <span style={{ fontSize:32 }}>{s.emoji}</span>
              <span style={{ fontSize:13, color:form.symptome===s.id?s.color:"#444", fontWeight:form.symptome===s.id?"bold":"normal" }}>{s.label}</span>
            </button>
          ))}
        </div>
      </SectionCard>

      {/* DATE */}
      <SectionCard titre="DATE & HEURE">
        <input type="datetime-local" value={form.date}
          onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
          style={{ width:"100%", padding:"10px 14px", borderRadius:10, border:"2px solid #E5E7EB", fontSize:15, fontFamily:"inherit", outline:"none", boxSizing:"border-box", color:"#333", background:"white" }}/>
      </SectionCard>

      {/* INTENSITÉ */}
      <SectionCard titre="INTENSITÉ">
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
          {INTENSITES.map(int => (
            <button key={int.val} onClick={() => setForm(f => ({ ...f, intensite: int.val }))}
              style={{
                padding:"12px 4px", borderRadius:10, cursor:"pointer",
                border:`2px solid ${form.intensite===int.val?"#8B5CF6":"#E5E7EB"}`,
                background: form.intensite===int.val ? "#8B5CF615" : "white",
                color: form.intensite===int.val ? "#7C3AED" : "#555",
                fontSize:11, fontFamily:"inherit", textAlign:"center",
                fontWeight: form.intensite===int.val ? "bold" : "normal",
                transition:"all 0.15s",
              }}>
              <div style={{ fontSize:22, marginBottom:4 }}>{int.emoji}</div>
              <div style={{ fontSize:10 }}>{int.val}/4</div>
              <div>{int.label}</div>
            </button>
          ))}
        </div>
      </SectionCard>

      {/* DURÉE */}
      <SectionCard titre="DURÉE">
        <div style={{ textAlign:"center", marginBottom:14 }}>
          <span style={{ fontSize:28, fontWeight:"bold", color:sliderColor, fontVariantNumeric:"tabular-nums" }}>
            {dureeLabel(form.dureeMin)}
          </span>
        </div>
        <div style={{ position:"relative", padding:"0 0 4px" }}>
          <div style={{ position:"absolute", top:"50%", left:0, right:0, height:6, transform:"translateY(-50%)", borderRadius:3, background:"#E5E7EB", pointerEvents:"none" }}/>
          <div style={{ position:"absolute", top:"50%", left:0, width:`${pct}%`, height:6, transform:"translateY(-50%)", borderRadius:3, background:sliderColor, pointerEvents:"none", transition:"width 0.05s, background 0.3s" }}/>
          <input type="range" min={0} max={MAX_DUREE} step={STEP_DUREE} value={form.dureeMin}
            onChange={e => setForm(f => ({ ...f, dureeMin: Number(e.target.value) }))}
            style={{ width:"100%", appearance:"none", WebkitAppearance:"none", background:"transparent", height:24, cursor:"pointer", position:"relative", outline:"none", margin:0 }}/>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"#aaa", marginTop:4 }}>
          <span>0</span><span>1h</span><span>2h</span><span>3h</span><span>4h</span>
        </div>
        <style>{`
          input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:22px; height:22px; border-radius:50%; background:${sliderColor}; border:3px solid white; box-shadow:0 1px 6px rgba(0,0,0,0.25); cursor:pointer; transition:background 0.3s; }
          input[type=range]::-moz-range-thumb { width:22px; height:22px; border-radius:50%; background:${sliderColor}; border:3px solid white; box-shadow:0 1px 6px rgba(0,0,0,0.25); cursor:pointer; }
        `}</style>
      </SectionCard>

      {/* ALIMENTS */}
      <SectionCard titre="ALIMENTS CONSOMMÉS">
        <p style={{ fontSize:12, color:"#888", margin:"0 0 12px" }}>Sélectionnez ou ajoutez des aliments dans chaque catégorie</p>

        {CATEGORIES_ALIMENTS.map(cat => {
          const nbSelected = cat.aliments.filter(a => form.aliments[a]).length +
            Object.entries(form.aliments).filter(([n,c]) => c===cat.id && !cat.aliments.includes(n)).length;
          return (
            <div key={cat.id} style={{ marginBottom:8, borderRadius:10, overflow:"hidden", border:"1px solid #EEE" }}>
              <button onClick={() => setCatOuverte(catOuverte===cat.id ? null : cat.id)}
                style={{ width:"100%", padding:"10px 14px", background:catOuverte===cat.id?`${cat.couleur}18`:"#FAFAFA", border:"none", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center", fontFamily:"inherit" }}>
                <span style={{ fontSize:13, color:"#333" }}>
                  <span style={{ marginRight:6 }}>{cat.emoji}</span>{cat.label}
                  {nbSelected > 0 && <span style={{ marginLeft:8, background:cat.couleur, color:"white", fontSize:10, padding:"1px 7px", borderRadius:10 }}>{nbSelected}</span>}
                </span>
                <span style={{ fontSize:10, color:"#aaa" }}>{catOuverte===cat.id?"▲":"▼"}</span>
              </button>
              {catOuverte===cat.id && (
                <div style={{ padding:"10px 14px 14px", background:"white" }}>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:10 }}>
                    {cat.aliments.map(alim => (
                      <button key={alim} onClick={() => toggleAliment(alim, cat.id)}
                        style={{ padding:"6px 12px", borderRadius:16, cursor:"pointer", border:`1.5px solid ${form.aliments[alim]?cat.couleur:"#DDD"}`, background:form.aliments[alim]?`${cat.couleur}18`:"white", color:form.aliments[alim]?cat.couleur:"#555", fontSize:13, fontFamily:"inherit", fontWeight:form.aliments[alim]?"bold":"normal" }}>{alim}</button>
                    ))}
                    {Object.entries(form.aliments).filter(([n,c]) => c===cat.id && !cat.aliments.includes(n)).map(([nom]) => (
                      <button key={nom} onClick={() => toggleAliment(nom, cat.id)}
                        style={{ padding:"6px 12px", borderRadius:16, cursor:"pointer", border:`1.5px solid ${cat.couleur}`, background:`${cat.couleur}18`, color:cat.couleur, fontSize:13, fontFamily:"inherit", fontWeight:"bold" }}>{nom} ×</button>
                    ))}
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    <input value={alisCat[cat.id]||""} onChange={e => setAlisCat(p => ({ ...p, [cat.id]:e.target.value }))}
                      onKeyDown={e => e.key==="Enter" && ajouterDansCat(cat.id)}
                      placeholder={`Ajouter dans "${cat.label}"…`}
                      style={{ flex:1, padding:"7px 10px", borderRadius:8, border:`1.5px solid ${cat.couleur}60`, fontSize:13, fontFamily:"inherit", outline:"none", color:"#333", background:"white" }}/>
                    <button onClick={() => ajouterDansCat(cat.id)} style={{ padding:"7px 12px", borderRadius:8, background:cat.couleur, color:"white", border:"none", cursor:"pointer", fontSize:14, fontWeight:"bold" }}>+</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Hors catégorie */}
        <div style={{ marginTop:10, padding:"10px 14px", borderRadius:10, border:"2px dashed #D1D5DB", background:"#FAFAFA" }}>
          <div style={{ fontSize:11, color:"#888", marginBottom:8, letterSpacing:"0.06em", textTransform:"uppercase" }}>Autre aliment (hors catégorie)</div>
          <div style={{ display:"flex", gap:8 }}>
            <input value={aliLibre} onChange={e => setAliLibre(e.target.value)} onKeyDown={e => e.key==="Enter" && ajouterLibre()}
              placeholder="Nom de l'aliment…"
              style={{ flex:1, padding:"8px 12px", borderRadius:8, border:"2px solid #E5E7EB", fontSize:14, fontFamily:"inherit", outline:"none", color:"#333", background:"white" }}/>
            <button onClick={ajouterLibre} style={{ padding:"8px 14px", borderRadius:8, background:"#1C1C2E", color:"white", border:"none", cursor:"pointer", fontSize:16, fontWeight:"bold" }}>+</button>
          </div>
          {Object.entries(form.aliments).filter(([,c]) => c==="autre").length > 0 && (
            <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:8 }}>
              {Object.entries(form.aliments).filter(([,c]) => c==="autre").map(([nom]) => (
                <span key={nom} onClick={() => toggleAliment(nom,"autre")}
                  style={{ background:"#F3F4F6", border:"1px solid #D1D5DB", color:"#555", padding:"3px 10px", borderRadius:12, fontSize:12, cursor:"pointer" }}>{nom} ×</span>
              ))}
            </div>
          )}
        </div>

        {selectedAlimNames.length > 0 && (
          <div style={{ marginTop:12, padding:"10px 12px", background:"#F0FDF4", borderRadius:10, border:"1px solid #BBF7D0" }}>
            <div style={{ fontSize:11, color:"#166534", marginBottom:6, fontWeight:"bold", letterSpacing:"0.05em" }}>SÉLECTIONNÉS ({selectedAlimNames.length})</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {selectedAlimNames.map(nom => {
                const cat = CATEGORIES_ALIMENTS.find(c => c.id===form.aliments[nom]);
                return (
                  <span key={nom} onClick={() => toggleAliment(nom, form.aliments[nom])}
                    style={{ background:cat?`${cat.couleur}18`:"white", border:`1px solid ${cat?cat.couleur+"60":"#86EFAC"}`, color:cat?cat.couleur:"#166534", padding:"3px 10px", borderRadius:12, fontSize:12, cursor:"pointer" }}>
                    {cat?.emoji} {nom} ×
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </SectionCard>

      {/* NOTE */}
      <SectionCard titre="NOTE LIBRE">
        <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
          placeholder="Contexte, remarques, observations pour le médecin…" rows={3}
          style={{ width:"100%", padding:"10px 14px", borderRadius:10, border:"2px solid #E5E7EB", fontSize:14, fontFamily:"inherit", outline:"none", resize:"vertical", boxSizing:"border-box", color:"#333", background:"white", lineHeight:1.5 }}/>
      </SectionCard>

      <div style={{ display:"flex", gap:10 }}>
        {onCancel && (
          <button onClick={onCancel} style={{ flex:1, padding:"14px", borderRadius:12, border:"2px solid #E5E7EB", background:"white", color:"#666", fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>Annuler</button>
        )}
        <button onClick={onSave} disabled={!canSave}
          style={{ flex:2, padding:"16px", borderRadius:12, border:"none", background:canSave?"#1C1C2E":"#E5E7EB", color:canSave?"white":"#aaa", fontSize:15, fontWeight:"bold", cursor:canSave?"pointer":"not-allowed", fontFamily:"inherit", letterSpacing:"0.08em", textTransform:"uppercase", transition:"all 0.2s", boxShadow:canSave?"0 4px 20px rgba(28,28,46,0.3)":"none" }}>
          {saveLabel}
        </button>
      </div>
    </div>
  );
}

// ─── APP ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab]             = useState("ajouter");
  const [episodes, setEpisodes]   = useLocalEpisodes();
  const [form, setForm]           = useState(emptyForm());
  const [flash, setFlash]         = useState("");
  const [detailId, setDetailId]   = useState(null);
  const [editId, setEditId]       = useState(null);
  const [editForm, setEditForm]   = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [importError, setImportError]   = useState("");

  const flashMsg = (type) => { setFlash(type); setTimeout(() => setFlash(""), 2400); };

  // ── CRUD ──
  const enregistrer = () => {
    if (!form.symptome) return;
    setEpisodes(prev => [{ id: Date.now(), ...form }, ...prev]);
    setForm(emptyForm());
    flashMsg("ajout");
    setTab("journal");
  };

  const startEdit = (ep) => { setEditId(ep.id); setEditForm({ ...ep }); setDetailId(null); };

  const saveEdit = () => {
    setEpisodes(prev => prev.map(ep => ep.id===editId ? { ...editForm, id:editId } : ep));
    setEditId(null); setEditForm(null);
    flashMsg("edit");
  };

  const cancelEdit = () => { setEditId(null); setEditForm(null); };
  const supprimer  = (id) => { setEpisodes(prev => prev.filter(ep => ep.id!==id)); setDetailId(null); };

  // ── IMPORT JSON ──
  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.episodes || !Array.isArray(data.episodes)) throw new Error("Format invalide");
        setEpisodes(prev => {
          const existingIds = new Set(prev.map(ep => ep.id));
          const newOnes = data.episodes.filter(ep => !existingIds.has(ep.id));
          return [...prev, ...newOnes].sort((a,b) => new Date(b.date) - new Date(a.date));
        });
        flashMsg("import");
        setImportError("");
      } catch {
        setImportError("Fichier invalide. Utilisez un fichier exporté depuis cette application.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ── STATS ──
  const stats = useMemo(() => {
    if (!episodes.length) return null;
    const total = episodes.length;
    const parSymptome = { ventre:0, tete:0 };
    const parIntensite = { 1:0, 2:0, 3:0, 4:0 };
    const alimFreq = {}, catFreq = {};
    let totalDuree = 0;

    episodes.forEach(e => {
      parSymptome[e.symptome] = (parSymptome[e.symptome]||0) + 1;
      parIntensite[e.intensite] = (parIntensite[e.intensite]||0) + 1;
      totalDuree += e.dureeMin || 0;
      Object.entries(e.aliments).forEach(([nom,cat]) => {
        alimFreq[nom] = (alimFreq[nom]||0) + 1;
        catFreq[cat]  = (catFreq[cat]||0)  + 1;
      });
    });

    const topAliments   = Object.entries(alimFreq).sort((a,b) => b[1]-a[1]).slice(0,8);
    const topCategories = Object.entries(catFreq).sort((a,b) => b[1]-a[1]).filter(([id]) => id!=="autre");
    const parMois = {};
    episodes.forEach(e => {
      const m = new Date(e.date).toLocaleDateString("fr-FR", { month:"short", year:"2-digit" });
      parMois[m] = (parMois[m]||0) + 1;
    });
    const avgInt   = episodes.reduce((s,e) => s+e.intensite, 0) / total;
    const avgDuree = Math.round(totalDuree / total);

    return { total, parSymptome, parIntensite, topAliments, topCategories, parMois, avgInt, avgDuree };
  }, [episodes]);

  // ── RAPPORT ──
  const rapport = useMemo(() => {
    if (!episodes.length) return "";
    const lines = [];
    lines.push("═══════════════════════════════════════");
    lines.push("   SUIVI MÉDICAL — ENFANT");
    lines.push(`   Généré le ${new Date().toLocaleDateString("fr-FR", { day:"numeric", month:"long", year:"numeric" })}`);
    lines.push("═══════════════════════════════════════\n");
    lines.push(`Épisodes documentés : ${episodes.length}`);
    if (stats) {
      lines.push(`Maux de ventre : ${stats.parSymptome.ventre||0} fois`);
      lines.push(`Maux de tête   : ${stats.parSymptome.tete||0} fois`);
      lines.push(`Intensité moyenne : ${stats.avgInt.toFixed(1)} / 4`);
      lines.push(`Durée moyenne     : ${dureeLabel(stats.avgDuree)}`);
    }
    if (stats?.topCategories.length) {
      lines.push("\n─── CATÉGORIES LES PLUS FRÉQUENTES ───");
      stats.topCategories.forEach(([catId,count]) => {
        const cat = CATEGORIES_ALIMENTS.find(c => c.id===catId);
        lines.push(`  ${cat ? cat.emoji+" "+cat.label : catId} : ${count} fois`);
      });
    }
    if (stats?.topAliments.length) {
      lines.push("\n─── ALIMENTS LES PLUS SOUVENT ASSOCIÉS ───");
      stats.topAliments.forEach(([nom,count]) => lines.push(`  • ${nom} : ${count} fois`));
    }
    lines.push("\n─── DÉTAIL CHRONOLOGIQUE ───");
    episodes.forEach((e,i) => {
      const sym = SYMPTOMES.find(s => s.id===e.symptome);
      const int = INTENSITES.find(x => x.val===e.intensite);
      lines.push(`\n[${i+1}] ${formatDisplay(e.date)}`);
      lines.push(`  Symptôme  : ${sym?.label}`);
      lines.push(`  Intensité : ${int?.label} (${e.intensite}/4)`);
      lines.push(`  Durée     : ${dureeLabel(e.dureeMin)}`);
      const alis = Object.keys(e.aliments);
      if (alis.length) lines.push(`  Aliments  : ${alis.join(", ")}`);
      if (e.note) lines.push(`  Note      : ${e.note}`);
    });
    lines.push("\n═══════════════════════════════════════");
    return lines.join("\n");
  }, [episodes, stats]);

  // ─── MODE ÉDITION ───────────────────────────────────────────────────────────
  if (editId && editForm) {
    return (
      <div style={{ minHeight:"100vh", background:"#F8F5F2", fontFamily:"'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif" }}>
        <div style={{ background:"#1C1C2E", padding:"18px 20px", textAlign:"center" }}>
          <div style={{ fontSize:10, letterSpacing:"0.2em", color:"#F59E0B", textTransform:"uppercase", marginBottom:4 }}>Modification</div>
          <h1 style={{ margin:0, fontSize:22, color:"#FAFAF8", fontWeight:"normal" }}>Modifier l'épisode</h1>
          <div style={{ fontSize:12, color:"#888", marginTop:4 }}>{formatShort(editForm.date)}</div>
        </div>
        <div style={{ padding:"20px 16px", maxWidth:540, margin:"0 auto" }}>
          <FormulaireEpisode form={editForm} setForm={setEditForm} onSave={saveEdit} onCancel={cancelEdit} saveLabel="✓ Enregistrer les modifications"/>
        </div>
      </div>
    );
  }

  // ─── VUE PRINCIPALE ─────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh", background:"#F8F5F2", fontFamily:"'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif" }}>

      {/* HEADER */}
      <div style={{ background:"#1C1C2E", padding:"22px 20px 18px", textAlign:"center", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, opacity:0.07, backgroundImage:"radial-gradient(circle at 20% 50%, #8B5CF6 0%, transparent 50%), radial-gradient(circle at 80% 50%, #F97316 0%, transparent 50%)" }}/>
        <div style={{ position:"relative" }}>
          <div style={{ fontSize:10, letterSpacing:"0.25em", color:"#8B5CF6", textTransform:"uppercase", marginBottom:6 }}>Suivi santé</div>
          <h1 style={{ margin:0, fontSize:26, color:"#FAFAF8", fontWeight:"normal", letterSpacing:"0.03em" }}>Carnet de ma fille</h1>
          <div style={{ marginTop:6, display:"flex", justifyContent:"center", gap:16 }}>
            <span style={{ background:"#F9731620", color:"#F97316", padding:"3px 12px", borderRadius:20, fontSize:12, border:"1px solid #F9731640" }}>🤢 Ventre</span>
            <span style={{ background:"#8B5CF620", color:"#A78BFA", padding:"3px 12px", borderRadius:20, fontSize:12, border:"1px solid #8B5CF640" }}>🤕 Tête</span>
          </div>
        </div>
      </div>

      {/* NAV */}
      <div style={{ display:"flex", background:"#1C1C2E", borderTop:"1px solid #2D2D44", position:"sticky", top:0, zIndex:100 }}>
        {[
          { id:"ajouter", label:"Nouvel épisode", icon:"+" },
          { id:"journal", label:"Journal",        icon:"≡" },
          { id:"stats",   label:"Statistiques",   icon:"◈" },
          { id:"rapport", label:"Rapport",        icon:"✦" },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex:1, padding:"11px 2px", border:"none", cursor:"pointer",
            background: tab===t.id ? "#2D2D44" : "transparent",
            color: tab===t.id ? "#A78BFA" : "#666",
            fontSize:10, letterSpacing:"0.05em", textTransform:"uppercase", fontFamily:"inherit",
            borderBottom: tab===t.id ? "2px solid #8B5CF6" : "2px solid transparent",
            transition:"all 0.2s",
          }}>
            <div style={{ fontSize:16, marginBottom:2 }}>{t.icon}</div>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding:"20px 16px", maxWidth:540, margin:"0 auto" }}>

        {/* Flash */}
        {flash && (
          <div style={{
            background: flash==="ajout"?"#10B981" : flash==="edit"?"#F59E0B" : flash==="import"?"#3B82F6" : "#10B981",
            color:"white", borderRadius:10, padding:"12px 16px", textAlign:"center",
            marginBottom:14, fontSize:14, fontWeight:"bold", letterSpacing:"0.05em"
          }}>
            {flash==="ajout" ? "✓ Épisode enregistré" : flash==="edit" ? "✓ Épisode modifié" : "✓ Données importées"}
          </div>
        )}

        {/* ══════ AJOUTER ══════ */}
        {tab==="ajouter" && (
          <FormulaireEpisode form={form} setForm={setForm} onSave={enregistrer} saveLabel="Enregistrer cet épisode"/>
        )}

        {/* ══════ JOURNAL ══════ */}
        {tab==="journal" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <h2 style={{ margin:0, fontSize:16, letterSpacing:"0.1em", color:"#1C1C2E", textTransform:"uppercase" }}>Journal</h2>
              <span style={{ background:"#1C1C2E", color:"white", padding:"3px 12px", borderRadius:20, fontSize:12 }}>
                {episodes.length} épisode{episodes.length!==1?"s":""}
              </span>
            </div>

            {episodes.length===0 ? (
              <div style={{ textAlign:"center", padding:"60px 20px", background:"white", borderRadius:16, border:"2px dashed #E5E7EB" }}>
                <div style={{ fontSize:40, marginBottom:10 }}>📓</div>
                <p style={{ color:"#aaa", fontSize:14 }}>Aucun épisode encore noté</p>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                {episodes.map(e => {
                  const sym = SYMPTOMES.find(s => s.id===e.symptome);
                  const int = INTENSITES.find(x => x.val===e.intensite);
                  const alims = Object.entries(e.aliments);
                  const open = detailId===e.id;
                  return (
                    <div key={e.id} style={{ background:"white", borderRadius:14, overflow:"hidden", boxShadow:"0 2px 10px rgba(0,0,0,0.06)", borderLeft:`4px solid ${sym?.color}` }}>
                      <div onClick={() => setDetailId(open?null:e.id)}
                        style={{ padding:"14px 16px", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <div>
                          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                            <span style={{ fontSize:20 }}>{sym?.emoji}</span>
                            <span style={{ fontSize:14, fontWeight:"bold", color:sym?.color }}>{sym?.label}</span>
                            <span style={{ fontSize:20 }}>{int?.emoji}</span>
                          </div>
                          <div style={{ fontSize:12, color:"#888" }}>📅 {formatShort(e.date)} · ⏱ {dureeLabel(e.dureeMin)}</div>
                        </div>
                        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                          <span style={{ background:`${sym?.color}18`, color:sym?.color, padding:"3px 10px", borderRadius:12, fontSize:12, fontWeight:"bold" }}>{e.intensite}/4</span>
                          <span style={{ color:"#ccc", fontSize:14 }}>{open?"▲":"▼"}</span>
                        </div>
                      </div>
                      {open && (
                        <div style={{ padding:"0 16px 14px", borderTop:"1px solid #F3F4F6" }}>
                          <div style={{ paddingTop:10 }}>
                            {alims.length>0 && (
                              <div style={{ marginBottom:8 }}>
                                <div style={{ fontSize:11, color:"#888", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.08em" }}>Aliments</div>
                                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                                  {alims.map(([nom,catId]) => {
                                    const cat = CATEGORIES_ALIMENTS.find(c => c.id===catId);
                                    return <span key={nom} style={{ background:cat?`${cat.couleur}18`:"#F3F4F6", color:cat?cat.couleur:"#555", padding:"3px 10px", borderRadius:12, fontSize:12, border:`1px solid ${cat?cat.couleur+"40":"#E5E7EB"}` }}>{cat?.emoji} {nom}</span>;
                                  })}
                                </div>
                              </div>
                            )}
                            {e.note && <p style={{ margin:"0 0 10px", fontSize:13, color:"#666", fontStyle:"italic" }}>📝 {e.note}</p>}
                            <div style={{ display:"flex", gap:8 }}>
                              <button onClick={() => startEdit(e)} style={{ flex:1, padding:"8px", borderRadius:8, border:"1px solid #BFDBFE", background:"#EFF6FF", color:"#2563EB", fontSize:12, cursor:"pointer", fontFamily:"inherit", fontWeight:"bold" }}>✏️ Modifier</button>
                              <button onClick={() => supprimer(e.id)} style={{ flex:1, padding:"8px", borderRadius:8, border:"1px solid #FECACA", background:"#FEF2F2", color:"#EF4444", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>🗑 Supprimer</button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══════ STATS ══════ */}
        {tab==="stats" && (
          <div>
            <h2 style={{ margin:"0 0 16px", fontSize:16, letterSpacing:"0.1em", color:"#1C1C2E", textTransform:"uppercase" }}>Statistiques</h2>
            {!stats ? (
              <div style={{ textAlign:"center", padding:"60px 20px", background:"white", borderRadius:16, border:"2px dashed #E5E7EB" }}>
                <div style={{ fontSize:40, marginBottom:10 }}>📊</div>
                <p style={{ color:"#aaa", fontSize:14 }}>Pas encore assez de données</p>
              </div>
            ) : (
              <>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:12 }}>
                  <StatCard label="Épisodes" value={stats.total}                 color="#1C1C2E"/>
                  <StatCard label="Ventre"   value={stats.parSymptome.ventre||0} color="#F97316" emoji="🤢"/>
                  <StatCard label="Tête"     value={stats.parSymptome.tete||0}   color="#8B5CF6" emoji="🤕"/>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
                  <StatCard label="Intensité moy." value={`${stats.avgInt.toFixed(1)}/4`} color="#6B7280"/>
                  <StatCard label="Durée moy."     value={dureeLabel(stats.avgDuree)}       color="#6B7280"/>
                </div>

                <div style={{ background:"white", borderRadius:14, padding:16, marginBottom:14, boxShadow:"0 2px 10px rgba(0,0,0,0.06)" }}>
                  <SectionTitle>Répartition des intensités</SectionTitle>
                  {INTENSITES.map(int => {
                    const cnt = stats.parIntensite[int.val]||0;
                    const pct = stats.total ? Math.round((cnt/stats.total)*100) : 0;
                    const colors = ["#4ADE80","#FACC15","#F97316","#EF4444"];
                    return (
                      <div key={int.val} style={{ marginBottom:10 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:4 }}>
                          <span>{int.emoji} {int.label}</span>
                          <span style={{ color:"#888" }}>{cnt} fois · {pct}%</span>
                        </div>
                        <div style={{ background:"#F3F4F6", borderRadius:4, height:7 }}>
                          <div style={{ width:`${pct}%`, height:"100%", borderRadius:4, background:colors[int.val-1] }}/>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {stats.topCategories.length>0 && (
                  <div style={{ background:"white", borderRadius:14, padding:16, marginBottom:14, boxShadow:"0 2px 10px rgba(0,0,0,0.06)" }}>
                    <SectionTitle>Catégories d'aliments suspectes</SectionTitle>
                    {stats.topCategories.map(([catId,cnt]) => {
                      const cat = CATEGORIES_ALIMENTS.find(c => c.id===catId);
                      const pct = stats.total ? Math.round((cnt/stats.total)*100) : 0;
                      return (
                        <div key={catId} style={{ marginBottom:10 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:4 }}>
                            <span>{cat?.emoji} {cat?.label||catId}</span>
                            <span style={{ color:"#888" }}>{cnt} fois · {pct}%</span>
                          </div>
                          <div style={{ background:"#F3F4F6", borderRadius:4, height:7 }}>
                            <div style={{ width:`${pct}%`, height:"100%", borderRadius:4, background:cat?.couleur||"#999" }}/>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {stats.topAliments.length>0 && (
                  <div style={{ background:"white", borderRadius:14, padding:16, marginBottom:14, boxShadow:"0 2px 10px rgba(0,0,0,0.06)" }}>
                    <SectionTitle>Aliments les plus fréquents</SectionTitle>
                    {stats.topAliments.map(([nom,cnt],i) => {
                      const catId = episodes.find(e => e.aliments[nom])?.aliments[nom];
                      const cat = CATEGORIES_ALIMENTS.find(c => c.id===catId);
                      return (
                        <div key={nom} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:i<stats.topAliments.length-1?"1px solid #F3F4F6":"none" }}>
                          <span style={{ fontSize:13 }}>{cat?.emoji} {nom}</span>
                          <span style={{ background:cat?`${cat.couleur}18`:"#F3F4F6", color:cat?.couleur||"#555", padding:"2px 10px", borderRadius:12, fontSize:12, fontWeight:"bold" }}>{cnt}×</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {Object.keys(stats.parMois).length>1 && (
                  <div style={{ background:"white", borderRadius:14, padding:16, boxShadow:"0 2px 10px rgba(0,0,0,0.06)" }}>
                    <SectionTitle>Fréquence par période</SectionTitle>
                    {Object.entries(stats.parMois).map(([mois,cnt]) => (
                      <div key={mois} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", fontSize:13, borderBottom:"1px solid #F9F9F9" }}>
                        <span style={{ textTransform:"capitalize" }}>{mois}</span>
                        <span style={{ color:"#666" }}>{cnt} épisode{cnt>1?"s":""}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ══════ RAPPORT & EXPORT ══════ */}
        {tab==="rapport" && (
          <div>
            <h2 style={{ margin:"0 0 4px", fontSize:16, letterSpacing:"0.1em", color:"#1C1C2E", textTransform:"uppercase" }}>Rapport & Export</h2>
            <p style={{ color:"#888", fontSize:13, marginBottom:16 }}>Partagez vos données avec votre médecin</p>

            {/* EXPORT */}
            <div style={{ background:"white", borderRadius:14, padding:16, marginBottom:14, boxShadow:"0 2px 10px rgba(0,0,0,0.06)" }}>
              <SectionTitle>Exporter les données</SectionTitle>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <button onClick={() => exportJSON(episodes)} disabled={!episodes.length}
                  style={{ padding:"12px 16px", borderRadius:10, border:"none", background:episodes.length?"#1C1C2E":"#E5E7EB", color:episodes.length?"white":"#aaa", cursor:episodes.length?"pointer":"not-allowed", fontSize:14, fontFamily:"inherit", fontWeight:"bold", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                  💾 Exporter en JSON <span style={{ fontSize:11, opacity:0.7 }}>(sauvegarde complète)</span>
                </button>
                <button onClick={() => exportCSV(episodes)} disabled={!episodes.length}
                  style={{ padding:"12px 16px", borderRadius:10, border:"none", background:episodes.length?"#059669":"#E5E7EB", color:episodes.length?"white":"#aaa", cursor:episodes.length?"pointer":"not-allowed", fontSize:14, fontFamily:"inherit", fontWeight:"bold", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                  📊 Exporter en CSV <span style={{ fontSize:11, opacity:0.7 }}>(Excel / Google Sheets)</span>
                </button>
                <button onClick={() => exportRapportTxt(episodes, stats, rapport)} disabled={!episodes.length}
                  style={{ padding:"12px 16px", borderRadius:10, border:"none", background:episodes.length?"#7C3AED":"#E5E7EB", color:episodes.length?"white":"#aaa", cursor:episodes.length?"pointer":"not-allowed", fontSize:14, fontFamily:"inherit", fontWeight:"bold", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                  🩺 Exporter rapport médecin <span style={{ fontSize:11, opacity:0.7 }}>(texte .txt)</span>
                </button>
              </div>
            </div>

            {/* IMPORT */}
            <div style={{ background:"white", borderRadius:14, padding:16, marginBottom:14, boxShadow:"0 2px 10px rgba(0,0,0,0.06)" }}>
              <SectionTitle>Importer des données</SectionTitle>
              <p style={{ fontSize:12, color:"#888", marginBottom:10 }}>Restaurez une sauvegarde JSON depuis un autre appareil. Les données existantes sont conservées.</p>
              <label style={{ display:"block", padding:"12px 16px", borderRadius:10, border:"2px dashed #D1D5DB", textAlign:"center", cursor:"pointer", fontSize:14, color:"#555", background:"#FAFAFA" }}>
                📂 Choisir un fichier JSON…
                <input type="file" accept=".json" onChange={handleImport} style={{ display:"none" }}/>
              </label>
              {importError && <p style={{ color:"#EF4444", fontSize:12, marginTop:8 }}>{importError}</p>}
            </div>

            {/* RAPPORT TEXTE */}
            {!episodes.length ? (
              <div style={{ textAlign:"center", padding:"40px 20px", background:"white", borderRadius:16, border:"2px dashed #E5E7EB" }}>
                <div style={{ fontSize:40, marginBottom:10 }}>🩺</div>
                <p style={{ color:"#aaa", fontSize:14 }}>Aucune donnée à afficher</p>
              </div>
            ) : (
              <>
                <div style={{ background:"white", borderRadius:14, padding:18, marginBottom:14, boxShadow:"0 2px 10px rgba(0,0,0,0.06)" }}>
                  <SectionTitle>Points clés à aborder</SectionTitle>
                  <ul style={{ margin:0, paddingLeft:18, fontSize:14, color:"#333", lineHeight:2 }}>
                    <li>{episodes.length} épisodes documentés au total</li>
                    {stats?.parSymptome.ventre>0 && <li>Maux de ventre : <strong>{stats.parSymptome.ventre} fois</strong></li>}
                    {stats?.parSymptome.tete>0   && <li>Maux de tête : <strong>{stats.parSymptome.tete} fois</strong></li>}
                    <li>Intensité moyenne : <strong>{stats?.avgInt.toFixed(1)}/4</strong></li>
                    <li>Durée moyenne : <strong>{dureeLabel(stats?.avgDuree)}</strong></li>
                    {stats?.topCategories[0] && <li>Catégorie la plus associée : <strong>{CATEGORIES_ALIMENTS.find(c=>c.id===stats.topCategories[0][0])?.label}</strong> ({stats.topCategories[0][1]} fois)</li>}
                    {stats?.topAliments[0]   && <li>Aliment le plus fréquent : <strong>{stats.topAliments[0][0]}</strong> ({stats.topAliments[0][1]} fois)</li>}
                  </ul>
                </div>
                <div style={{ background:"#1C1C2E", borderRadius:14, padding:16, marginBottom:16 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                    <span style={{ color:"#A78BFA", fontSize:12, letterSpacing:"0.1em", textTransform:"uppercase" }}>Texte complet</span>
                    <button onClick={() => navigator.clipboard?.writeText(rapport)} style={{ background:"#A78BFA", color:"white", border:"none", borderRadius:8, padding:"7px 16px", cursor:"pointer", fontSize:13, fontFamily:"inherit", fontWeight:"bold" }}>📋 Copier</button>
                  </div>
                  <pre style={{ color:"#CBD5E1", fontSize:11.5, margin:0, whiteSpace:"pre-wrap", fontFamily:"'Courier New',monospace", lineHeight:1.65, maxHeight:350, overflowY:"auto" }}>{rapport}</pre>
                </div>
              </>
            )}

            {/* DANGER ZONE */}
            <div style={{ background:"#FEF2F2", borderRadius:14, padding:16, border:"1px solid #FECACA" }}>
              <SectionTitle>Zone dangereuse</SectionTitle>
              {!confirmClear ? (
                <button onClick={() => setConfirmClear(true)} style={{ padding:"10px 16px", borderRadius:10, border:"1px solid #FECACA", background:"white", color:"#EF4444", fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
                  🗑 Effacer toutes les données
                </button>
              ) : (
                <div>
                  <p style={{ fontSize:13, color:"#991B1B", marginBottom:10, fontWeight:"bold" }}>⚠️ Cette action est irréversible. Exportez d'abord vos données.</p>
                  <div style={{ display:"flex", gap:8 }}>
                    <button onClick={() => { setEpisodes([]); setConfirmClear(false); flashMsg("clear"); }} style={{ flex:1, padding:"10px", borderRadius:10, border:"none", background:"#EF4444", color:"white", fontSize:13, cursor:"pointer", fontFamily:"inherit", fontWeight:"bold" }}>Confirmer la suppression</button>
                    <button onClick={() => setConfirmClear(false)} style={{ flex:1, padding:"10px", borderRadius:10, border:"1px solid #E5E7EB", background:"white", color:"#555", fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>Annuler</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────

function SectionCard({ titre, children }) {
  return (
    <div style={{ background:"white", borderRadius:14, padding:16, marginBottom:14, boxShadow:"0 2px 10px rgba(0,0,0,0.06)" }}>
      <div style={{ fontSize:10, letterSpacing:"0.15em", color:"#8B5CF6", textTransform:"uppercase", marginBottom:12, fontWeight:"bold" }}>{titre}</div>
      {children}
    </div>
  );
}
function SectionTitle({ children }) {
  return <div style={{ fontSize:10, letterSpacing:"0.15em", color:"#8B5CF6", textTransform:"uppercase", marginBottom:12, fontWeight:"bold" }}>{children}</div>;
}
function StatCard({ label, value, color, emoji }) {
  return (
    <div style={{ background:"white", borderRadius:12, padding:"14px 10px", textAlign:"center", boxShadow:"0 2px 8px rgba(0,0,0,0.06)" }}>
      {emoji && <div style={{ fontSize:20, marginBottom:4 }}>{emoji}</div>}
      <div style={{ fontSize:24, fontWeight:"bold", color, lineHeight:1 }}>{value}</div>
      <div style={{ fontSize:11, color:"#888", marginTop:4, textTransform:"uppercase", letterSpacing:"0.05em" }}>{label}</div>
    </div>
  );
}
