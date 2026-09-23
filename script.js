const KONFIG = {
  drehdauerMs: 4200, 
  umdrehungen: 5,     
  radiusRef: 124,     
  radiusMin: 46,      
  radiusMax: 178,   
  minWinkelFuerText: 12,
  verlaufLaenge: 40,

  gewichtMin: 1,   
  gewichtMax: 9  
};

const MITTE = 200;         
const SPEICHER = "bluete-daten";

const svgSegmente   = document.getElementById("segmente");
const elErgebnis    = document.getElementById("ergebnis");
const elDrehen      = document.getElementById("drehen");
const feldEinzeln   = document.getElementById("feld-einzeln");
const feldMehrere   = document.getElementById("feld-mehrere");
const elChips       = document.getElementById("chips");
const elAnzahl      = document.getElementById("anzahl-optionen");
const elZaehler     = document.getElementById("zaehler");
const elTabelle     = document.getElementById("tabelle");
const elTabKoerper  = document.getElementById("tabelle-koerper");
const elVerlauf     = document.getElementById("verlauf");
const elListenWahl  = document.getElementById("listen-wahl");
const elListeNeu    = document.getElementById("liste-neu");
const elListeWeg    = document.getElementById("liste-weg");

let optionen = [];    
let verlauf  = [];  
let drehung  = 0;   
let dreht    = false;
let naechsteId = 1;

function farbeFuer(index) {
  const ton = (index * 137.5 + 18) % 360;
  const saettigung = 52 + (index % 2) * 7;  
  const helligkeit = 54 - (index % 3) * 3;
  return `hsl(${ton.toFixed(1)} ${saettigung}% ${helligkeit}%)`;
}

function punkt(winkelGrad, radius) {
  const rad = (winkelGrad - 90) * Math.PI / 180;
  return {
    x: MITTE + radius * Math.cos(rad),
    y: MITTE + radius * Math.sin(rad)
  };
}

function segmentPfad(vonGrad, bisGrad, aussen) {
  const innen = 17;
  const grosserBogen = (bisGrad - vonGrad) > 180 ? 1 : 0;

  const a = punkt(vonGrad, innen);
  const b = punkt(vonGrad, aussen);
  const c = punkt(bisGrad, aussen);
  const d = punkt(bisGrad, innen);

  return [
    `M ${a.x.toFixed(2)} ${a.y.toFixed(2)}`,
    `L ${b.x.toFixed(2)} ${b.y.toFixed(2)}`,
    `A ${aussen} ${aussen} 0 ${grosserBogen} 1 ${c.x.toFixed(2)} ${c.y.toFixed(2)}`,
    `L ${d.x.toFixed(2)} ${d.y.toFixed(2)}`,
    `A ${innen} ${innen} 0 ${grosserBogen} 0 ${a.x.toFixed(2)} ${a.y.toFixed(2)}`,
    "Z"
  ].join(" ");
}

function radiusFuer(treffer, gesamt, anteil) {
  if (gesamt === 0 || anteil <= 0) return KONFIG.radiusRef;

  const erwartet = gesamt * anteil;
  const verhaeltnis = treffer / erwartet;
  const roh = KONFIG.radiusRef * Math.sqrt(verhaeltnis);

  return Math.max(KONFIG.radiusMin, Math.min(KONFIG.radiusMax, roh));
}

function anteile() {
  const summe = optionen.reduce((s, o) => s + (o.gewicht || 1), 0);
  return optionen.map(o => (o.gewicht || 1) / summe);
}

function radZeichnen() {
  svgSegmente.innerHTML = "";
  if (optionen.length === 0) return;

  const gesamt = optionen.reduce((s, o) => s + o.treffer, 0);
  const teile = anteile();

  let winkelZeiger = 0;

  optionen.forEach((option, i) => {
    const schritt = teile[i] * 360;
    const von = winkelZeiger;
    const bis = von + schritt;
    winkelZeiger = bis;

    const zeigtText = schritt >= KONFIG.minWinkelFuerText;
    const aussen = radiusFuer(option.treffer, gesamt, teile[i]);

    const pfad = document.createElementNS("http://www.w3.org/2000/svg", "path");
    pfad.setAttribute("d", segmentPfad(von, bis, aussen));
    pfad.setAttribute("fill", farbeFuer(i));
    pfad.setAttribute("class", "segment");
    pfad.dataset.id = option.id;
    svgSegmente.appendChild(pfad);

    const mitteWinkel = von + schritt / 2;
    const textRadius = (17 + aussen) / 2;
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");

    if (zeigtText) {
      const bogen = (schritt * Math.PI / 180) * textRadius;
      const maxZeichen = Math.max(3, Math.floor(bogen / 7.4));
      const beschriftung = option.name.length > maxZeichen
        ? option.name.slice(0, maxZeichen - 1) + "…"
        : option.name;

      text.textContent = beschriftung;
      text.setAttribute("font-size", "12.5");
    } else {
      text.textContent = String(i + 1);
      text.setAttribute("font-size", "11");
    }

    const p = punkt(mitteWinkel, textRadius);
    text.setAttribute("x", p.x.toFixed(2));
    text.setAttribute("y", p.y.toFixed(2));
    text.setAttribute("class", "segment-text");
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "central");

    const kippen = mitteWinkel > 180;
    const drehWert = kippen ? mitteWinkel + 90 : mitteWinkel - 90;
    text.setAttribute("transform", `rotate(${drehWert.toFixed(2)} ${p.x.toFixed(2)} ${p.y.toFixed(2)})`);

    svgSegmente.appendChild(text);
  });
}

function drehen() {
  if (dreht || optionen.length < 2) return;
  dreht = true;
  elDrehen.disabled = true;
  svgSegmente.classList.remove("dimmen");
  svgSegmente.querySelectorAll(".gewinner").forEach(el => el.classList.remove("gewinner"));

  const teile = anteile();
  const wurf = Math.random();
  let summe = 0;
  let index = optionen.length - 1;   
  for (let i = 0; i < teile.length; i++) {
    summe += teile[i];
    if (wurf < summe) { index = i; break; }
  }
  const gewinner = optionen[index];

  let von = 0;
  for (let i = 0; i < index; i++) von += teile[i] * 360;
  const schritt = teile[index] * 360;
  const mitteWinkel = von + schritt / 2;

  const versatz = (Math.random() - 0.5) * schritt * 0.7;

  const zielRest = ((-(mitteWinkel + versatz)) % 360 + 360) % 360;
  const basis = Math.ceil(drehung / 360) * 360;
  let ziel = basis + KONFIG.umdrehungen * 360 + zielRest;
  if (ziel <= drehung + 360) ziel += 360;

  drehung = ziel;
  svgSegmente.style.transform = `rotate(${drehung}deg)`;

  setTimeout(() => {
    gewinner.treffer++;
    verlauf.unshift({ name: gewinner.name, id: gewinner.id });
    if (verlauf.length > KONFIG.verlaufLaenge) verlauf.pop();

    elErgebnis.textContent = gewinner.name;
    elErgebnis.classList.remove("leer");

    radZeichnen();  
    hervorheben(gewinner.id);
    statistikZeichnen();
    verlaufZeichnen();
    speichern();

    dreht = false;
    elDrehen.disabled = false;
  }, KONFIG.drehdauerMs);
}

function hervorheben(id) {
  const el = svgSegmente.querySelector(`.segment[data-id="${id}"]`);
  if (!el) return;
  el.classList.add("gewinner");
  svgSegmente.classList.add("dimmen");
}


function optionHinzufuegen(rohName) {
  const name = rohName.trim().replace(/\s+/g, " ");
  if (!name) return false;

  if (optionen.some(o => o.name.toLowerCase() === name.toLowerCase())) return false;

  optionen.push({ id: naechsteId++, name, treffer: 0, gewicht: 1 });
  return true;
}

function gewichtAendern(id, richtung) {
  const option = optionen.find(o => o.id === id);
  if (!option) return;
  const neu = (option.gewicht || 1) + richtung;
  if (neu < KONFIG.gewichtMin || neu > KONFIG.gewichtMax) return;
  option.gewicht = neu;
  allesZeichnen();
  speichern();
}

function optionEntfernen(id) {
  optionen = optionen.filter(o => o.id !== id);
  verlauf = verlauf.filter(v => v.id !== id);
  allesZeichnen();
  speichern();
}

function einzelnUebernehmen() {
  if (optionHinzufuegen(feldEinzeln.value)) {
    feldEinzeln.value = "";
    allesZeichnen();
    speichern();
  }
  feldEinzeln.focus();
}

function mehrereUebernehmen() {
  const zeilen = feldMehrere.value.split("\n");
  let neu = 0;
  zeilen.forEach(zeile => { if (optionHinzufuegen(zeile)) neu++; });
  if (neu > 0) {
    feldMehrere.value = "";
    allesZeichnen();
    speichern();
  }
}


function chipsZeichnen() {
  elChips.innerHTML = "";

  optionen.forEach((option, i) => {
    const li = document.createElement("li");

    const punktEl = document.createElement("span");
    punktEl.className = "chip-punkt";
    punktEl.style.background = farbeFuer(i);

    const text = document.createElement("span");
    text.className = "chip-text";
    text.textContent = `${i + 1}. ${option.name}`;
    text.title = option.name;

    const gewicht = option.gewicht || 1;

    const runter = document.createElement("button");
    runter.type = "button";
    runter.className = "chip-gewicht";
    runter.textContent = "−";
    runter.disabled = gewicht <= KONFIG.gewichtMin;
    runter.setAttribute("aria-label", `${option.name} seltener`);
    runter.addEventListener("click", () => gewichtAendern(option.id, -1));

    const anzeige = document.createElement("span");
    anzeige.className = "chip-wert" + (gewicht === 1 ? " eins" : "");
    anzeige.textContent = "×" + gewicht;
    anzeige.title = `Gewicht ${gewicht} — bestimmt Segmentgröße und Chance`;

    const hoch = document.createElement("button");
    hoch.type = "button";
    hoch.className = "chip-gewicht";
    hoch.textContent = "+";
    hoch.disabled = gewicht >= KONFIG.gewichtMax;
    hoch.setAttribute("aria-label", `${option.name} häufiger`);
    hoch.addEventListener("click", () => gewichtAendern(option.id, 1));

    const weg = document.createElement("button");
    weg.type = "button";
    weg.className = "chip-weg";
    weg.textContent = "×";
    weg.setAttribute("aria-label", `${option.name} entfernen`);
    weg.addEventListener("click", () => optionEntfernen(option.id));

    li.append(punktEl, text, runter, anzeige, hoch, weg);
    elChips.appendChild(li);
  });

  elAnzahl.textContent = optionen.length === 1
    ? "1 Option"
    : `${optionen.length} Optionen`;
  elDrehen.disabled = optionen.length < 2 || dreht;
}

function statistikZeichnen() {
  const gesamt = optionen.reduce((s, o) => s + o.treffer, 0);

  if (gesamt === 0) {
    elZaehler.textContent = "Noch keine Drehs aufgezeichnet.";
    elTabelle.classList.add("leer");
    elTabKoerper.innerHTML = "";
    return;
  }

  elTabelle.classList.remove("leer");
  elZaehler.textContent = gesamt === 1
    ? "1 Dreh aufgezeichnet."
    : `${gesamt} Drehs aufgezeichnet.`;

  const teile = anteile();
  elTabKoerper.innerHTML = "";

  optionen.forEach((option, i) => {
    const anteil = (option.treffer / gesamt) * 100;
    const erwartetAnteil = teile[i] * 100;
    const abw = anteil - erwartetAnteil;

    const tr = document.createElement("tr");

    const tdName = document.createElement("td");
    const wrap = document.createElement("span");
    wrap.className = "zell-name";
    const pkt = document.createElement("span");
    pkt.className = "chip-punkt";
    pkt.style.background = farbeFuer(i);
    const nameText = document.createElement("span");
    nameText.textContent = option.name;
    wrap.append(pkt, nameText);
    tdName.appendChild(wrap);

    const tdTreffer = document.createElement("td");
    tdTreffer.textContent = `${option.treffer} von ${gesamt}`;

    const tdAnteil = document.createElement("td");
    tdAnteil.textContent = anteil.toFixed(1) + " %";

    const tdAbw = document.createElement("td");
    tdAbw.className = "abweichung " + (abw >= 0 ? "plus" : "minus");
    tdAbw.textContent = (abw >= 0 ? "+" : "") + abw.toFixed(1);

    tr.append(tdName, tdTreffer, tdAnteil, tdAbw);
    elTabKoerper.appendChild(tr);
  });
}

function verlaufZeichnen() {
  elVerlauf.innerHTML = "";

  if (verlauf.length === 0) {
    const p = document.createElement("li");
    p.className = "verlauf-leer";
    p.textContent = "Noch nichts gedreht.";
    elVerlauf.appendChild(p);
    return;
  }

  verlauf.forEach((eintrag, i) => {
    const li = document.createElement("li");
    const nr = document.createElement("span");
    nr.className = "nummer";
    nr.textContent = verlauf.length - i;
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = eintrag.name;
    li.append(nr, name);
    elVerlauf.appendChild(li);
  });
}

function allesZeichnen() {
  radZeichnen();
  chipsZeichnen();
  statistikZeichnen();
  verlaufZeichnen();
}


let listen = {};         
let aktiveListe = "Meine Liste";

function alleSpeichern() {
  try {
    localStorage.setItem(SPEICHER, JSON.stringify({ aktiv: aktiveListe, listen }));
  } catch {
  }
}

function speichern() {
  listen[aktiveListe] = { optionen, verlauf, naechsteId };
  alleSpeichern();
}

function listeOeffnen(name) {
  if (!listen[name]) return;
  aktiveListe = name;
  const daten = listen[name];
  optionen = Array.isArray(daten.optionen) ? daten.optionen : [];
  verlauf = Array.isArray(daten.verlauf) ? daten.verlauf : [];
  naechsteId = daten.naechsteId || optionen.length + 1;

  elErgebnis.textContent = "Noch nicht gedreht";
  elErgebnis.classList.add("leer");
  svgSegmente.classList.remove("dimmen");

  alleSpeichern();
  allesZeichnen();
}

function listenZeichnen() {
  elListenWahl.innerHTML = "";
  Object.keys(listen).sort((a, b) => a.localeCompare(b, "de")).forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    opt.selected = name === aktiveListe;
    elListenWahl.appendChild(opt);
  });
  elListeWeg.disabled = Object.keys(listen).length < 2;
}

function listeAnlegen() {
  const vorschlag = "Liste " + (Object.keys(listen).length + 1);
  const name = (prompt("Name der neuen Liste:", vorschlag) || "").trim();
  if (!name) return;

  if (listen[name]) {
    alert("Eine Liste mit diesem Namen gibt es schon.");
    return;
  }

  speichern();                
  listen[name] = { optionen: [], verlauf: [], naechsteId: 1 };
  listeOeffnen(name);
  listenZeichnen();
  feldEinzeln.focus();
}

function listeLoeschen() {
  if (Object.keys(listen).length < 2) return;
  if (!confirm(`Liste „${aktiveListe}" mit allen Optionen und der Auswertung löschen?`)) return;

  delete listen[aktiveListe];
  listeOeffnen(Object.keys(listen)[0]);
  listenZeichnen();
}

function laden() {
  try {
    const roh = localStorage.getItem(SPEICHER);
    if (!roh) return false;
    const daten = JSON.parse(roh);

    if (daten.listen && typeof daten.listen === "object") {
      listen = daten.listen;
      const namen = Object.keys(listen);
      if (namen.length === 0) return false;
      aktiveListe = listen[daten.aktiv] ? daten.aktiv : namen[0];
      const l = listen[aktiveListe];
      optionen = Array.isArray(l.optionen) ? l.optionen : [];
      verlauf = Array.isArray(l.verlauf) ? l.verlauf : [];
      naechsteId = l.naechsteId || optionen.length + 1;
      return optionen.length > 0;
    }
    if (Array.isArray(daten.optionen) && daten.optionen.length > 0) {
      optionen = daten.optionen;
      verlauf = Array.isArray(daten.verlauf) ? daten.verlauf : [];
      naechsteId = daten.naechsteId || optionen.length + 1;
      listen = { [aktiveListe]: { optionen, verlauf, naechsteId } };
      alleSpeichern();
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

function zuruecksetzen() {
  const gesamt = optionen.reduce((s, o) => s + o.treffer, 0);
  if (gesamt === 0) return;

  const sicher = confirm(
    `${gesamt} aufgezeichnete Drehs werden gelöscht. Die Optionen bleiben erhalten. Fortfahren?`
  );
  if (!sicher) return;

  optionen.forEach(o => { o.treffer = 0; });
  verlauf = [];
  elErgebnis.textContent = "Noch nicht gedreht";
  elErgebnis.classList.add("leer");
  svgSegmente.classList.remove("dimmen");

  allesZeichnen();  
  speichern();
}


elListenWahl.addEventListener("change", () => {
  speichern();               
  listeOeffnen(elListenWahl.value);
});
elListeNeu.addEventListener("click", listeAnlegen);
elListeWeg.addEventListener("click", listeLoeschen);

document.getElementById("hinzufuegen").addEventListener("click", einzelnUebernehmen);
document.getElementById("uebernehmen").addEventListener("click", mehrereUebernehmen);
document.getElementById("alle-loeschen").addEventListener("click", () => {
  if (optionen.length === 0) return;
  if (!confirm("Alle Optionen und die Auswertung löschen?")) return;
  optionen = [];
  verlauf = [];
  elErgebnis.textContent = "Noch nicht gedreht";
  elErgebnis.classList.add("leer");
  allesZeichnen();
  speichern();   
});
document.getElementById("zuruecksetzen").addEventListener("click", zuruecksetzen);
elDrehen.addEventListener("click", drehen);

feldEinzeln.addEventListener("keydown", e => {
  if (e.key === "Enter") { e.preventDefault(); einzelnUebernehmen(); }
});

if (!laden()) {
  ["Option A", "Option B", "Option C", "Option D"].forEach(n => optionHinzufuegen(n));
  listen[aktiveListe] = { optionen, verlauf, naechsteId };
  alleSpeichern();
}

listenZeichnen();

elErgebnis.classList.add("leer");
allesZeichnen();
